import { describe, it, expect } from "vitest";
import { categoryPlaceholder, resolveScanName } from "@/lib/product-name";

describe("categoryPlaceholder", () => {
  it("detects sunscreen from UV filters", () => {
    expect(categoryPlaceholder(["Aqua", "Zinc Oxide", "Glycerin"])).toBe(
      "Sunscreen (unnamed)",
    );
  });

  it("detects a cleanser from surfactants", () => {
    expect(
      categoryPlaceholder(["Aqua", "Sodium Laureth Sulfate", "Cocamidopropyl Betaine"]),
    ).toBe("Cleanser (unnamed)");
  });

  it("defaults to moisturizer", () => {
    expect(categoryPlaceholder(["Aqua", "Glycerin", "Niacinamide"])).toBe(
      "Moisturizer (unnamed)",
    );
  });
});

describe("resolveScanName", () => {
  it("prefers a front-extracted name", () => {
    expect(resolveScanName("The Ordinary Niacinamide 10%", ["Aqua", "Zinc Oxide"])).toBe(
      "The Ordinary Niacinamide 10%",
    );
  });

  it("falls back to the category placeholder when there's no name", () => {
    expect(resolveScanName(null, ["Aqua", "Zinc Oxide"])).toBe("Sunscreen (unnamed)");
  });

  it("treats a blank front name as no name", () => {
    expect(resolveScanName("   ", ["Aqua", "Glycerin"])).toBe("Moisturizer (unnamed)");
  });
});
