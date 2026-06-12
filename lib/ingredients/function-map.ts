/**
 * Tier 2 — CosIng function → our classification (Phase B+, step 2).
 *
 * CosIng lists each ingredient's functions from a controlled vocabulary, often
 * several per ingredient. We map ONLY specific, reliable functions to a concern
 * or flag. Generic/noisy functions that co-occur on benign ingredients
 * (SKIN CONDITIONING, MASKING, DENATURANT, SOLVENT, PRESERVATIVE, SURFACTANT,
 * VISCOSITY CONTROLLING, BUFFERING, CHELATING, FILM FORMING, …) are deliberately
 * left unmapped: the ingredient still gets a function label, just no score credit.
 * This avoids inflating or mis-flagging products (e.g. glycerin lists PERFUMING +
 * DENATURANT in CosIng — mapping those would be wrong).
 */

import type { Concern } from "@/lib/types";

type FunctionRule = {
  benefitsFor?: Concern[];
  isIrritant?: boolean;
  isFragrance?: boolean;
};

export const FUNCTION_MAP: Record<string, FunctionRule> = {
  HUMECTANT: { benefitsFor: ["dryness"] },
  MOISTURISING: { benefitsFor: ["dryness"] },
  EMOLLIENT: { benefitsFor: ["dryness"] },
  REFATTING: { benefitsFor: ["dryness"] },
  SOOTHING: { benefitsFor: ["sensitivity", "redness"] },
  ANTIOXIDANT: { benefitsFor: ["fine-lines", "dark-spots"] },
  ANTISEBORRHOEIC: { benefitsFor: ["oiliness", "acne"] },
  ASTRINGENT: { benefitsFor: ["oiliness", "pores"] },
  SMOOTHING: { benefitsFor: ["fine-lines"] },
  BLEACHING: { benefitsFor: ["dark-spots"] },
  EXFOLIATING: { benefitsFor: ["acne", "pores", "dark-spots"], isIrritant: true },
  KERATOLYTIC: { benefitsFor: ["acne", "pores", "dark-spots"], isIrritant: true },
  // NOTE: PERFUMING and MASKING are intentionally NOT mapped to isFragrance.
  // CosIng tags many benign ingredients (emollients like caprylic/capric
  // triglyceride, even glycerin) with these, so using them would mis-flag.
  // Real fragrance is handled by the curated tier (parfum + common allergens)
  // and the Gemini tier.
};
