import { describe, it, expect } from "vitest";
import { scoreProduct } from "@/lib/scoring";
import { normalizeName, normalizeConcernKey } from "@/lib/ingredients/normalize";
import { CURRENT_GRADE_VERSION } from "@/lib/ingredients/version";
import type { Concern, ConcernGrade, IngredientGrade, IrritationRisk, SkinProfile } from "@/lib/types";
import type { IngredientInfo, ResolvedIngredient } from "@/lib/ingredients/types";

/** Build a SkinProfile with sensible empty defaults. */
function profile(p: Partial<SkinProfile> = {}): SkinProfile {
  return { skinType: null, sensitive: false, acneProne: false, concerns: [], allergies: [], ...p };
}

/** One ingredient's three-state grade, with benign defaults. */
type GradeSpec = {
  concerns?: Partial<Record<Concern, ConcernGrade>>;
  /** Free-text (custom) concern cells, keyed by raw label (e.g. { texture: "helps-strong" }). */
  cells?: Record<string, ConcernGrade>;
  irritation?: IrritationRisk;
  comedogenic?: number;
  fragrance?: boolean;
  confidence?: IngredientGrade["confidence"];
};

/** Build a resolved ingredient with a real grade; pass `null` for an unrecognized one. */
function res(raw: string, spec: GradeSpec | null): ResolvedIngredient {
  if (spec === null) return { raw, normalized: normalizeName(raw), info: null, tier: null };
  const concerns: Record<string, ConcernGrade> = {};
  for (const [concern, g] of Object.entries(spec.concerns ?? {})) {
    if (g) concerns[normalizeConcernKey(concern)] = g;
  }
  for (const [label, g] of Object.entries(spec.cells ?? {})) {
    if (g) concerns[normalizeConcernKey(label)] = g;
  }
  const grade: IngredientGrade = {
    irritation: spec.irritation ?? "none",
    comedogenic: spec.comedogenic ?? 0,
    fragrance: spec.fragrance ?? false,
    confidence: spec.confidence ?? "high",
    concerns,
    gradeVersion: CURRENT_GRADE_VERSION,
    model: "test",
    gradedAt: "",
  };
  const info: IngredientInfo = {
    display: raw,
    function: "Test function",
    helps: {},
    irritation: grade.irritation,
    comedogenic: grade.comedogenic,
    fragrance: grade.fragrance,
    note: "Test note.",
  };
  return { raw, normalized: normalizeName(raw), info, tier: 3, grade };
}

