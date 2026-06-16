/**
 * Demo report fixture so the results screen renders fully before the real
 * pipeline is wired. Conforms to the shared `Report` type (lib/types.ts).
 * Retired in B6 once /api/analyze produces real reports (kept for tests).
 */

import type { Report } from "@/lib/types";

export const MOCK_REPORT: Report = {
  id: "sample",
  productName: "The Ordinary Niacinamide 10% + Zinc 1%",
  scannedOn: "June 11, 2026",
  overallScore: 8.6,
  verdict: "Good Match",
  category: "serum",
  summary: "Good match for your skin",
  highlights: [
    "Niacinamide helps regulate oil and calm breakouts",
    "Zinc supports clearer, less congested skin",
    "Fragrance-free — kinder to sensitive, reactive skin",
    "Lightweight, water-based texture suits combination skin",
  ],
  cautions: [
    "High niacinamide % can tingle on very sensitive skin",
    "Patch-test before adding to your full routine",
  ],
  benefits: [
    "Visibly reduces the look of enlarged pores over time",
    "Balances excess shine through the day",
    "Helps even out post-blemish marks",
  ],
  concernScores: [
    { label: "Acne", percent: 90 },
    { label: "Oiliness", percent: 85 },
    { label: "Redness", percent: 70 },
    { label: "Pores", percent: 60 },
    { label: "Sensitivity", percent: 45 },
  ],
  ingredients: [
    {
      name: "Niacinamide",
      function: "Oil control, brightening",
      note: "Vitamin B3 — regulates sebum and supports the skin barrier.",
      flag: "good",
    },
    {
      name: "Zinc PCA",
      function: "Sebum balancing",
      note: "Helps reduce congestion and shine.",
      flag: "good",
    },
    {
      name: "Tamarindus Indica Seed Gum",
      function: "Texture / hydration",
      note: "Plant-derived thickener, generally well tolerated.",
    },
    {
      name: "Pentylene Glycol",
      function: "Humectant",
      note: "Draws in water; can mildly sensitize a small number of people.",
      flag: "caution",
    },
    {
      name: "Phenoxyethanol",
      function: "Preservative",
      note: "Common, low-risk preservative.",
    },
  ],
  howToUse:
    "Apply a few drops to clean, dry skin once daily — start in the evening. " +
    "Follow with moisturizer, and use sunscreen each morning. If you are new to " +
    "niacinamide, begin every other day and build up as your skin adjusts.",
};
