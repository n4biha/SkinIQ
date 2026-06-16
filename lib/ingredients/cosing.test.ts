import { describe, it, expect } from "vitest";
import { lookupCosing } from "@/lib/ingredients/cosing";
import { FUNCTION_MAP } from "@/lib/ingredients/function-map";

describe("FUNCTION_MAP", () => {
  it("maps humectant to dryness (moderate)", () => {
    expect(FUNCTION_MAP.HUMECTANT.helps?.dryness).toBe("moderate");
  });

  it("marks exfoliating as a medium irritant", () => {
    expect(FUNCTION_MAP.EXFOLIATING.irritation).toBe("medium");
  });
});

describe("lookupCosing", () => {
  it("returns undefined for empty input", () => {
    expect(lookupCosing("")).toBeUndefined();
  });

  it("is deterministic", () => {
    // Whatever the dataset holds for this name, the same input must resolve the
    // same way every time (no hidden state).
    expect(lookupCosing("glycerin")).toEqual(lookupCosing("glycerin"));
  });
});