describe("scoreProduct", () => {
  it("is deterministic — same inputs produce identical output", () => {
    const p = profile({ skinType: "oily", concerns: ["Acne"] });
    const r = [res("Niacinamide", { concerns: { acne: "helps-moderate" } })];
    expect(scoreProduct(p, r)).toEqual(scoreProduct(p, r));
  });

  it("rewards strong/moderate helps for the user's selected concerns", () => {
    const p = profile({ skinType: "oily", concerns: ["Acne", "Oiliness"] });
    const r = [res("Niacinamide", { concerns: { oiliness: "helps-strong", acne: "helps-moderate" } })];
    const out = scoreProduct(p, r);
    // 5 + 1.9 (oiliness strong) + 1.0 (acne moderate, NOT floored — the product
    // already has a strong help, so the moderate floor is gated off) = 7.9
    expect(out.overallScore).toBe(7.9);
    expect(out.verdict).toBe("Fair Match");
    expect(out.ingredients[0].flag).toBe("good");
  });

  it("does NOT penalize a selected concern that nothing addresses (neutral baseline)", () => {
    // The three-state rule: an unaddressed concern is neutral, never a penalty.
    const p = profile({ concerns: ["Acne"] });
    const out = scoreProduct(p, [res("Water", {})]);
    expect(out.overallScore).toBe(5.0);
    expect(out.verdict).toBe("Poor Match");
  });

  it("penalizes an ingredient that strongly AGGRAVATES a selected concern", () => {
    const p = profile({ concerns: ["Acne"] });
    const out = scoreProduct(p, [res("Coconut Oil", { concerns: { acne: "aggravates-strong" } })]);
    // 5 - 1.9 (aggravates-strong acne, top position, high confidence)
    expect(out.overallScore).toBe(3.1);
    expect(out.ingredients[0].flag).toBe("caution");
  });

  it("scales the harm penalty by severity (strong > moderate > slight)", () => {
    const p = profile({ concerns: ["Acne"] });
    const strong = scoreProduct(p, [res("X", { concerns: { acne: "aggravates-strong" } })]).overallScore;
    const moderate = scoreProduct(p, [res("X", { concerns: { acne: "aggravates-moderate" } })]).overallScore;
    const slight = scoreProduct(p, [res("X", { concerns: { acne: "aggravates-slight" } })]).overallScore;
    expect(strong).toBeLessThan(moderate);
    expect(moderate).toBeLessThan(slight);
    expect(slight).toBeLessThan(5.0);
  });

  it("mirrors help magnitude — aggravates-strong penalty ≈ helps-strong reward", () => {
    const p = profile({ concerns: ["Acne"] });
    const helped = scoreProduct(p, [res("X", { concerns: { acne: "helps-strong" } })]).overallScore;
    const harmed = scoreProduct(p, [res("X", { concerns: { acne: "aggravates-strong" } })]).overallScore;
    expect(helped - 5).toBeCloseTo(5 - harmed, 5); // symmetric about the 5.0 baseline
  });

  it("weights the harm penalty by position and confidence", () => {
    const p = profile({ concerns: ["Acne"] });
    const bad: Parameters<typeof res>[1] = { concerns: { acne: "aggravates-strong" } };
    const top = scoreProduct(p, [res("Bad", bad), res("Water", {})]).overallScore;
    const bottom = scoreProduct(p, [res("Water", {}), res("Bad", bad)]).overallScore;
    expect(top).toBeLessThan(bottom); // top of label hurts more
    const lowConf = scoreProduct(p, [
      res("Bad", { concerns: { acne: "aggravates-strong" }, confidence: "low" }),
    ]).overallScore;
    expect(top).toBeLessThan(lowConf); // a confident harm hurts more than an unsure one
  });

  it("applies a hard penalty and flag for an allergy hit", () => {
    const p = profile({ concerns: ["Acne"], allergies: ["Fragrance"] });
    const out = scoreProduct(p, [res("Fragrance", { fragrance: true })]);
    // 5 - 4 (allergy). The allergen's own fragrance penalty is subsumed (no double-dip).
    expect(out.overallScore).toBe(1.0);
    expect(out.ingredients[0].flag).toBe("flag");
    expect(out.ingredients[0].note).toBe("Matches one of your listed allergies — avoid.");
  });

  it("penalizes a graded-harmful fragrance harder for sensitive skin", () => {
    // Harm flows through graded irritation + aggravates (sensitive skin amplifies both);
    // the bare fragrance boolean imposes nothing on its own.
    const spec: Parameters<typeof res>[1] = {
      fragrance: true,
      irritation: "medium",
      concerns: { acne: "helps-moderate", sensitivity: "aggravates-moderate" },
    };
    const sensitive = scoreProduct(profile({ sensitive: true, concerns: ["Acne"] }), [res("Parfum", spec)]);
    const notSensitive = scoreProduct(profile({ concerns: ["Acne"] }), [res("Parfum", spec)]);
    expect(sensitive.overallScore).toBeLessThan(notSensitive.overallScore);
  });

  it("fragrance harm comes from the graded fields, not the boolean tag", () => {
    const p = profile({ concerns: ["Acne"] });
    // Both ingredients carry the fragrance boolean; only the GRADED severity differs.
    const harsh = scoreProduct(p, [
      res("HarshScent", { fragrance: true, irritation: "high", concerns: { acne: "aggravates-strong" } }),
    ]).overallScore;
    const mild = scoreProduct(p, [
      res("MildScent", { fragrance: true, irritation: "low", concerns: { acne: "neutral" } }),
    ]).overallScore;
    expect(harsh).toBeLessThan(mild - 1); // meaningfully lower — driven by the graded fields
    expect(mild).toBe(5.0); // a fragrance with no graded harm doesn't move the score
  });

  it("weights an active by its position on the label", () => {
    const p = profile({ concerns: ["Acne"] });
    const active: GradeSpec = { concerns: { acne: "helps-strong" } };
    const top = scoreProduct(p, [res("Salicylic Acid", active), res("Water", {}), res("Glycerin", {})]);
    const bottom = scoreProduct(p, [res("Water", {}), res("Glycerin", {}), res("Salicylic Acid", active)]);
    expect(top.overallScore).toBeGreaterThan(bottom.overallScore);
  });

  it("weights an active by the grader's confidence", () => {
    const p = profile({ concerns: ["Acne"] });
    const high = scoreProduct(p, [res("Active", { concerns: { acne: "helps-strong" }, confidence: "high" })]);
    const low = scoreProduct(p, [res("Active", { concerns: { acne: "helps-strong" }, confidence: "low" })]);
    expect(high.overallScore).toBeGreaterThan(low.overallScore);
  });

  it("labels unrecognized ingredients without a flag", () => {
    const out = scoreProduct(profile({ concerns: ["Acne"] }), [res("Mysteryxyz", null)]);
    expect(out.ingredients[0].function).toBe("Unrecognized ingredient");
    expect(out.ingredients[0].note).toBe("Not in our reference set yet.");
    expect(out.ingredients[0].flag).toBeUndefined();
  });

  it("surfaces a Sensitivity bar when the sensitive trait is on", () => {
    const p = profile({ skinType: "oily", sensitive: true, concerns: ["Acne"] });
    const out = scoreProduct(p, [res("Niacinamide", { concerns: { acne: "helps-moderate" } })]);
    const labels = out.concernScores.map((c) => c.label);
    expect(labels).toContain("Sensitivity");
    expect(labels).toContain("Acne");
  });

  it("applies a SCALED conflict penalty when a product both helps and harms selected concerns", () => {
    // Helps oiliness strongly while harming dryness — the penalty scales with harm severity.
    const p = profile({ skinType: "combination", concerns: ["Oiliness", "Dryness"] });
    const at = (dryness: ConcernGrade) =>
      scoreProduct(p, [res("Split", { concerns: { oiliness: "helps-strong", dryness } })]).overallScore;

    const slight = at("aggravates-slight");
    const moderate = at("aggravates-moderate");
    const strong = at("aggravates-strong");

    // Scaled, not flat: slight stays ~neutral+, strong drops below neutral.
    expect(slight).toBeGreaterThan(moderate);
    expect(moderate).toBeGreaterThan(strong);
    expect(slight).toBeGreaterThanOrEqual(5.5); // slight harm → minimal conflict, stays ~6
    expect(strong).toBeLessThan(5.0); // strong harm → conflict pulls below neutral
  });

  it("does NOT fire the conflict penalty for a pure-help product", () => {
    const p = profile({ skinType: "combination", concerns: ["Oiliness", "Dryness"] });
    const helpOnly = scoreProduct(p, [res("HelpOnly", { concerns: { oiliness: "helps-strong" } })]);
    const helpPlusSlight = scoreProduct(p, [
      res("HelpPlusSlight", { concerns: { oiliness: "helps-strong", dryness: "aggravates-slight" } }),
    ]);
    // Slight harm is below the conflict threshold, so it costs only its small direct penalty — no
    // extra conflict bite. (Sanity: pure help isn't dragged by a phantom conflict.)
    expect(helpOnly.overallScore).toBeGreaterThan(6.0);
    expect(helpPlusSlight.overallScore).toBeGreaterThan(6.0);
  });

  it("does NOT fire the conflict penalty when the harm is on an UNSELECTED concern", () => {
    // Helps acne (selected), aggravates dryness (NOT selected) → no conflict; dryness harm is ignored.
    const p = profile({ skinType: "oily", concerns: ["Acne"] });
    const out = scoreProduct(p, [res("X", { concerns: { acne: "helps-strong", dryness: "aggravates-strong" } })]);
    const helpOnly = scoreProduct(p, [res("X", { concerns: { acne: "helps-strong" } })]);
    expect(out.overallScore).toBe(helpOnly.overallScore);
  });

  it("scores a CUSTOM concern the AI judged (and doesn't fall back to default concerns)", () => {
    // Only concern is the custom "texture"; an ingredient that helps texture should
    // lift the score — proving it's scored against texture, not the default set.
    const p = profile({ concerns: ["texture"] });
    const out = scoreProduct(p, [res("Customactive", { cells: { texture: "helps-strong" } })]);
    expect(out.overallScore).toBeGreaterThan(5.0);
    const bar = out.concernScores.find((c) => c.label === "texture");
    expect(bar?.aiAssessed).toBe(true);
    expect(bar?.scored).toBe(true);
  });

  it("penalizes a custom concern an ingredient aggravates", () => {
    const p = profile({ concerns: ["texture"] });
    const out = scoreProduct(p, [res("Roughener", { cells: { texture: "aggravates-strong" } })]);
    expect(out.overallScore).toBeLessThan(5.0);
    expect(out.ingredients[0].flag).toBe("caution");
  });

  it("an all-neutral custom concern contributes ZERO and is tracked, not scored", () => {
    const p = profile({ concerns: ["texture"] });
    // Nothing addresses "texture" → must not move the score and must not penalize.
    const out = scoreProduct(p, [res("Filler", {})]);
    expect(out.overallScore).toBe(5.0);
    const bar = out.concernScores.find((c) => c.label === "texture");
    expect(bar?.aiAssessed).toBe(true);
    expect(bar?.scored).toBe(false);
  });

  it("weights a custom-concern helper LOWER than the same canonical helper", () => {
    const canonical = scoreProduct(profile({ concerns: ["Acne"] }), [
      res("Active", { concerns: { acne: "helps-strong" } }),
    ]);
    const custom = scoreProduct(profile({ concerns: ["texture"] }), [
      res("Active", { cells: { texture: "helps-strong" } }),
    ]);
    expect(custom.overallScore).toBeGreaterThan(5.0);
    expect(custom.overallScore).toBeLessThan(canonical.overallScore);
  });

  it("explicit acne-prone on a DRY profile triggers the comedogenic penalty (old inference missed it)", () => {
    // Dry skin, no Acne concern → the OLD inference would NOT treat this as
    // acne-prone, so a comedogenic ingredient wouldn't be penalized.
    const base = profile({ skinType: "dry", concerns: ["Dryness"] });
    const r = [res("Shea Butter", { concerns: { dryness: "helps-moderate" }, comedogenic: 3 })];

    const withoutFlag = scoreProduct(base, r);
    const withFlag = scoreProduct({ ...base, acneProne: true }, r);

    // The explicit flag now applies the comedogenic penalty → lower score.
    expect(withFlag.overallScore).toBeLessThan(withoutFlag.overallScore);
  });
});
