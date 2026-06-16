import { describe, it, expect } from "vitest";
import { CALIBRATION_CASES } from "./calibration";

/**
 * Calibration suite.
 *
 * Right now it only validates that the calibration DATA is well-formed (so it
 * stays green while you edit the cases). The actual ±tolerance assertions
 * against the combiner are wired in STEP 3 — once `scoreProduct` consumes the
 * richer grades (slight/confidence) and Step 4 adds position. Those `it.todo`
 * placeholders are the FIT TARGET: the constants in lib/scoring.ts get tuned
 * until each one passes.
 */
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

  // STEP 3: replace each todo with
  //   const score = scoreProduct(case.profile, toResolved(case));
  //   expect(Math.abs(score - case.expected)).toBeLessThanOrEqual(case.tolerance ?? 0.5);
  // then remove the `.todo`.
  for (const c of CALIBRATION_CASES) {
    it.todo(`${c.product} → ~${c.expected} (±${c.tolerance ?? 0.5}): ${c.rationale}`);
  }
});
