import { describe, it, expect } from "vitest";
import { lookupCurated } from "@/lib/ingredients/curated";

describe("lookupCurated", () => {
  it("returns graded info for a known active", () => {
    const info = lookupCurated("Niacinamide");
    expect(info).toBeDefined();
    expect(info?.helps.oiliness).toBe("strong");
    expect(info?.irritation).toBe("none");
    expect(info?.fragrance).toBe(false);
  });

  it("is insensitive to case and percentages", () => {
    expect(lookupCurated("NIACINAMIDE 10%")?.display).toBe(
      lookupCurated("niacinamide")?.display,
    );
  });

  it("grades salicylic acid as a medium irritant that helps acne", () => {
    const info = lookupCurated("Salicylic Acid");
    expect(info?.irritation).toBe("medium");
    expect(info?.helps.acne).toBe("strong");
  });

  it("returns undefined for unknown ingredients", () => {
    expect(lookupCurated("Totally Made Up Xyz")).toBeUndefined();
  });
});
