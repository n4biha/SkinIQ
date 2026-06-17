import { describe, it, expect } from "vitest";
import { normalizeName, normalizeConcernKey } from "@/lib/ingredients/normalize";

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

describe("normalizeConcernKey", () => {
  it("collapses variants of the same concern to one key", () => {
    const key = "dark spots";
    expect(normalizeConcernKey("Dark Spots")).toBe(key);
    expect(normalizeConcernKey("dark-spots")).toBe(key);
    expect(normalizeConcernKey("  DARK   SPOTS  ")).toBe(key);
  });

  it("lowercases, trims, and strips punctuation", () => {
    expect(normalizeConcernKey("Fine-Lines!")).toBe("fine lines");
    expect(normalizeConcernKey("Acne")).toBe("acne");
  });

  it("collapses case/punctuation/whitespace variants of a custom concern to one key", () => {
    expect(normalizeConcernKey("Texture")).toBe("texture");
    expect(normalizeConcernKey("  texture ")).toBe("texture");
    expect(normalizeConcernKey("texture!")).toBe("texture");
  });

  it("does NOT do semantic matching — 'skin texture' stays distinct from 'texture'", () => {
    expect(normalizeConcernKey("skin texture")).toBe("skin texture");
    expect(normalizeConcernKey("skin texture")).not.toBe(normalizeConcernKey("texture"));
  });
});
