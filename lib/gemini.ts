/**
 * SkinIQ Gemini client (Phase B · B4).
 *
 * Reads a product's ingredient-list photo with Gemini Flash and returns a
 * structured `LabelReading` (productName + the ingredients exactly as printed +
 * a short per-ingredient note). The model ONLY reads the label and describes
 * ingredients — it never produces the match score or concern percentages. Those
 * are computed deterministically in lib/scoring.ts (B3).
 *
 * Current facts (June 2026):
 *   • Package is @google/genai (not the deprecated @google/generative-ai).
 *   • Model is "gemini-2.5-flash".
 *   • JSON is forced via responseMimeType + responseSchema; read response.text.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import {
  ConcernSchema,
  IngredientAssessmentSchema,
  LabelReadingSchema,
  ReportCopySchema,
  type IngredientAssessment,
  type LabelReading,
  type ReportCopy,
  type SkinProfile,
} from "@/lib/types";
import type { ScoringResult } from "@/lib/scoring";

const MODEL = "gemini-2.5-flash";

/**
 * Structured-output schema handed to Gemini. We ask ONLY for the product name +
 * the ingredient list — that's all the pipeline needs. Per-ingredient analysis
 * is done downstream by the resolver (curated/CosIng/Gemini) and scoring.ts, so
 * asking the model for it here would be wasted output (and on long ingredient
 * lists that overflow caused slow/empty responses).
 */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    productName: {
      type: Type.STRING,
      description: "The product's name as printed on the packaging. Empty string if not visible.",
    },
    ingredients: {
      type: Type.ARRAY,
      description: "Every ingredient, in order, exactly as printed on the label.",
      items: { type: Type.STRING },
    },
  },
  required: ["productName", "ingredients"],
};

const PROMPT =
  "You are reading a skincare product's packaging. Transcribe the ingredient " +
  "list (the INCI list) exactly as printed, in order, as an array of ingredient " +
  "names. Also identify the product name if visible. Do not add, omit, classify, " +
  "score, or comment on the ingredients — just the names. If the label is " +
  "unreadable, return an empty ingredients array.";

let client: GoogleGenAI | null = null;

/** Lazily build the client so a missing key fails only when an analysis runs. */
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.local.example).",
    );
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

/* ------------------------------------------------------------------ */
/* Resilience: disable thinking + retry transient failures             */
/* ------------------------------------------------------------------ */

// gemini-2.5-flash is a thinking model; we don't need it for OCR/classification/
// short prose. Disabling thinking is cheaper, faster, and avoids empty responses.
const THINKING_OFF = { thinkingBudget: 0 } as const;

/** Empty/blank model responses — treated as transient and retried. */
class TransientError extends Error {}

/** Best-effort HTTP status extraction from an @google/genai error. */
function statusOf(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const e = err as { status?: unknown; message?: unknown };
    if (typeof e.status === "number") return e.status;
    const msg = typeof e.message === "string" ? e.message : "";
    const m = msg.match(/"code"\s*:\s*(\d{3})/);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/** Retry on rate-limit (429), server (500), unavailable (503), and empty responses. */
function isRetryable(err: unknown): boolean {
  if (err instanceof TransientError) return true;
  const s = statusOf(err);
  return s === 429 || s === 500 || s === 503;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `fn`, retrying transient failures with short exponential backoff. */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [500, 1500, 3000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= delays.length || !isRetryable(err)) throw err;
      console.warn(
        `[gemini] ${label} attempt ${attempt + 1} failed (${statusOf(err) ?? "transient"}); retrying in ${delays[attempt]}ms`,
      );
      await sleep(delays[attempt]);
    }
  }
}

/**
 * Read an ingredient-label image and return a validated LabelReading.
 *
 * @param imageBase64 base64-encoded image data (no data: URI prefix)
 * @param mimeType    e.g. "image/jpeg" or "image/png"
 */
export async function readLabel(
  imageBase64: string,
  mimeType: string,
): Promise<LabelReading> {
  const ai = getClient();

  const text = await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: THINKING_OFF,
        maxOutputTokens: 8192, // headroom for long ingredient lists
      },
    });
    if (!response.text) throw new TransientError("readLabel: empty response");
    return response.text;
  }, "readLabel");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned malformed JSON.");
  }

  // Zod is the gate: the rest of the pipeline only ever sees a valid LabelReading.
  return LabelReadingSchema.parse(parsed);
}

/* ------------------------------------------------------------------ */
/* Report prose                                                        */
/* ------------------------------------------------------------------ */

/** Structured-output schema for the prose. Mirrors ReportCopySchema. */
const COPY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "One short sentence framing the fit for this person, e.g. 'Good match for your skin'.",
    },
    highlights: {
      type: Type.ARRAY,
      description: "Why it's a good match — short, specific, encouraging bullets.",
      items: { type: Type.STRING },
    },
    cautions: {
      type: Type.ARRAY,
      description: "Potential concerns for this person — honest, non-alarming bullets.",
      items: { type: Type.STRING },
    },
    benefits: {
      type: Type.ARRAY,
      description: "Concrete benefits this person can expect over time.",
      items: { type: Type.STRING },
    },
    howToUse: {
      type: Type.STRING,
      description: "A short, practical how-to-use paragraph.",
    },
  },
  required: ["summary", "highlights", "cautions", "benefits", "howToUse"],
};

