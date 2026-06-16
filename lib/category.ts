/**
 * Product-category helpers (pure).
 *
 * `coerceCategory` is the single raw→enum mapper: anything the model (or DB)
 * hands us that isn't a known category becomes "other" rather than throwing.
 * `CATEGORY_LABELS` is the display text for the small category chip/label.
 */

import { ProductCategorySchema, type ProductCategory } from "@/lib/types";

/** Map any value to a valid ProductCategory, defaulting to "other". */
export function coerceCategory(value: unknown): ProductCategory {
  const parsed = ProductCategorySchema.safeParse(value);
  return parsed.success ? parsed.data : "other";
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  cleanser: "Cleanser",
  toner: "Toner",
  serum: "Serum",
  treatment: "Treatment",
  moisturizer: "Moisturizer",
  sunscreen: "Sunscreen",
  other: "Other",
};
