/**
 * Tier 2 — CosIng function → graded contributions.
 *
 * Only specific, reliable functions map to a concern (default strength
 * "moderate") or an irritation level. Generic/noisy functions (SKIN CONDITIONING,
 * MASKING, PERFUMING, DENATURANT, SOLVENT, PRESERVATIVE, SURFACTANT, …) are left
 * unmapped — they'd mis-grade benign ingredients. Curated (Tier 1) and Gemini
 * (Tier 3) handle nuance like fragrance and strong actives.
 */

import type { Concern, HelpStrength, IrritationRisk } from "@/lib/types";

type FunctionRule = {
  helps?: Partial<Record<Concern, HelpStrength>>;
  irritation?: IrritationRisk;
};

export const FUNCTION_MAP: Record<string, FunctionRule> = {
  HUMECTANT: { helps: { dryness: "moderate" } },
  MOISTURISING: { helps: { dryness: "moderate" } },
  EMOLLIENT: { helps: { dryness: "moderate" } },
  REFATTING: { helps: { dryness: "moderate" } },
  SOOTHING: { helps: { sensitivity: "moderate", redness: "moderate" } },
  ANTIOXIDANT: { helps: { "fine-lines": "moderate", "dark-spots": "moderate" } },
  ANTISEBORRHOEIC: { helps: { oiliness: "moderate", acne: "moderate" } },
  ASTRINGENT: { helps: { oiliness: "moderate", pores: "moderate" }, irritation: "low" },
  SMOOTHING: { helps: { "fine-lines": "moderate" } },
  BLEACHING: { helps: { "dark-spots": "moderate" } },
  EXFOLIATING: {
    helps: { acne: "moderate", pores: "moderate", "dark-spots": "moderate" },
    irritation: "medium",
  },
  KERATOLYTIC: {
    helps: { acne: "moderate", pores: "moderate", "dark-spots": "moderate" },
    irritation: "medium",
  },
};
