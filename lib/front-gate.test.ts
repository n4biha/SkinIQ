import { describe, it, expect } from "vitest";
import { gateFront } from "@/lib/front-gate";
import type { FrontReading } from "@/lib/types";

function front(p: Partial<FrontReading>): FrontReading {
  return {
    isProductFront: false,
    frontRejectReason: null,
    productName: null,
    category: "other",
    ...p,
  };
}

describe("gateFront", () => {
  it("rejects a non-product image — and never yields a name from it", () => {
    const out = gateFront(
      front({
        isProductFront: false,
        frontRejectReason: "This looks like a photo of a person, not a product.",
        productName: "Made Up Brand", // present, but must be discarded on reject
      }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("This looks like a photo of a person, not a product.");
    }
    // The reject result has no productName at all — a face can't name a product.
    expect("productName" in out).toBe(false);
  });

  it("passes a product front with a readable name", () => {
    const out = gateFront(
      front({ isProductFront: true, productName: "CeraVe Moisturizing Lotion" }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.productName).toBe("CeraVe Moisturizing Lotion");
  });

  it("passes a product front with no legible name (productName null)", () => {
    const out = gateFront(front({ isProductFront: true, productName: null }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.productName).toBeNull();
  });

  it("treats a blank name as null", () => {
    const out = gateFront(front({ isProductFront: true, productName: "   " }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.productName).toBeNull();
  });

  it("carries the category through on a product front", () => {
    const out = gateFront(front({ isProductFront: true, category: "serum" }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.category).toBe("serum");
  });

  it("never yields a category from a rejected (non-product) front", () => {
    const out = gateFront(front({ isProductFront: false, category: "serum" }));
    expect(out.ok).toBe(false);
    // reject result has no category at all — the route falls back to "other".
    expect("category" in out).toBe(false);
  });
});
