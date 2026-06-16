/**
 * SAFETY FLOOR — a small, human-pinned set of grades for established
 * allergens / irritants / comedogens where a confidently-wrong AI grade could
 * actually harm someone.
 *
 * This is NOT a curated benefit map and NOT a grading tier. It pins ONLY the
 * safety fields that matter (irritation / comedogenic / fragrance, and specific
 * concern cells set to "aggravates"); benefit/helps-* grades are left UNSET so the
 * AI still fills those in. Overrides are a PARTIAL overlay: `mergeOverride` clobbers
 * only the pinned fields and keeps the AI grade for everything else.
 *
 * Keep this small (~15–25). If it grows past that it's drifting back into a curated
 * tier — stop. Sources: EU labeled fragrance-allergen list + well-established
 * comedogenic ratings.
 */

import type { Concern, ConcernGrade, IngredientGrade } from "@/lib/types";
import { normalizeName, normalizeConcernKey } from "@/lib/ingredients/normalize";

/** A pinned partial grade — only the safety fields we guarantee. */
export type GradeOverride = {
  irritation?: IngredientGrade["irritation"];
  comedogenic?: number;
  fragrance?: boolean;
  /** Concern cells to force (keyed by the Concern enum). */
  concerns?: Partial<Record<Concern, ConcernGrade>>;
};

// EU-labeled fragrance allergens: declared on labels, common reaction triggers.
// → fragrance + at least medium irritation + aggravates sensitivity/redness.
const FRAGRANCE_ALLERGEN: GradeOverride = {
  fragrance: true,
  irritation: "medium",
  concerns: { sensitivity: "aggravates", redness: "aggravates" },
};

// Potent essential oils / counter-irritants — stronger irritation floor.
const POTENT_IRRITANT: GradeOverride = {
  fragrance: true,
  irritation: "high",
  concerns: { sensitivity: "aggravates", redness: "aggravates" },
};

// High-comedogenic oils/esters — guaranteed warning for acne-prone users.
const comedogenic = (rating: number): GradeOverride => ({
  comedogenic: rating,
  concerns: { acne: "aggravates" },
});

/** [raw INCI name, pinned override]. Keyed by normalizeName when built. */
const SEED: Array<[string, GradeOverride]> = [
  // ── EU fragrance allergens (rationale: required-to-label sensitizers) ──
  ["Limonene", FRAGRANCE_ALLERGEN],
  ["Linalool", FRAGRANCE_ALLERGEN],
  ["Citronellol", FRAGRANCE_ALLERGEN],
  ["Geraniol", FRAGRANCE_ALLERGEN],
  ["Eugenol", FRAGRANCE_ALLERGEN],
  ["Coumarin", FRAGRANCE_ALLERGEN],
  ["Citral", FRAGRANCE_ALLERGEN],
  ["Hydroxycitronellal", FRAGRANCE_ALLERGEN],
  ["Cinnamal", FRAGRANCE_ALLERGEN],
  ["Benzyl Salicylate", FRAGRANCE_ALLERGEN],
  ["Benzyl Alcohol", FRAGRANCE_ALLERGEN],
  ["Hexyl Cinnamal", FRAGRANCE_ALLERGEN],
  ["Butylphenyl Methylpropional", FRAGRANCE_ALLERGEN],
  ["Amyl Cinnamal", FRAGRANCE_ALLERGEN],
  ["Isoeugenol", FRAGRANCE_ALLERGEN],
  ["Farnesol", FRAGRANCE_ALLERGEN],

  // ── Generic declared scent ──
  ["Parfum", FRAGRANCE_ALLERGEN],
  ["Fragrance", FRAGRANCE_ALLERGEN],

  // ── Harsh / potent irritants (rationale: common reactivity triggers) ──
  ["Alcohol Denat.", { irritation: "medium", concerns: { sensitivity: "aggravates" } }],
  ["Menthol", POTENT_IRRITANT],
  ["Mentha Piperita Oil", POTENT_IRRITANT], // peppermint
  ["Eucalyptus Globulus Leaf Oil", POTENT_IRRITANT],

  // ── High-comedogenic for acne safety (rationale: well-established ratings) ──
  ["Coconut Oil", comedogenic(4)],
  ["Cocos Nucifera Oil", comedogenic(4)], // INCI form of coconut oil
  ["Isopropyl Myristate", comedogenic(5)],
  ["Myristyl Myristate", comedogenic(5)],
];

export const OVERRIDES: Record<string, GradeOverride> = Object.fromEntries(
  SEED.map(([name, ov]) => [normalizeName(name), ov]),
);

/** Look up a pinned safety override for a normalized ingredient name. */
export function lookupOverride(normalized: string): GradeOverride | undefined {
  return OVERRIDES[normalized];
}

/**
 * Overlay a partial override onto an AI/KB base grade: pinned safety fields win,
 * the AI grade is kept for everything else. (Concern cells are merged, not replaced.)
 */
export function mergeOverride(base: IngredientGrade, ov: GradeOverride): IngredientGrade {
  const concerns = { ...base.concerns };
  if (ov.concerns) {
    for (const [concern, grade] of Object.entries(ov.concerns)) {
      if (grade) concerns[normalizeConcernKey(concern)] = grade;
    }
  }
  return {
    ...base,
    irritation: ov.irritation ?? base.irritation,
    comedogenic: ov.comedogenic ?? base.comedogenic,
    fragrance: ov.fragrance ?? base.fragrance,
    concerns,
  };
}