/**
 * Write the human-readable report copy. The numbers (overallScore, verdict,
 * concernScores) are ALREADY FINAL — passed in as context so the prose is
 * consistent with them. The model must never restate or change a number.
 */
export async function writeReportCopy(
  label: LabelReading,
  scored: ScoringResult,
  profile: SkinProfile,
): Promise<ReportCopy> {
  const ai = getClient();

  const context = {
    productName: label.productName,
    skinType: profile.skinType,
    sensitive: profile.sensitive,
    concerns: profile.concerns,
    allergies: profile.allergies,
    overallScore: scored.overallScore,
    verdict: scored.verdict,
    concernScores: scored.concernScores,
    ingredients: scored.ingredients.map((i) => ({
      name: i.name,
      function: i.function,
      flag: i.flag ?? "neutral",
    })),
  };

  const prompt =
    "You are SkinIQ, writing the explanation copy for a skincare match report. " +
    "The match score and percentages have ALREADY been computed by our rules " +
    "engine and are final — your job is ONLY to write the words that explain " +
    "them. Do not output, restate, or change any number.\n" +
    "Be CANDID, not flattering. Lead with honest trade-offs. If the match is " +
    "fair or poor, say so plainly and explain why (missing actives for their " +
    "concerns, irritation/fragrance risk, comedogenic ingredients, etc.). Don't " +
    "oversell a mediocre product or pad it with empty praise — keep it kind but " +
    "truthful, and make the cautions specific and substantive. Frame it as " +
    "fit-for-this-person. Base every point on the ingredients and flags provided. " +
    "Here is the data:\n" +
    JSON.stringify(context);

  const text = await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: COPY_SCHEMA,
        thinkingConfig: THINKING_OFF,
      },
    });
    if (!response.text) throw new TransientError("writeReportCopy: empty response");
    return response.text;
  }, "writeReportCopy");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned malformed JSON for report copy.");
  }

  return ReportCopySchema.parse(parsed);
}

/* ------------------------------------------------------------------ */
/* Ingredient classification (Tier 3 fallback)                         */
/* ------------------------------------------------------------------ */

const CLASSIFY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      description: "One graded assessment per input ingredient, in the same order.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The ingredient name, echoed back." },
          function: {
            type: Type.STRING,
            description: "Short cosmetic function, e.g. 'Humectant' or 'Emollient'.",
          },
          helps: {
            type: Type.ARRAY,
            description:
              "Concerns this ingredient helps, each graded. Omit concerns it doesn't help.",
            items: {
              type: Type.OBJECT,
              properties: {
                concern: { type: Type.STRING, format: "enum", enum: [...ConcernSchema.options] },
                strength: { type: Type.STRING, format: "enum", enum: ["strong", "moderate"] },
              },
              required: ["concern", "strength"],
            },
          },
          irritation: {
            type: Type.STRING,
            format: "enum",
            enum: ["none", "low", "medium", "high"],
            description: "Irritation/sensitization risk.",
          },
          comedogenic: {
            type: Type.INTEGER,
            description: "Pore-clogging potential, 0 (none) to 5 (high).",
          },
          fragrance: {
            type: Type.BOOLEAN,
            description: "True for fragrance, parfum, essential oils and fragrance allergens.",
          },
          note: { type: Type.STRING, description: "One short, factual sentence." },
        },
        required: ["name", "function", "helps", "irritation", "comedogenic", "fragrance", "note"],
      },
    },
  },
  required: ["items"],
};

const ClassifyResponseSchema = z.object({
  items: z.array(IngredientAssessmentSchema),
});

/**
 * Grade ingredients (Tier 3). The model supplies bounded JUDGMENTS about each
 * ingredient; scoring.ts still computes every number deterministically. One
 * batched call at temperature 0 for stable output; results are cached upstream.
 */
export async function classifyIngredients(
  names: string[],
): Promise<IngredientAssessment[]> {
  if (names.length === 0) return [];
  const ai = getClient();

  const prompt =
    "You are a rigorous cosmetic-chemistry reference. For each INCI ingredient " +
    "below, grade it conservatively. Mark a concern 'strong' ONLY when it is a " +
    "well-evidenced primary benefit of that ingredient; use 'moderate' for a " +
    "secondary/supportive benefit; OMIT concerns it doesn't meaningfully help. " +
    "Rate irritation honestly (actives like acids/retinoids are not 'none'). " +
    "Do NOT score or rank the product; grade ingredients only.\n\n" +
    "Ingredients:\n" +
    names.map((n) => `- ${n}`).join("\n");

  const text = await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: CLASSIFY_SCHEMA,
        thinkingConfig: THINKING_OFF,
      },
    });
    if (!response.text) throw new TransientError("classifyIngredients: empty response");
    return response.text;
  }, "classifyIngredients");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned malformed JSON for classification.");
  }

  return ClassifyResponseSchema.parse(parsed).items;
}
