/**
 * Tier 1 — curated ingredient map.
 *
 * Hand-vetted key actives with GRADED judgments: how strongly each helps a
 * concern (strong/moderate) and its irritation risk. Checked first; if an
 * ingredient is here, these values win.
 */

import type { IngredientInfo } from "@/lib/ingredients/types";
import { normalizeName } from "@/lib/ingredients/normalize";

const CURATED: Record<string, IngredientInfo> = {
  niacinamide: {
    display: "Niacinamide",
    function: "Oil control, brightening",
    helps: { oiliness: "strong", acne: "moderate", pores: "moderate", "dark-spots": "moderate", redness: "moderate" },
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    note: "Vitamin B3 — regulates sebum and supports the skin barrier.",
  },
  "zinc pca": {
    display: "Zinc PCA",
    function: "Sebum balancing",
    helps: { oiliness: "strong", acne: "moderate" },
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    note: "Helps reduce congestion and shine.",
  },
  "salicylic acid": {
    display: "Salicylic acid",
    function: "Exfoliating BHA",
    helps: { acne: "strong", pores: "strong", oiliness: "moderate" },
    irritation: "medium",
    comedogenic: 0,
    fragrance: false,
    note: "Oil-soluble exfoliant that clears pores; can be drying.",
  },
  "benzoyl peroxide": {
    display: "Benzoyl peroxide",
    function: "Acne treatment",
    helps: { acne: "strong" },
    irritation: "high",
    comedogenic: 0,
    fragrance: false,
    note: "Targets acne bacteria; can irritate and bleach fabric.",
  },
  retinol: {
    display: "Retinol",
    function: "Cell turnover, anti-aging",
    helps: { "fine-lines": "strong", acne: "moderate", "dark-spots": "moderate" },
    irritation: "high",
    comedogenic: 0,
    fragrance: false,
    note: "Vitamin A derivative; powerful but can irritate — ease in slowly.",
  },
  retinal: {
    display: "Retinal",
    function: "Cell turnover, anti-aging",
    helps: { "fine-lines": "strong", acne: "moderate", "dark-spots": "moderate" },
    irritation: "high",
    comedogenic: 0,
    fragrance: false,
    note: "A faster-acting retinoid; can irritate sensitive skin.",
  },
  "ascorbic acid": {
    display: "Vitamin C (ascorbic acid)",
    function: "Antioxidant, brightening",
    helps: { "dark-spots": "strong", "fine-lines": "moderate" },
    irritation: "low",
    comedogenic: 0,
    fragrance: false,
    note: "Brightens and protects against environmental damage.",
  },
  "azelaic acid": {
    display: "Azelaic acid",
    function: "Brightening, calming",
    helps: { redness: "strong", acne: "moderate", "dark-spots": "moderate" },
    irritation: "low",
    comedogenic: 0,
    fragrance: false,
    note: "Gentle multitasker — good for redness, breakouts and marks.",
  },
  "alpha arbutin": {
    display: "Alpha arbutin",
    function: "Brightening",
    helps: { "dark-spots": "strong" },
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    note: "Targets dark spots and uneven tone gently.",
  },
  "kojic acid": {
    display: "Kojic acid",
    function: "Brightening",
    helps: { "dark-spots": "strong" },
    irritation: "low",
    comedogenic: 0,
    fragrance: false,
    note: "Fades pigmentation; can sensitize over time.",
  },
  "glycolic acid": {
    display: "Glycolic acid",
    function: "Exfoliating AHA",
    helps: { "dark-spots": "strong", "fine-lines": "moderate", pores: "moderate" },
    irritation: "high",
    comedogenic: 0,
    fragrance: false,
    note: "Surface exfoliant; smooths and brightens but can irritate.",
  },
  "lactic acid": {
    display: "Lactic acid",
    function: "Exfoliating AHA",
    helps: { "dark-spots": "moderate", "fine-lines": "moderate", dryness: "moderate" },
    irritation: "medium",
    comedogenic: 0,
    fragrance: false,
    note: "A milder AHA that also helps hydrate.",
  },
  "hyaluronic acid": {
    display: "Hyaluronic acid",
    function: "Hydration",
    helps: { dryness: "strong" },
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    note: "Humectant that holds water in the skin.",
  },
  glycerin: {
    display: "Glycerin",
    function: "Humectant",
    helps: { dryness: "strong" },
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    note: "Draws in moisture; well tolerated by most skin.",
  },
  ceramide: {
    display: "Ceramides",
    function: "Barrier repair",
    helps: { dryness: "strong", sensitivity: "moderate" },
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    note: "Restores the skin barrier and reduces moisture loss.",
  },
  squalane: {
    display: "Squalane",
    function: "Emollient",
    helps: { dryness: "moderate" },
    irritation: "none",
    comedogenic: 1,
    fragrance: false,
    note: "Lightweight, non-greasy moisture; suits most skin.",
  },
  panthenol: {
    display: "Panthenol",
    function: "Soothing, hydration",
    helps: { sensitivity: "moderate", dryness: "moderate", redness: "moderate" },
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    note: "Pro-vitamin B5 — calms and hydrates.",
  },
  allantoin: {
    display: "Allantoin",
    function: "Soothing",
    helps: { sensitivity: "moderate", redness: "moderate" },
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    note: "Calms and conditions irritated skin.",
  },
  "centella asiatica": {
    display: "Centella asiatica (cica)",
    function: "Calming, barrier support",
    helps: { redness: "strong", sensitivity: "moderate" },
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    note: "Soothes redness and supports healing.",
  },
  "tamarindus indica seed gum": {
    display: "Tamarindus Indica Seed Gum",
    function: "Texture / hydration",
    helps: {},
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    note: "Plant-derived thickener, generally well tolerated.",
  },
  "pentylene glycol": {
    display: "Pentylene Glycol",
    function: "Humectant",
    helps: {},
    irritation: "low",
    comedogenic: 0,
    fragrance: false,
    note: "Draws in water; can mildly sensitize a small number of people.",
  },
  phenoxyethanol: {
    display: "Phenoxyethanol",
    function: "Preservative",
    helps: {},
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    note: "Common, low-risk preservative.",
  },
  "alcohol denat": {
    display: "Alcohol denat.",
    function: "Solvent / astringent",
    helps: {},
    irritation: "high",
    comedogenic: 0,
    fragrance: false,
    note: "Denatured alcohol — can dry out and irritate sensitive skin.",
  },
  "coconut oil": {
    display: "Coconut oil",
    function: "Emollient",
    helps: { dryness: "moderate" },
    irritation: "none",
    comedogenic: 4,
    fragrance: false,
    note: "Rich moisture but highly pore-clogging for acne-prone skin.",
  },
  fragrance: {
    display: "Fragrance (parfum)",
    function: "Scent",
    helps: {},
    irritation: "medium",
    comedogenic: 0,
    fragrance: true,
    note: "Added scent — a common trigger for sensitive, reactive skin.",
  },
  limonene: {
    display: "Limonene",
    function: "Fragrance component",
    helps: {},
    irritation: "medium",
    comedogenic: 0,
    fragrance: true,
    note: "Citrus-scented fragrance allergen.",
  },
  linalool: {
    display: "Linalool",
    function: "Fragrance component",
    helps: {},
    irritation: "medium",
    comedogenic: 0,
    fragrance: true,
    note: "Floral fragrance allergen.",
  },
  citral: {
    display: "Citral",
    function: "Fragrance component",
    helps: {},
    irritation: "medium",
    comedogenic: 0,
    fragrance: true,
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

  for (const key of Object.keys(CURATED)) {
    if (name.includes(key)) return CURATED[key];
  }

  for (const [needle, key] of SYNONYMS) {
    if (name.includes(needle)) return CURATED[key];
  }

  return undefined;
}
