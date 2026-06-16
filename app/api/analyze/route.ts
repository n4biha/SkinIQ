/**
 * SkinIQ analyze pipeline (Phase B · B5).
 *
 * POST an ingredient-label image + the user's skin profile; get back a fully
 * typed Report. The flow:
 *   image -> readLabel (Gemini)         : transcribe the ingredients
 *         -> scoreProduct (rules)       : THE NUMBERS — deterministic, authoritative
 *         -> writeReportCopy (Gemini)   : the prose (never the numbers)
 *         -> ReportSchema.parse         : final gate
 *
 * The model never produces the score. If the prose call fails we fall back to
 * deterministic templated copy so a report always renders.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { readLabel, readProductFront, writeReportCopy } from "@/lib/gemini";
import { scoreProduct, type ScoringResult } from "@/lib/scoring";
import { resolveIngredients } from "@/lib/ingredients/resolve";
import { gateLabel } from "@/lib/label-gate";
import { gateFront } from "@/lib/front-gate";
import { resolveScanName } from "@/lib/product-name";
import { putReport } from "@/lib/report-store";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/supabase-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveScan } from "@/lib/storage";
import {
  ReportSchema,
  SkinProfileSchema,
  ProductCategorySchema,
  type LabelReading,
  type ProductCategory,
  type Report,
  type ReportCopy,
} from "@/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  // Back (ingredient list) — required; this is what gets gated + scored.
  backImage: z.string().min(1, "backImage (base64) is required"),
  backMimeType: z.string().min(1, "backMimeType is required"),
  // Front (product front) — optional; used only for the name + thumbnail.
  frontImage: z.string().min(1).optional(),
  frontMimeType: z.string().min(1).optional(),
  // Optional user-chosen category from the scan page — authoritative when set.
  category: ProductCategorySchema.optional(),
  profile: SkinProfileSchema,
});

function today(): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

/**
 * Deterministic prose used when the Gemini copy call fails — so the report
 * always renders. Plain, honest sentences derived from the scored result.
 */
function buildFallbackCopy(
  label: LabelReading,
  scored: ScoringResult,
): ReportCopy {
  const good = scored.ingredients.filter((i) => i.flag === "good");
  const flagged = scored.ingredients.filter(
    (i) => i.flag === "caution" || i.flag === "flag",
  );

  const verdictLine =
    scored.verdict === "Good Match"
      ? "Good match for your skin"
      : scored.verdict === "Fair Match"
        ? "A reasonable fit, with a few things to watch"
        : "May not be the best fit for your skin";

  const highlights = good.length
    ? good.map((i) => `${i.name} — ${i.function.toLowerCase()}.`)
    : ["No standout actives for your concerns, but nothing that clashes either."];

  const cautions = flagged.length
    ? flagged.map((i) =>
        i.flag === "flag"
          ? `${i.name} matches one of your listed allergies — avoid this product.`
          : `${i.name} may not suit your skin — patch-test first.`,
      )
    : ["No notable concerns for your profile. Patch-test any new product."];

  const topConcern = scored.concernScores[0];

  return {
    summary: verdictLine,
    highlights,
    cautions,
    benefits: topConcern
      ? [`Works toward your ${topConcern.label.toLowerCase()} goals over time.`]
      : ["Supports a simple, consistent routine."],
    howToUse:
      "Apply to clean, dry skin and follow with moisturizer. Introduce a new " +
      "product slowly — every other day at first — and always use sunscreen in " +
      "the morning.",
  };
}

/** Best-effort client IP for rate-limiting guests (first hop of x-forwarded-for). */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "anon";
}

