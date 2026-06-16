/**
 * CALIBRATION SET — the anchor for the compatibility-estimate scoring system.
 *
 * Each case is a (profile + product ingredients) pairing plus the compatibility
 * score YOU judge correct (0–10) and a one-line rationale. In Step 3 the
 * deterministic combiner (lib/scoring.ts) is tuned until every case lands within
 * its tolerance (±0.5 by default). That's how the scoring constants stop being
 * arbitrary — they're FITTED to these stated judgments.
 *
 * This is a "compatibility estimate" (how well a product's ingredients fit THIS
 * user), never an accuracy/quality claim.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ADD YOUR OWN CASE: copy a `buildCase({ ... })` block, change the
 * product/profile/ingredients/expected/rationale, done. List ingredients in
 * LABEL ORDER (index 0 = top of the label = most concentrated); Step 4 uses that
 * order to weight prominence.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOTE (temporary types): the `CalIngredient` grade shape below is defined
 * LOCALLY so this file compiles on its own before Step 2 lands. Step 2 replaces
 * it with the real richer `IngredientInfo` (adds "slight" to helps + a
 * `confidence` field) and Step 3/4 wire the combiner + position. When that
 * happens, this local shape goes away and cases map onto the real types.
 */

import type { Concern, SkinProfile } from "@/lib/types";

/* ---- Temporary grade shape (Step 2 replaces with the real IngredientInfo) ---- */

export type CalHelpStrength = "strong" | "moderate" | "slight";
export type CalConfidence = "high" | "medium" | "low";
export type CalIrritation = "none" | "low" | "medium" | "high";

/** One graded ingredient in a calibration case. Optional fields default benign. */
export type CalIngredient = {
  name: string;
  /** Concerns this ingredient helps, graded. Omit concerns it doesn't help. */
  helps?: Partial<Record<Concern, CalHelpStrength>>;
  irritation?: CalIrritation; // default "none"
  comedogenic?: number; // 0–5, default 0
  fragrance?: boolean; // default false
  /** How sure the grade is (Step 2+). Defaults "high". */
  confidence?: CalConfidence;
  // Position/prominence is implied by this ingredient's ORDER in the case's
  // `ingredients` array (top → bottom). Step 4 derives it; no explicit field.
};

export type CalibrationCase = {
  /** Short label, used as the test name. */
  product: string;
  profile: SkinProfile;
  /** Ingredients in label order (index 0 = top = most concentrated). */
  ingredients: CalIngredient[];
  /** The compatibility score you judge correct (0–10). */
  expected: number;
  /** Allowed +/- distance from `expected` (default 0.5). */
  tolerance?: number;
  rationale: string;
};

/* ---- Builders (keep cases terse + copyable) ---- */

/** Build a SkinProfile with benign defaults; pass only what matters. */
function profile(p: Partial<SkinProfile>): SkinProfile {
  return { skinType: null, sensitive: false, acneProne: false, concerns: [], allergies: [], ...p };
}

