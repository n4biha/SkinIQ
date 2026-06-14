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
import { readLabel, writeReportCopy } from "@/lib/gemini";
import { scoreProduct, type ScoringResult } from "@/lib/scoring";
import { resolveIngredients } from "@/lib/ingredients/resolve";
import { putReport } from "@/lib/report-store";
import { isSupabaseConfigured } from "@/lib/supabase";
import { saveScan } from "@/lib/storage";
import {
  ReportSchema,
  SkinProfileSchema,
  type LabelReading,
  type Report,
  type ReportCopy,
  type SkinProfile,
} from "@/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  image: z.string().min(1, "image (base64) is required"),
  mimeType: z.string().min(1, "mimeType is required"),
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
  _profile: SkinProfile,
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
  const { image, mimeType, profile } = parsed.data;

  // 2) Read the label with Gemini.
  let label: LabelReading;
  try {
    label = await readLabel(image, mimeType);
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
    copy = buildFallbackCopy(label, scored, profile);
  }

  // 5) Assemble + validate the final report.
  const report: Report = {
    id: crypto.randomUUID(),
    productName: label.productName || "Scanned product",
    scannedOn: today(),
    overallScore: scored.overallScore,
    verdict: scored.verdict,
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

  // 6) Upload the photo to Storage + create a scans row (best-effort), then store
  //    the report linked to it. An image failure is non-fatal — the scan still works.
  let scanId: string | undefined;
  if (isSupabaseConfigured()) {
    scanId = (await saveScan(image, mimeType)) ?? undefined;
  }
  await putReport(validated.data, scanId);

  return NextResponse.json({ id: validated.data.id, report: validated.data });
}
