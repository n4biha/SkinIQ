/**
 * Ingredient name normalization, shared by every resolver tier so the same
 * label string resolves consistently everywhere.
 */

/** Lowercase, trim, drop percentages and parentheticals so labels resolve. */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop "(...)" groups
    .replace(/\d+(\.\d+)?\s*%/g, " ") // drop "10%" etc.
    .replace(/[^a-z\s]/g, " ") // punctuation -> space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize a CONCERN label into a stable knowledge-base key (lowercase, trim,
 * punctuation → space, collapse). So "Dark Spots", "dark-spots" and "dark spots"
 * all collapse to one cell.
 *
 * NOTE: this is DISTINCT from scoring's `normalizeConcern`, which maps free text to
 * the canonical Concern enum. This one only produces a storage key.
 */
export function normalizeConcernKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
