import { describe, it, expect } from "vitest";
import { scoreProduct } from "@/lib/scoring";
import { normalizeName } from "@/lib/ingredients/normalize";
import type { SkinProfile } from "@/lib/types";
import type { IngredientInfo, ResolvedIngredient } from "@/lib/ingredients/types";

/** Build a SkinProfile with sensible empty defaults. */
function profile(p: Partial<SkinProfile> = {}): SkinProfile {
  return { skinType: null, sensitive: false, acneProne: false, concerns: [], allergies: [], ...p };
}

/** Build a resolved ingredient; pass `null` info for an unrecognized one. */
function res(raw: string, info: Partial<IngredientInfo> | null): ResolvedIngredient {
  return {
    raw,
    normalized: normalizeName(raw),
    info: info
      ? {
          display: raw,
          function: "Test function",
          helps: {},
          irritation: "none",
          comedogenic: 0,
          fragrance: false,
          note: "Test note.",
          ...info,
        }
      : null,
    tier: info ? 1 : null,
  };
}

describe("scoreProduct", () => {
  it("is deterministic — same inputs produce identical output", () => {
    const p = profile({ skinType: "oily", concerns: ["Acne"] });
    const r = [res("Niacinamide", { helps: { acne: "moderate" } })];
    expect(scoreProduct(p, r)).toEqual(scoreProduct(p, r));
  });

  it("rewards strong/moderate actives for the user's selected concerns", () => {
    const p = profile({ skinType: "oily", concerns: ["Acne", "Oiliness"] });
    const r = [res("Niacinamide", { helps: { oiliness: "strong", acne: "moderate" } })];
    const out = scoreProduct(p, r);
    // 5 + 0.75 (acne moderate) + 1.5 (oiliness strong) = 7.25 -> 7.3
    expect(out.overallScore).toBe(7.3);
    expect(out.verdict).toBe("Fair Match");
    expect(out.ingredients[0].flag).toBe("good");
  });

  it("penalizes a selected concern that nothing addresses", () => {
    const p = profile({ concerns: ["Acne"] });
    const out = scoreProduct(p, [res("Water", { helps: {} })]);
    expect(out.overallScore).toBe(4.0); // 5 - 1.0
    expect(out.verdict).toBe("Poor Match");
  });

  it("applies a hard penalty and flag for an allergy hit", () => {
    const p = profile({ concerns: ["Acne"], allergies: ["Fragrance"] });
    const out = scoreProduct(p, [res("Fragrance", { helps: {} })]);
    expect(out.overallScore).toBe(0); // 5 - 1 (acne) - 4 (allergy), clamped
    expect(out.ingredients[0].flag).toBe("flag");
    expect(out.ingredients[0].note).toBe(
      "Matches one of your listed allergies — avoid.",
    );
  });

  it("penalizes fragrance harder for sensitive skin", () => {
    const p = profile({ sensitive: true, concerns: ["Acne"] });
    const r = [res("Parfum", { fragrance: true, helps: { acne: "moderate" } })];
    const out = scoreProduct(p, r);
    // 5 + 0.75 (acne moderate) - 2.0 (fragrance, sensitive) = 3.75 -> 3.8
    expect(out.overallScore).toBe(3.8);
  });

  it("labels unrecognized ingredients without a flag", () => {
    const out = scoreProduct(profile({ concerns: ["Acne"] }), [res("Mysteryxyz", null)]);
    expect(out.ingredients[0].function).toBe("Unrecognized ingredient");
    expect(out.ingredients[0].note).toBe("Not in our reference set yet.");
    expect(out.ingredients[0].flag).toBeUndefined();
  });

  it("surfaces a Sensitivity bar when the sensitive trait is on", () => {
    const p = profile({ skinType: "oily", sensitive: true, concerns: ["Acne"] });
    const out = scoreProduct(p, [res("Niacinamide", { helps: { acne: "moderate" } })]);
    const labels = out.concernScores.map((c) => c.label);
    expect(labels).toContain("Sensitivity");
    expect(labels).toContain("Acne");
  });

  it("explicit acne-prone on a DRY profile triggers the comedogenic penalty (old inference missed it)", () => {
    // Dry skin, no Acne concern → the OLD inference would NOT treat this as
    // acne-prone, so a comedogenic ingredient wouldn't be penalized.
    const base = profile({ skinType: "dry", concerns: ["Dryness"] });
    const r = [res("Shea Butter", { helps: { dryness: "moderate" }, comedogenic: 3 })];

    const withoutFlag = scoreProduct(base, r);
    const withFlag = scoreProduct({ ...base, acneProne: true }, r);

    // The explicit flag now applies the comedogenic penalty → lower score.
    expect(withFlag.overallScore).toBeLessThan(withoutFlag.overallScore);
  });
});
