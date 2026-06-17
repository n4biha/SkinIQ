
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
  /** Concerns this ingredient actively works AGAINST, graded by severity (e.g. drying
   *  alcohol → { dryness: "strong" }). These become aggravates-{level} cells on the
   *  grade, which the scoring engine penalizes by severity. */
  aggravates?: Partial<Record<Concern, "slight" | "moderate" | "strong">>;
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
      { name: "Parfum", fragrance: true, irritation: "high", aggravates: { sensitivity: "strong", redness: "strong" }, confidence: "high" },
      { name: "Limonene", fragrance: true, irritation: "high", aggravates: { sensitivity: "strong", redness: "strong" }, confidence: "high" },
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

// ── TENSION: strong benefit AND a real penalty on the SAME product. Does help outweigh harm? ──
  buildCase({
    product: "Glycolic acid exfoliant — dark spots, but sensitive skin",
    profile: profile({ skinType: "combination", sensitive: true, concerns: ["Dark spots", "Pores"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Glycolic Acid", helps: { "dark-spots": "strong", pores: "moderate" }, irritation: "high", confidence: "high" },
      { name: "Glycerin", helps: { dryness: "moderate" }, confidence: "high" },
    ],
    expected: 5,
    rationale: "Genuinely targets their dark spots (strong) BUT high irritation on sensitive skin — benefit and harm roughly cancel to a wash.",
  }),

  // ── TENSION: helps one picked concern, AGGRAVATES another picked concern ──
  // NOTE: this oily+dry profile is an unusual/strained combination — a user who lists oiliness as a
  // concern rarely also lists dryness — so the exact target is SOFT and shouldn't drive aggressive
  // tuning. It exists to exercise the scaled conflict penalty (strong dryness harm + strong oiliness
  // help → just below neutral). The conflict penalty lands it ~4.8.
  buildCase({
    product: "Clay + alcohol mattifier — oily but also dry patches",
    profile: profile({ skinType: "combination", concerns: ["Oiliness", "Dryness"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Kaolin", helps: { oiliness: "strong" }, confidence: "high" },
      { name: "Alcohol Denat.", helps: { oiliness: "moderate" }, aggravates: { dryness: "strong" }, irritation: "medium", confidence: "high" },
      { name: "Silica", helps: { oiliness: "moderate" }, confidence: "medium" },
    ],
    expected: 4.8,
    rationale: "Great for the oiliness half, but a strongly drying active works AGAINST their dryness concern — a split product nets just below neutral via the conflict penalty.",
  }),

  // ── TENSION: the right active is present but BURIED (position vs benefit) ──
  buildCase({
    product: "\"Niacinamide\" serum — but it's the last ingredient",
    profile: profile({ skinType: "oily", concerns: ["Oiliness", "Acne"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Glycerin", helps: { dryness: "moderate" }, confidence: "high" },
      { name: "Butylene Glycol", confidence: "medium" },
      { name: "Phenoxyethanol", confidence: "high" },
      { name: "Niacinamide", helps: { oiliness: "strong", acne: "moderate" }, confidence: "high" },
    ],
    expected: 6.0,
    rationale: "Marketed on niacinamide but it's below the preservative — likely a token amount, so it only partly counts. (Scored ~6.0, same as the structurally-identical SA-low case: a strong active below the 1% line; the engine doesn't read the preservative position, so they land together.)",
  }),

  // ── TENSION: low-confidence grades on the key actives — how much should uncertainty cost? ──
  buildCase({
    product: "Botanical 'brightening' serum — speculative actives",
    profile: profile({ skinType: "combination", concerns: ["Dark spots"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Licorice Root Extract", helps: { "dark-spots": "moderate" }, confidence: "low" },
      { name: "Bearberry Extract", helps: { "dark-spots": "moderate" }, confidence: "low" },
      { name: "Glycerin", helps: { dryness: "moderate" }, confidence: "high" },
    ],
    expected: 6,
    rationale: "Targets the right concern, but the actives are low-confidence — should help, but uncertainty keeps it from scoring like a proven one.",
  }),

  // ── TENSION: allergen present but NOT in this user's allergy list — penalty or not? ──
  buildCase({
    product: "Effective serum with a fragrance allergen — user NOT allergic, not sensitive",
    profile: profile({ skinType: "oily", concerns: ["Acne", "Oiliness"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Niacinamide", helps: { oiliness: "strong", acne: "moderate" }, confidence: "high" },
      { name: "Linalool", fragrance: true, irritation: "medium", aggravates: { sensitivity: "strong", redness: "strong" }, confidence: "high" },
    ],
    expected: 7,
    rationale: "Strong fit; contains a fragrance allergen but user isn't allergic or sensitive — mild ding for the irritant, not a tank.",
  }),

  // ── SAME product as above, but now the user IS sensitive — same ingredients, big swing ──
  buildCase({
    product: "Same serum with fragrance allergen — but user IS sensitive",
    profile: profile({ skinType: "oily", sensitive: true, concerns: ["Acne", "Oiliness"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Niacinamide", helps: { oiliness: "strong", acne: "moderate" }, confidence: "high" },
      { name: "Linalool", fragrance: true, irritation: "medium", aggravates: { sensitivity: "strong", redness: "strong" }, confidence: "high" },
    ],
    expected: 4.5,
    rationale: "Identical product, but the fragrance allergen + sensitivity now matters a lot — the same serum swings down hard for this user.",
  }),

  // ── TENSION: does ALMOST nothing wrong, but also almost nothing right (pure neutral) ──
  buildCase({
    product: "Plain glycerin-water mist — acne-focused user",
    profile: profile({ skinType: "oily", concerns: ["Acne", "Pores"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Glycerin", helps: { dryness: "moderate" }, confidence: "high" },
      { name: "Butylene Glycol", confidence: "medium" },
    ],
    expected: 5,
    rationale: "Harmless but irrelevant — does nothing for acne/pores and nothing bad either. Should sit right at neutral baseline, NOT be penalized.",
  }),

  // ── TENSION: many mild helps vs one strong help — does breadth beat depth? ──
  buildCase({
    product: "Multi-active 'everything' serum — broad but shallow",
    profile: profile({ skinType: "combination", concerns: ["Acne", "Dark spots", "Fine lines"] }),
    ingredients: [
      { name: "Aqua" },
      { name: "Niacinamide", helps: { acne: "slight", oiliness: "slight" }, confidence: "high" },
      { name: "Adenosine", helps: { "fine-lines": "slight" }, confidence: "medium" },
      { name: "Arbutin", helps: { "dark-spots": "slight" }, confidence: "medium" },
    ],
    expected: 6,
    rationale: "Touches all three concerns but only slightly on each — broad shallow coverage; better than ignoring them, worse than nailing one.",
  }),

];

  