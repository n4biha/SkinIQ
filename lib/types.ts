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
  "sensitive",
  "not-sure",
]);

export const SkinProfileSchema = z.object({
  skinType: SkinTypeSchema.nullable(),
  concerns: z.array(z.string()),
  allergies: z.array(z.string()).default([]),
});

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

/**
 * The fixed fields an ingredient is classified into — by the curated map, the
 * CosIng tier, or the Gemini fallback (B+). Scoring consumes ONLY these fields;
 * the model fills them in but never produces a score.
 */
export const IngredientClassificationSchema = z.object({
  name: z.string(),
  function: z.string(),
  benefitsFor: z.array(ConcernSchema),
  comedogenic: z.number().int().min(0).max(5),
  isIrritant: z.boolean(),
  isFragrance: z.boolean(),
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
  // Optional: readLabel no longer asks the model for per-ingredient notes
  // (the resolver + scoring produce them). Kept for backward compatibility.
  notes: z.array(IngredientNoteSchema).default([]),
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
export type Report = z.infer<typeof ReportSchema>;
export type ReportCopy = z.infer<typeof ReportCopySchema>;
export type Concern = z.infer<typeof ConcernSchema>;
export type IngredientClassification = z.infer<typeof IngredientClassificationSchema>;