export async function POST(req: Request) {
  // 1) Validate the request body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  const { backImage, backMimeType, frontImage, frontMimeType, profile } = parsed.data;
  const userCategory = parsed.data.category; // explicit pick wins over the front guess

  // 1.5) Rate-limit the paid pipeline, per signed-in user (or per IP for guests).
  const user = await getUser();
  const rlKey = user?.id ?? clientIp(req);
  const rl = checkRateLimit(`analyze:${rlKey}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You're scanning too fast — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // 2) Read the BACK (ingredient list) with Gemini.
  let label: LabelReading;
  try {
    label = await readLabel(backImage, backMimeType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read the label.";
    // Missing key → server config (500). Rate-limit / quota (429) → a friendly,
    // actionable message. Other model/transcription failures → upstream (502).
    if (message.includes("GEMINI_API_KEY")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    if (/\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Gemini is rate-limited or out of quota right now — please wait a moment and try again.",
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Couldn't read the label. Please try a clearer photo or try again." },
      { status: 502 },
    );
  }

  // 2.5) Validation gate: if the image isn't a real ingredient list, refuse here.
  //      We never score or save a fabricated analysis. No extra API call — this
  //      uses the flags readLabel already returned.
  const gate = gateLabel(label);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, reason: gate.reason }, { status: 422 });
  }

  // 2.6) FRONT (optional, best-effort, SOFT gate). Only for the name + thumbnail —
  //      it can NEVER block or fail the scan. A rejected/face/errored front yields
  //      no name and is not used as the cover (and is never uploaded below).
  let frontName: string | null = null;
  let frontCategory: ProductCategory = "other"; // never invent from a non-product
  let frontIsCover = false;
  if (frontImage && frontMimeType) {
    try {
      const fg = gateFront(await readProductFront(frontImage, frontMimeType));
      if (fg.ok) {
        frontName = fg.productName; // may be null (front, but no legible name)
        frontCategory = fg.category;
        frontIsCover = true; // a real product front → good thumbnail
      } else {
        console.warn("[analyze] front photo rejected (soft):", fg.reason);
      }
    } catch (err) {
      console.warn(
        "[analyze] front read failed; proceeding with back only:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  // 3) Resolve each ingredient (tiers 1→2→3), then score deterministically.
  //    Resolution may call the model; scoring never does — numbers are authoritative.
  const resolved = await resolveIngredients(label.ingredients);
  const scored = scoreProduct(profile, resolved);

  // 4) Write the prose (Gemini), falling back to deterministic copy on failure.
  let copy: ReportCopy;
  try {
    copy = await writeReportCopy(label, scored, profile);
  } catch (err) {
    console.warn(
      "[analyze] writeReportCopy failed, using fallback copy:",
      err instanceof Error ? err.message : err,
    );
    copy = buildFallbackCopy(label, scored);
  }

  // 5) Assemble + validate the final report. Name chain: front-extracted name →
  //    a legible name off the back → ingredient-category placeholder. (The user
  //    can rename on the report afterwards.)
  const extractedName = frontName ?? (label.productName?.trim() || null);
  const report: Report = {
    id: crypto.randomUUID(),
    productName: resolveScanName(extractedName, label.ingredients),
    scannedOn: today(),
    overallScore: scored.overallScore,
    verdict: scored.verdict,
    category: userCategory ?? frontCategory,
    concernScores: scored.concernScores,
    ingredients: scored.ingredients,
    ...copy,
  };

  const validated = ReportSchema.safeParse(report);
  if (!validated.success) {
    console.error("[analyze] assembled report failed validation:", validated.error);
    return NextResponse.json(
      { error: "Failed to build a valid report." },
      { status: 500 },
    );
  }

  // 6) Persist only for a signed-in user: upload the cover photo + save the report
  //    to their account. Guests get a working report (in memory for this session)
  //    but nothing is saved. An image failure is non-fatal. (`user` from step 1.5.)
  //    Cover = the front photo ONLY when it passed the front gate (better thumbnail);
  //    otherwise the back image. A rejected front is never uploaded.
  const coverImage = frontIsCover && frontImage ? frontImage : backImage;
  const coverMimeType = frontIsCover && frontMimeType ? frontMimeType : backMimeType;
  let scanId: string | undefined;
  if (user && isSupabaseConfigured()) {
    scanId = (await saveScan(coverImage, coverMimeType, user.id)) ?? undefined;
  }
  await putReport(validated.data, { ownerId: user?.id, scanId });

  return NextResponse.json({ id: validated.data.id, report: validated.data });
}
