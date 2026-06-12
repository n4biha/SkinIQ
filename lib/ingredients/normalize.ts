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