/** Identity builder — gives every case the default tolerance + a labeled shape. */
function buildCase(c: CalibrationCase): CalibrationCase {
  return { tolerance: 0.5, ...c };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SEEDED CASES — starting judgments. Adjust the `expected` values to YOUR call;
 * the combiner gets tuned to match them in Step 3.
 * ───────────────────────────────────────────────────────────────────────────── */

export const CALIBRATION_CASES: CalibrationCase[] = [
  buildCase({
    product: "Niacinamide serum — oily + acne",
    profile: profile({ skinType: "oily", concerns: ["Acne", "Oiliness"] }),
    ingredients: [
      { name: "Aqua", confidence: "high" },
      { name: "Niacinamide", helps: { oiliness: "strong", acne: "moderate" }, confidence: "high" },
      { name: "Zinc PCA", helps: { oiliness: "strong", acne: "moderate" }, confidence: "high" },
      { name: "Glycerin", helps: { dryness: "moderate" }, confidence: "high" },
    ],
    expected: 8.5,
    rationale: "Nails the main concerns (oil/acne); nothing irritating.",
  }),

  buildCase({
    product: "Heavy fragranced cream — sensitive",
    profile: profile({ skinType: "dry", sensitive: true, concerns: ["Dryness"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Shea Butter", helps: { dryness: "strong" }, comedogenic: 2, confidence: "high" },
      { name: "Parfum", fragrance: true, irritation: "medium", confidence: "high" },
      { name: "Limonene", fragrance: true, irritation: "medium", confidence: "high" },
    ],
    expected: 3,
    rationale: "Fragrance + sensitive skin = poor fit despite the emollients.",
  }),

  buildCase({
    product: "Basic ceramide moisturizer — dry",
    profile: profile({ skinType: "dry", concerns: ["Dryness"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Glycerin", helps: { dryness: "strong" }, confidence: "high" },
      { name: "Ceramide NP", helps: { dryness: "strong" }, confidence: "high" },
      { name: "Cetearyl Alcohol", confidence: "medium" },
    ],
    expected: 7,
    rationale: "Solid hydrator that does its job; no standout extras.",
  }),

  buildCase({
    product: "Vitamin C serum — profile it mostly misses",
    profile: profile({ skinType: "dry", concerns: ["Dryness", "Redness"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Ascorbic Acid", helps: { "dark-spots": "strong", "fine-lines": "moderate" }, irritation: "low", confidence: "high" },
      { name: "Ferulic Acid", helps: { "fine-lines": "slight" }, confidence: "medium" },
    ],
    expected: 5,
    rationale: "Fine product, but its strengths don't match this user's concerns.",
  }),

  buildCase({
    product: "Product containing a listed allergen",
    profile: profile({ skinType: "combination", concerns: ["Acne"], allergies: ["Limonene"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Niacinamide", helps: { acne: "moderate" }, confidence: "high" },
      { name: "Limonene", fragrance: true, irritation: "medium", confidence: "high" },
    ],
    expected: 2,
    rationale: "Contains a listed allergen — should tank regardless of the good actives.",
  }),

  // ---- Position pair: SAME active, top vs bottom of the list ----
  buildCase({
    product: "Salicylic acid HIGH on the list — oily + acne",
    profile: profile({ skinType: "oily", concerns: ["Acne", "Pores"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Salicylic Acid", helps: { acne: "strong", pores: "strong" }, irritation: "medium", confidence: "high" },
      { name: "Glycerin", helps: { dryness: "moderate" }, confidence: "high" },
    ],
    expected: 8,
    rationale: "Key active near the top → likely impactful; strong fit for acne/pores.",
  }),

  buildCase({
    product: "Salicylic acid LOW on the list — oily + acne",
    profile: profile({ skinType: "oily", concerns: ["Acne", "Pores"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Glycerin", helps: { dryness: "moderate" }, confidence: "high" },
      { name: "Cetearyl Alcohol", confidence: "medium" },
      { name: "Phenoxyethanol", confidence: "high" }, // ~1% line marker
      { name: "Salicylic Acid", helps: { acne: "strong", pores: "strong" }, irritation: "medium", confidence: "high" },
    ],
    expected: 6,
    rationale: "Same active but near the bottom → likely a small amount; weaker fit than top.",
  }),
// ── Same product, two profiles: shows score depends on the PERSON ──
  buildCase({
    product: "Hydrating HA serum — dry skin (good fit)",
    profile: profile({ skinType: "dry", concerns: ["Dryness"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Sodium Hyaluronate", helps: { dryness: "strong" }, confidence: "high" },
      { name: "Glycerin", helps: { dryness: "strong" }, confidence: "high" },
      { name: "Panthenol", helps: { dryness: "moderate", redness: "slight" }, confidence: "medium" },
    ],
    expected: 8,
    rationale: "Pure hydration, exactly this dry user's concern; nothing to penalize.",
  }),

  buildCase({
    product: "Hydrating HA serum — oily + acne (mismatch)",
    profile: profile({ skinType: "oily", concerns: ["Acne", "Oiliness"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Sodium Hyaluronate", helps: { dryness: "strong" }, confidence: "high" },
      { name: "Glycerin", helps: { dryness: "strong" }, confidence: "high" },
      { name: "Panthenol", helps: { dryness: "moderate", redness: "slight" }, confidence: "medium" },
    ],
    expected: 5,
    rationale: "Perfectly fine product, but does nothing for this user's acne/oil concerns.",
  }),

  // ── Honest low: actively wrong for the profile (not just neutral) ──
  buildCase({
    product: "Rich occlusive balm — oily + acne-prone",
    profile: profile({ skinType: "oily", concerns: ["Acne", "Pores"] }),
    ingredients: [
      { name: "Petrolatum", comedogenic: 2, confidence: "high" },
      { name: "Coconut Oil", comedogenic: 4, confidence: "high" },
      { name: "Isopropyl Myristate", comedogenic: 5, confidence: "high" },
      { name: "Beeswax", comedogenic: 2, confidence: "medium" },
    ],
    expected: 2.5,
    rationale: "Highly comedogenic ingredients high on the list — poor fit for acne-prone oily skin.",
  }),

  // ── Strong active fit, but one real drawback keeps it from the top ──
  buildCase({
    product: "Retinol night serum — fine lines, not sensitive",
    profile: profile({ skinType: "combination", concerns: ["Fine lines", "Dark spots"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Retinol", helps: { "fine-lines": "strong", "dark-spots": "moderate" }, irritation: "medium", confidence: "high" },
      { name: "Squalane", helps: { dryness: "moderate" }, confidence: "high" },
      { name: "Tocopherol", helps: { "fine-lines": "slight" }, confidence: "medium" },
    ],
    expected: 7.5,
    rationale: "Strong for their anti-aging concerns; mild irritation risk shaves it below an 8.",
  }),

  // ── Mid-tier: does its job, nothing special, no concerns matched strongly ──
  buildCase({
    product: "Gentle gel cleanser — sensitive, redness",
    profile: profile({ skinType: "combination", sensitive: true, concerns: ["Redness"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Coco-Glucoside", confidence: "medium" },
      { name: "Glycerin", helps: { dryness: "moderate" }, confidence: "high" },
      { name: "Allantoin", helps: { redness: "moderate" }, confidence: "medium" },
    ],
    expected: 6.5,
    rationale: "Gentle and non-irritating for sensitive skin; mild redness help, nothing dramatic.",
  }),

  // ── Sensitive-skin WIN: actively soothing, zero irritants ──
  buildCase({
    product: "Cica calming moisturizer — sensitive, redness",
    profile: profile({ skinType: "dry", sensitive: true, concerns: ["Redness", "Dryness"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Centella Asiatica Extract", helps: { redness: "strong" }, confidence: "high" },
      { name: "Glycerin", helps: { dryness: "strong" }, confidence: "high" },
      { name: "Ceramide NP", helps: { dryness: "strong" }, confidence: "high" },
      { name: "Madecassoside", helps: { redness: "strong" }, confidence: "medium" },
    ],
    expected: 9,
    rationale: "Targets both concerns directly, fragrance-free, nothing irritating for sensitive skin.",
  }),

  // TODO: add more of your own cases here (copy a buildCase({...}) block above).
];

  