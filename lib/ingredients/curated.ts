/**
 * Tier 1 — curated ingredient map (Phase B+).
 *
 * A small, hand-vetted set of key actives whose skin-concern relevance we trust
 * more than any automated source. Checked first; if an ingredient is here, these
 * values win. Lifted unchanged from the original scoring.ts built-in map.
 */

import type { IngredientInfo } from "@/lib/ingredients/types";
import { normalizeName } from "@/lib/ingredients/normalize";

const CURATED: Record<string, IngredientInfo> = {
  niacinamide: {
    display: "Niacinamide",
    function: "Oil control, brightening",
    benefitsFor: ["oiliness", "acne", "pores", "dark-spots", "redness"],
    comedogenic: 0,
    note: "Vitamin B3 — regulates sebum and supports the skin barrier.",
  },
  "zinc pca": {
    display: "Zinc PCA",
    function: "Sebum balancing",
    benefitsFor: ["oiliness", "acne"],
    comedogenic: 0,
    note: "Helps reduce congestion and shine.",
  },
  "salicylic acid": {
    display: "Salicylic acid",
    function: "Exfoliating BHA",
    benefitsFor: ["acne", "pores", "oiliness"],
    comedogenic: 0,
    isIrritant: true,
    note: "Oil-soluble exfoliant that clears pores; can be drying.",
  },
  "benzoyl peroxide": {
    display: "Benzoyl peroxide",
    function: "Acne treatment",
    benefitsFor: ["acne"],
    comedogenic: 0,
    isIrritant: true,
    note: "Targets acne bacteria; can irritate and bleach fabric.",
  },
  retinol: {
    display: "Retinol",
    function: "Cell turnover, anti-aging",
    benefitsFor: ["fine-lines", "acne", "dark-spots"],
    comedogenic: 0,
    isIrritant: true,
    note: "Vitamin A derivative; powerful but can irritate — ease in slowly.",
  },
  retinal: {
    display: "Retinal",
    function: "Cell turnover, anti-aging",
    benefitsFor: ["fine-lines", "acne", "dark-spots"],
    comedogenic: 0,
    isIrritant: true,
    note: "A faster-acting retinoid; can irritate sensitive skin.",
  },
  "ascorbic acid": {
    display: "Vitamin C (ascorbic acid)",
    function: "Antioxidant, brightening",
    benefitsFor: ["dark-spots", "fine-lines"],
    comedogenic: 0,
    note: "Brightens and protects against environmental damage.",
  },
  "azelaic acid": {
    display: "Azelaic acid",
    function: "Brightening, calming",
    benefitsFor: ["redness", "acne", "dark-spots"],
    comedogenic: 0,
    note: "Gentle multitasker — good for redness, breakouts and marks.",
  },
  "alpha arbutin": {
    display: "Alpha arbutin",
    function: "Brightening",
    benefitsFor: ["dark-spots"],
    comedogenic: 0,
    note: "Targets dark spots and uneven tone gently.",
  },
  "kojic acid": {
    display: "Kojic acid",
    function: "Brightening",
    benefitsFor: ["dark-spots"],
    comedogenic: 0,
    note: "Fades pigmentation; can sensitize over time.",
  },
  "glycolic acid": {
    display: "Glycolic acid",
    function: "Exfoliating AHA",
    benefitsFor: ["dark-spots", "fine-lines", "pores"],
    comedogenic: 0,
    isIrritant: true,
    note: "Surface exfoliant; smooths and brightens but can irritate.",
  },
  "lactic acid": {
    display: "Lactic acid",
    function: "Exfoliating AHA",
    benefitsFor: ["dark-spots", "fine-lines", "dryness"],
    comedogenic: 0,
    isIrritant: true,
    note: "A milder AHA that also helps hydrate.",
  },
  "hyaluronic acid": {
    display: "Hyaluronic acid",
    function: "Hydration",
    benefitsFor: ["dryness"],
    comedogenic: 0,
    note: "Humectant that holds water in the skin.",
  },
  glycerin: {
    display: "Glycerin",
    function: "Humectant",
    benefitsFor: ["dryness"],
    comedogenic: 0,
    note: "Draws in moisture; well tolerated by most skin.",
  },
  ceramide: {
    display: "Ceramides",
    function: "Barrier repair",
    benefitsFor: ["dryness", "sensitivity"],
    comedogenic: 0,
    note: "Restores the skin barrier and reduces moisture loss.",
  },
  squalane: {
    display: "Squalane",
    function: "Emollient",
    benefitsFor: ["dryness"],
    comedogenic: 1,
    note: "Lightweight, non-greasy moisture; suits most skin.",
  },
  panthenol: {
    display: "Panthenol",
    function: "Soothing, hydration",
    benefitsFor: ["sensitivity", "dryness", "redness"],
    comedogenic: 0,
    note: "Pro-vitamin B5 — calms and hydrates.",
  },
  allantoin: {
    display: "Allantoin",
    function: "Soothing",
    benefitsFor: ["sensitivity", "redness"],
    comedogenic: 0,
    note: "Calms and conditions irritated skin.",
  },
  "centella asiatica": {
    display: "Centella asiatica (cica)",
    function: "Calming, barrier support",
    benefitsFor: ["redness", "sensitivity"],
    comedogenic: 0,
    note: "Soothes redness and supports healing.",
  },
  "tamarindus indica seed gum": {
    display: "Tamarindus Indica Seed Gum",
    function: "Texture / hydration",
    benefitsFor: [],
    comedogenic: 0,
    note: "Plant-derived thickener, generally well tolerated.",
  },
  "pentylene glycol": {
    display: "Pentylene Glycol",
    function: "Humectant",
    benefitsFor: [],
    comedogenic: 0,
    note: "Draws in water; can mildly sensitize a small number of people.",
  },
  phenoxyethanol: {
    display: "Phenoxyethanol",
    function: "Preservative",
    benefitsFor: [],
    comedogenic: 0,
    note: "Common, low-risk preservative.",
  },
  "alcohol denat": {
    display: "Alcohol denat.",
    function: "Solvent / astringent",
    benefitsFor: [],
    comedogenic: 0,
    isIrritant: true,
    note: "Denatured alcohol — can dry out and irritate sensitive skin.",
  },
  "coconut oil": {
    display: "Coconut oil",
    function: "Emollient",
    benefitsFor: ["dryness"],
    comedogenic: 4,
    note: "Rich moisture but highly pore-clogging for acne-prone skin.",
  },
  fragrance: {
    display: "Fragrance (parfum)",
    function: "Scent",
    benefitsFor: [],
    comedogenic: 0,
    isFragrance: true,
    note: "Added scent — a common trigger for sensitive, reactive skin.",
  },
  limonene: {
    display: "Limonene",
    function: "Fragrance component",
    benefitsFor: [],
    comedogenic: 0,
    isFragrance: true,
    note: "Citrus-scented fragrance allergen.",
  },
  linalool: {
    display: "Linalool",
    function: "Fragrance component",
    benefitsFor: [],
    comedogenic: 0,
    isFragrance: true,
    note: "Floral fragrance allergen.",
  },
  citral: {
    display: "Citral",
    function: "Fragrance component",
    benefitsFor: [],
    comedogenic: 0,
    isFragrance: true,
    note: "Lemon-scented fragrance allergen.",
  },
};

