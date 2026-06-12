/**
 * Shared shapes for the three-tier ingredient resolver (Phase B+).
 */

import type { Concern } from "@/lib/types";

/** A resolved ingredient classification — what scoring.ts consumes. */
export type IngredientInfo = {
  /** Display name in readable casing. */
  display: string;
  /** Short function label, e.g. "Oil control, brightening". */
  function: string;
  /** Concerns this ingredient is known to help. */
  benefitsFor: Concern[];
  /** Comedogenic rating 0–5 (pore-clogging potential). */
  comedogenic: number;
  /** AHAs, BHAs, retinoids, denatured alcohol, etc. */
  isIrritant?: boolean;
  /** Fragrance / essential oil / known fragrance allergen. */
  isFragrance?: boolean;
  /** A short, neutral note. */
  note: string;
};

/** Which tier answered, for logging/provenance. null = nothing matched. */
export type Tier = 1 | 2 | 3 | null;

/** One ingredient after running through the resolver. */
export type ResolvedIngredient = {
  raw: string;
  normalized: string;
  info: IngredientInfo | null;
  tier: Tier;
};
