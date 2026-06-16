/**
 * Single source of truth for SkinIQ data shapes.
 * Each shape is defined once as a Zod schema; the TS type is inferred from it.
 * Used across the UI, the /api/analyze pipeline (B3+), and validation of the
 * Gemini response (B5).
 */

import { z } from "zod";

/* ---- Skin profile ---- */

export const SkinTypeSchema = z.enum([
  "oily",
  "dry",
  "combination",
  "not-sure",
]);

/**
 * Raw profile shape. `sensitive` is a TRAIT that coexists with any skin type
 * (you can be "dry and sensitive"), so it's a separate boolean, not a skin type.
 */
const SkinProfileObject = z.object({
  skinType: SkinTypeSchema.nullable(),
  sensitive: z.boolean().default(false),
  concerns: z.array(z.string()),
  allergies: z.array(z.string()).default([]),
});

/**
 * Skin profile. The `preprocess` migrates legacy data from when "sensitive" was
 * a skin TYPE: an old saved `skinType: "sensitive"` becomes
 * `{ skinType: null, sensitive: true }` instead of failing to parse.
 */
export const SkinProfileSchema = z.preprocess((val) => {
  if (
    val &&
    typeof val === "object" &&
    (val as { skinType?: unknown }).skinType === "sensitive"
  ) {
    return { ...(val as object), skinType: null, sensitive: true };
  }
  return val;
}, SkinProfileObject);

/* ---- Canonical skin concerns (shared by scoring + ingredient classification) ---- */

export const ConcernSchema = z.enum([
  "acne",
  "oiliness",
  "redness",
  "pores",
  "dryness",
  "dark-spots",
  "sensitivity",
  "fine-lines",
]);

/** How strongly an ingredient helps a concern, and how irritating it is. */
export const HelpStrengthSchema = z.enum(["strong", "moderate"]);
export const IrritationRiskSchema = z.enum(["none", "low", "medium", "high"]);

export const IngredientHelpSchema = z.object({
  concern: ConcernSchema,
  strength: HelpStrengthSchema,
});

/**
 * The graded assessment an ingredient gets — from the curated map, the CosIng
 * tier, or the Gemini judgment (temp 0, cached). Scoring consumes ONLY these
 * fields; the model grades ingredients but never produces a score.
 */
export const IngredientAssessmentSchema = z.object({
  name: z.string(),
  function: z.string(),
  helps: z.array(IngredientHelpSchema),
  irritation: IrritationRiskSchema,
  comedogenic: z.number().int().min(0).max(5),
  fragrance: z.boolean(),
  note: z.string(),
});

/* ---- Report building blocks ---- */

export const VerdictSchema = z.enum(["Good Match", "Fair Match", "Poor Match"]);

export const IngredientNoteSchema = z.object({
  name: z.string(),
  function: z.string(),
  note: z.string(),
  flag: z.enum(["good", "caution", "flag"]).optional(),
});

export const ConcernScoreSchema = z.object({
  label: z.string(),
  percent: z.number().min(0).max(100),
});

/* ---- What Gemini returns when it reads a label (wired in B5) ---- */

export const LabelReadingSchema = z.object({
  productName: z.string(),
  ingredients: z.array(z.string()),
  // Validation gate: true only when the image clearly shows a cosmetic ingredient
  // (INCI) list. When false, `rejectReason` explains why and `ingredients` is
  // empty — the route refuses instead of scoring a fabricated analysis. Defaults
  // keep older callers/tests valid.
  isIngredientList: z.boolean().default(true),
  rejectReason: z.string().nullable().default(null),
  // Optional: readLabel no longer asks the model for per-ingredient notes
  // (the resolver + scoring produce them). Kept for backward compatibility.
  notes: z.array(IngredientNoteSchema).default([]),
});

/* ---- Product category (drives planner step labels, ordering, timing) ---- */

// Small canonical enum. Intent:
//   • treatment  = actives like retinoids, exfoliating acids, spot treatments
//                  (the things that drive conflicts/timing).
//   • serum      = lighter leave-on serums (vitamin C, niacinamide, hydrators).
//   • other      = anything that doesn't fit (masks, eye cream, oils, mists) —
//                  a safe fallback; never guess wildly to avoid it.
export const ProductCategorySchema = z.enum([
  "cleanser",
  "toner",
  "serum",
  "treatment",
  "moisturizer",
  "sunscreen",
  "other",
]);

/* ---- What Gemini returns when it reads the FRONT of a product (optional slot) ---- */

// Front is a SOFT gate: used only for the product name + thumbnail + category,
// never to score. `productName` must be null when the image isn't a product front.
export const FrontReadingSchema = z.object({
  isProductFront: z.boolean().default(false),
  frontRejectReason: z.string().nullable().default(null),
  productName: z.string().nullable().default(null),
  // `.catch` makes an invalid/garbage value fall back to "other" instead of throwing.
  category: ProductCategorySchema.catch("other").default("other"),
});

/* ---- The full report the results page renders ---- */

export const ReportSchema = z.object({
  id: z.string(),
  productName: z.string(),
  scannedOn: z.string(),
  overallScore: z.number().min(0).max(10),
  verdict: VerdictSchema,
  summary: z.string(),
  highlights: z.array(z.string()),
  cautions: z.array(z.string()),
  benefits: z.array(z.string()),
  concernScores: z.array(ConcernScoreSchema),
  ingredients: z.array(IngredientNoteSchema),
  howToUse: z.string(),
  // Product category (best-effort, from the front read). null/invalid → "other".
  category: ProductCategorySchema.catch("other").default("other"),
  // Optional signed URL to the uploaded label photo (Phase C3). Absent → placeholder.
  imageUrl: z.string().optional(),
});

/* ---- The prose subset Gemini writes (numbers stay in scoring.ts) ---- */

export const ReportCopySchema = ReportSchema.pick({
  summary: true,
  highlights: true,
  cautions: true,
  benefits: true,
  howToUse: true,
});

/* ---- Inferred types ---- */

export type SkinType = z.infer<typeof SkinTypeSchema>;
export type SkinProfile = z.infer<typeof SkinProfileSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type IngredientNote = z.infer<typeof IngredientNoteSchema>;
export type ConcernScore = z.infer<typeof ConcernScoreSchema>;
export type LabelReading = z.infer<typeof LabelReadingSchema>;
export type FrontReading = z.infer<typeof FrontReadingSchema>;
export type ProductCategory = z.infer<typeof ProductCategorySchema>;
export type Report = z.infer<typeof ReportSchema>;
export type ReportCopy = z.infer<typeof ReportCopySchema>;
export type Concern = z.infer<typeof ConcernSchema>;
export type HelpStrength = z.infer<typeof HelpStrengthSchema>;
export type IrritationRisk = z.infer<typeof IrritationRiskSchema>;
export type IngredientAssessment = z.infer<typeof IngredientAssessmentSchema>;
