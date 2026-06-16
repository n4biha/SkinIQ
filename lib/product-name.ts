/**
 * Product name resolution for a scan (pure, testable).
 *
 * When the front photo doesn't yield a name, we still want something better than
 * "Scanned product". `categoryPlaceholder` guesses a broad product category from
 * the ingredient list (best-effort, never harmfully wrong), e.g. "Moisturizer
 * (unnamed)". The user can always rename on the report afterwards.
 */

import { normalizeName } from "@/lib/ingredients/normalize";

// High-precision signals. Order matters in categoryPlaceholder (sunscreen wins).
const UV_FILTERS = [
  "zinc oxide",
  "titanium dioxide",
  "avobenzone",
  "octinoxate",
  "ethylhexyl methoxycinnamate",
  "octocrylene",
  "homosalate",
  "octisalate",
  "ethylhexyl salicylate",
  "tinosorb",
  "uvinul",
];
const SURFACTANTS = [
  "sulfate",
  "sulfosuccinate",
  "cocamidopropyl betaine",
  "glucoside",
  "cocoyl isethionate",
  "sarcosinate",
];

/** A broad product category for an "(unnamed)" placeholder, from the ingredients. */
export function categoryPlaceholder(ingredients: string[]): string {
  const hay = ingredients.map(normalizeName).join(" | ");
  if (UV_FILTERS.some((t) => hay.includes(t))) return "Sunscreen (unnamed)";
  if (SURFACTANTS.some((t) => hay.includes(t))) return "Cleanser (unnamed)";
  return "Moisturizer (unnamed)";
}

/**
 * Name to save at scan time: a front-extracted name wins; otherwise a category
 * placeholder. ("Scanned product" is only an absolute last resort, handled by the
 * caller if there are somehow no ingredients.)
 */
export function resolveScanName(
  frontName: string | null,
  ingredients: string[],
): string {
  const n = frontName?.trim();
  if (n) return n;
  return categoryPlaceholder(ingredients);
}
