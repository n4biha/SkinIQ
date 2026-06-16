import { describe, it, expect } from "vitest";
import { coerceCategory } from "@/lib/category";
import { ProductCategorySchema } from "@/lib/types";

describe("coerceCategory", () => {
  it("passes every valid category through unchanged", () => {
    for (const c of ProductCategorySchema.options) {
      expect(coerceCategory(c)).toBe(c);
    }
  });

  it("falls back to 'other' for unknown / garbage / null / non-strings", () => {
    expect(coerceCategory("lipstick")).toBe("other");
    expect(coerceCategory("")).toBe("other");
    expect(coerceCategory(null)).toBe("other");
    expect(coerceCategory(undefined)).toBe("other");
    expect(coerceCategory(42)).toBe("other");
    expect(coerceCategory({})).toBe("other");
  });
});
