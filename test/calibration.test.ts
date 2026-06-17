import { describe, it, expect } from "vitest";
import { CALIBRATION_CASES, type CalibrationCase, type CalHelpStrength } from "./calibration";
import { scoreProduct } from "@/lib/scoring";
import { normalizeName, normalizeConcernKey } from "@/lib/ingredients/normalize";
import { CURRENT_GRADE_VERSION } from "@/lib/ingredients/version";
import type { ConcernGrade, IngredientGrade } from "@/lib/types";
import type { ResolvedIngredient } from "@/lib/ingredients/types";

/**
 * Calibration suite — the FIT TARGET for lib/scoring.ts.
 *
 * Each case states a (profile + product) and the compatibility score we judge
 * correct; `scoreProduct` must land within ±tolerance. `toResolved` turns each
 * calibration ingredient into the real three-state grade `scoreProduct` consumes
 * (preserving label order, which drives position weighting).
 */

const HELP_TO_GRADE: Record<CalHelpStrength, ConcernGrade> = {
  strong: "helps-strong",
  moderate: "helps-moderate",
  slight: "helps-slight",
};

/** A calibration case → resolved ingredients with real grades, in label order. */
function toResolved(c: CalibrationCase): ResolvedIngredient[] {
  return c.ingredients.map((ci): ResolvedIngredient => {
    const concerns: Record<string, ConcernGrade> = {};
    for (const [concern, strength] of Object.entries(ci.helps ?? {})) {
      if (strength) concerns[normalizeConcernKey(concern)] = HELP_TO_GRADE[strength];
    }
    for (const [concern, level] of Object.entries(ci.aggravates ?? {})) {
      if (level) concerns[normalizeConcernKey(concern)] = `aggravates-${level}` as ConcernGrade;
    }
    const grade: IngredientGrade = {
      irritation: ci.irritation ?? "none",
      comedogenic: ci.comedogenic ?? 0,
      fragrance: ci.fragrance ?? false,
      confidence: ci.confidence ?? "high",
      concerns,
      gradeVersion: CURRENT_GRADE_VERSION,
      model: "calibration",
      gradedAt: "",
    };
    return { raw: ci.name, normalized: normalizeName(ci.name), info: null, tier: 3, grade };
  });
}

describe("calibration set", () => {
  it("every case is well-formed (0–10 expected, has ingredients)", () => {
    expect(CALIBRATION_CASES.length).toBeGreaterThan(0);
    for (const c of CALIBRATION_CASES) {
      expect(c.expected).toBeGreaterThanOrEqual(0);
      expect(c.expected).toBeLessThanOrEqual(10);
      expect(c.ingredients.length).toBeGreaterThan(0);
      expect(c.tolerance ?? 0.5).toBeGreaterThan(0);
    }
  });

  for (const c of CALIBRATION_CASES) {
    const tol = c.tolerance ?? 0.5;
    it(`${c.product} → ~${c.expected} (±${tol}): ${c.rationale}`, () => {
      const { overallScore } = scoreProduct(c.profile, toResolved(c));
      // The message surfaces the actual score on failure — the cue for re-fitting.
      expect(Math.abs(overallScore - c.expected), `got ${overallScore}, expected ~${c.expected}`)
        .toBeLessThanOrEqual(tol);
    });
  }
});
