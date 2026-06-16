import { describe, it, expect } from "vitest";
import { resolveGrades, concernContribution } from "@/lib/ingredients/knowledge";
import { groundedItems, type Grader } from "@/lib/ingredients/grade";
import { CURRENT_GRADE_VERSION } from "@/lib/ingredients/version";
import { normalizeName, normalizeConcernKey } from "@/lib/ingredients/normalize";
import type { IngredientGrade } from "@/lib/types";

/* The knowledge base uses a process-global store, so tests use UNIQUE made-up
 * ingredient names to avoid cross-test cache collisions. */

function makeGrade(p: Partial<IngredientGrade> = {}): IngredientGrade {
  return {
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    confidence: "high",
    concerns: {},
    gradeVersion: CURRENT_GRADE_VERSION,
    model: "fake",
    gradedAt: "t",
    ...p,
  };
}

/** A deterministic fake grader; `counter.n` tracks how many times it ran. */
function fakeGrader(
  grades: Record<string, IngredientGrade>,
  counter?: { n: number },
): Grader {
  return async (names) => {
    if (counter) counter.n += 1;
    const out = new Map<string, IngredientGrade>();
    for (const name of names) {
      const key = normalizeName(name);
      out.set(key, grades[key] ?? makeGrade());
    }
    return out;
  };
}

describe("concernContribution (three-state)", () => {
  it("neutral → no reward and no penalty", () => {
    expect(concernContribution("neutral")).toBe("none");
  });
  it("aggravates → penalty", () => {
    expect(concernContribution("aggravates")).toBe("penalty");
  });
  it("helps-* → reward", () => {
    expect(concernContribution("helps-strong")).toBe("reward");
    expect(concernContribution("helps-moderate")).toBe("reward");
    expect(concernContribution("helps-slight")).toBe("reward");
  });
});

describe("knowledge base", () => {
  it("grades once, then serves from cache (determinism + shared store)", async () => {
    const counter = { n: 0 };
    const grader = fakeGrader(
      { determinismium: makeGrade({ concerns: { acne: "helps-strong" } }) },
      counter,
    );

    const first = await resolveGrades(["Determinismium"], { grader });
    // A second, INDEPENDENT resolve reuses the stored grade — no second model call.
    const second = await resolveGrades(["Determinismium"], { grader });

    expect(counter.n).toBe(1);
    expect(second.get("determinismium")).toEqual(first.get("determinismium"));
  });

  it("re-grades a grade stored below the current version", async () => {
    const counter = { n: 0 };
    const grader = fakeGrader(
      { staleium: makeGrade({ gradeVersion: CURRENT_GRADE_VERSION - 1 }) },
      counter,
    );
    await resolveGrades(["Staleium"], { grader });
    await resolveGrades(["Staleium"], { grader });
    expect(counter.n).toBe(2); // stale (sub-current) → never reused, re-graded each time
  });

  it("a partial safety override merges over the AI grade (pinned wins, rest from AI)", async () => {
    // AI says limonene is fragrance-free and helps acne — wrong/unsafe on fragrance.
    const grader = fakeGrader({
      limonene: makeGrade({ fragrance: false, concerns: { acne: "helps-moderate" } }),
    });
    const g = (await resolveGrades(["Limonene"], { grader })).get("limonene")!;

    // Pinned safety fields come from the override...
    expect(g.fragrance).toBe(true);
    expect(g.concerns[normalizeConcernKey("sensitivity")]).toBe("aggravates");
    // ...but the unpinned benefit cell still comes from the AI grade.
    expect(g.concerns[normalizeConcernKey("acne")]).toBe("helps-moderate");
  });

  it("a seeded high-comedogenic ingredient always resolves comedogenic ≥ 4", async () => {
    const grader = fakeGrader({ "coconut oil": makeGrade({ comedogenic: 0 }) });
    const g = (await resolveGrades(["Coconut Oil"], { grader })).get("coconut oil")!;
    expect(g.comedogenic).toBeGreaterThanOrEqual(4);
  });

  it("a non-seeded ingredient is unaffected — fully AI-graded", async () => {
    const grader = fakeGrader({ plainium: makeGrade({ concerns: { acne: "helps-slight" } }) });
    const g = (await resolveGrades(["Plainium"], { grader })).get("plainium")!;
    expect(g.fragrance).toBe(false);
    expect(g.concerns[normalizeConcernKey("acne")]).toBe("helps-slight");
  });
});

describe("CosIng grounding", () => {
  it("feeds CosIng functions into the grading input when data exists", () => {
    const items = groundedItems(["Glycerin", "Aqua", "Niacinamide", "Citric Acid"]);
    // At least one common ingredient carries CosIng function evidence into the grader.
    expect(items.some((i) => i.cosingFunctions.length > 0)).toBe(true);
  });
});
