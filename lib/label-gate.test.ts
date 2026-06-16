import { describe, it, expect } from "vitest";
import { gateLabel } from "@/lib/label-gate";
import type { LabelReading } from "@/lib/types";

/** Build a LabelReading literal for the gate (notes default to []). */
function label(p: Partial<LabelReading>): LabelReading {
  return {
    productName: "",
    ingredients: [],
    isIngredientList: true,
    rejectReason: null,
    notes: [],
    ...p,
  };
}

describe("gateLabel", () => {
  it("rejects a non-label image with the model's reason", () => {
    const out = gateLabel(
      label({
        isIngredientList: false,
        rejectReason: "This looks like a photo of a person, not a product label.",
        ingredients: [],
      }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("This looks like a photo of a person, not a product label.");
    }
  });

  it("rejects when no ingredients were read, even if flagged a list", () => {
    const out = gateLabel(label({ isIngredientList: true, ingredients: [] }));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("We couldn't find an ingredient list in this photo.");
    }
  });

  it("falls back to a default reason when the model gives none", () => {
    const out = gateLabel(
      label({ isIngredientList: false, rejectReason: null, ingredients: [] }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("We couldn't find an ingredient list in this photo.");
    }
  });

  it("passes a real ingredient list through", () => {
    const out = gateLabel(
      label({ isIngredientList: true, ingredients: ["Aqua", "Glycerin", "Niacinamide"] }),
    );
    expect(out.ok).toBe(true);
  });
});
