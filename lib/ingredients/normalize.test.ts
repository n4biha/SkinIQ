import { describe, it, expect } from "vitest";
import { normalizeName } from "@/lib/ingredients/normalize";

describe("normalizeName", () => {
  it("lowercases and trims", () => {
    expect(normalizeName("  Sodium Hyaluronate  ")).toBe("sodium hyaluronate");
  });

  it("drops percentages", () => {
    expect(normalizeName("Niacinamide 10%")).toBe("niacinamide");
  });

  it("drops parentheticals", () => {
    expect(normalizeName("Aqua (Water)")).toBe("aqua");
  });

  it("turns punctuation into spaces and collapses", () => {
    expect(normalizeName("Tocopheryl-Acetate")).toBe("tocopheryl acetate");
  });

  it("handles a messy real-world label", () => {
    expect(normalizeName("Vitamin C (L-Ascorbic Acid) 20%")).toBe("vitamin c");
  });
});
