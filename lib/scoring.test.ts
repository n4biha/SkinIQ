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
    // 5 + 1.9 (oiliness strong) + 1.3 (acne moderate, floored) = 8.2
    expect(out.overallScore).toBe(8.2);
    expect(out.verdict).toBe("Good Match");
    expect(out.ingredients[0].flag).toBe("good");
  });

  it("does NOT penalize a selected concern that nothing addresses (neutral baseline)", () => {
    // The three-state rule: an unaddressed concern is neutral, never a penalty.
    const p = profile({ concerns: ["Acne"] });
    const out = scoreProduct(p, [res("Water", {})]);
    expect(out.overallScore).toBe(5.0);
    expect(out.verdict).toBe("Poor Match");
  });

  it("penalizes an ingredient that AGGRAVATES a selected concern", () => {
    const p = profile({ concerns: ["Acne"] });
    const out = scoreProduct(p, [res("Coconut Oil", { concerns: { acne: "aggravates" } })]);
    // 5 - 1.3 (aggravates acne, top position, high confidence)
    expect(out.overallScore).toBe(3.7);
    expect(out.ingredients[0].flag).toBe("caution");
  });

  it("applies a hard penalty and flag for an allergy hit", () => {
    const p = profile({ concerns: ["Acne"], allergies: ["Fragrance"] });
    const out = scoreProduct(p, [res("Fragrance", { fragrance: true })]);
    // 5 - 4 (allergy). The allergen's own fragrance penalty is subsumed (no double-dip).
    expect(out.overallScore).toBe(1.0);
    expect(out.ingredients[0].flag).toBe("flag");
    expect(out.ingredients[0].note).toBe("Matches one of your listed allergies — avoid.");
  });

  it("penalizes fragrance harder for sensitive skin", () => {
    const p = profile({ sensitive: true, concerns: ["Acne"] });
    const r = [res("Parfum", { fragrance: true, concerns: { acne: "helps-moderate" } })];
    const out = scoreProduct(p, r);
    // 5 + 1.3 (acne moderate, floored) - 2.0 (fragrance, sensitive) = 4.3
    expect(out.overallScore).toBe(4.3);
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
