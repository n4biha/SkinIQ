/**
 * Shared shapes for the three-tier ingredient resolver.
 *
 * Graded model: each ingredient says how strongly it HELPS each concern
 * (strong/moderate) and its IRRITATION risk (none/low/medium/high). Scoring
 * combines these deterministically.
 */

import type { Concern, HelpStrength, IrritationRisk, IngredientGrade } from "@/lib/types";

/** A resolved, graded ingredient — what scoring.ts consumes. */
export type IngredientInfo = {
  /** Display name in readable casing. */
  display: string;
  /** Short function label, e.g. "Oil control, brightening". */
  function: string;
  /** Per-concern help strength (omit a concern it doesn't help). */
  helps: Partial<Record<Concern, HelpStrength>>;
  /** Irritation risk. */
  irritation: IrritationRisk;
  /** Comedogenic rating 0–5 (pore-clogging potential). */
  comedogenic: number;
  /** Fragrance / essential oil / known fragrance allergen. */
  fragrance: boolean;
  /** A short, neutral note. */
  note: string;
};

/** Which tier answered, for logging/provenance. null = nothing matched. */
type Tier = 1 | 2 | 3 | null;

/**
 * A free-text (non-canonical) skin concern, e.g. "texture". `key` is the stable,
 * normalized cache/grade-cell key; `label` is the concern as the user entered it
 * (used for the AI grading prompt + the report's concern label).
 */
export type CustomConcern = { key: string; label: string };

/** One ingredient after running through the resolver. */
export type ResolvedIngredient = {
  raw: string;
  normalized: string;
  info: IngredientInfo | null;
  tier: Tier;
  /** Full three-state knowledge-base grade (for the future scoring rebuild). */
  grade?: IngredientGrade;
};