/** Synonyms / alternate spellings that resolve to a curated key (substring match). */
const SYNONYMS: Array<[needle: string, key: string]> = [
  ["vitamin c", "ascorbic acid"],
  ["ascorbyl", "ascorbic acid"],
  ["niacin", "niacinamide"],
  ["zinc pca", "zinc pca"],
  ["retinyl", "retinol"],
  ["retinaldehyde", "retinal"],
  ["bha", "salicylic acid"],
  ["centella", "centella asiatica"],
  ["cica", "centella asiatica"],
  ["madecassoside", "centella asiatica"],
  ["ceramide", "ceramide"],
  ["sodium hyaluronate", "hyaluronic acid"],
  ["hyaluron", "hyaluronic acid"],
  ["parfum", "fragrance"],
  ["essential oil", "fragrance"],
  ["alcohol denat", "alcohol denat"],
  ["denatured alcohol", "alcohol denat"],
  ["sd alcohol", "alcohol denat"],
  ["cocos nucifera", "coconut oil"],
];

/** Tier 1 lookup. Returns a curated entry, tolerating synonyms, or undefined. */
export function lookupCurated(raw: string): IngredientInfo | undefined {
  const name = normalizeName(raw);
  if (!name) return undefined;

  if (CURATED[name]) return CURATED[name];

  // Direct curated key as a substring (e.g. "niacinamide" inside a longer string).
  for (const key of Object.keys(CURATED)) {
    if (name.includes(key)) return CURATED[key];
  }

  // Synonyms.
  for (const [needle, key] of SYNONYMS) {
    if (name.includes(needle)) return CURATED[key];
  }

  return undefined;
}
