/**
 * SkinIQ scoring engine (Phase B · B3, refactored in B+).
 *
 * THE RULES LIVE HERE. The overall match score and per-concern percentages are
 * computed deterministically from the resolved ingredient classifications + the
 * user's skin profile. The model never invents a number — the same product +
 * same profile must always produce the same result.
 *
 * Ingredient classification (which concerns an ingredient helps, irritancy, etc.)
 * is resolved upstream by the three-tier resolver (lib/ingredients/resolve.ts)
 * and passed in as `resolved`. This module stays PURE and synchronous: no Date,
 * no Math.random, no I/O, no model calls.
 */

import type { Concern, ConcernScore, IngredientNote, SkinProfile, Verdict } from "@/lib/types";
import type { ResolvedIngredient } from "@/lib/ingredients/types";
import { normalizeName } from "@/lib/ingredients/normalize";

/* ------------------------------------------------------------------ */
/* Canonical concern model                                             */
/* ------------------------------------------------------------------ */

/** Human-friendly label per concern, used for the "Best for your concerns" bars. */
const CONCERN_LABELS: Record<Concern, string> = {
  acne: "Acne",
  oiliness: "Oiliness",
  redness: "Redness",
  pores: "Pores",
  dryness: "Dryness",
  "dark-spots": "Dark spots",
  sensitivity: "Sensitivity",
  "fine-lines": "Fine lines",
};

/** Map the onboarding's free-text concern labels to canonical concerns. */
function normalizeConcern(raw: string): Concern | null {
  const c = raw.trim().toLowerCase();
  if (c.includes("acne") || c.includes("breakout") || c.includes("blemish")) return "acne";
  if (c.includes("oil") || c.includes("shine") || c.includes("sebum")) return "oiliness";
  if (c.includes("red") || c.includes("rosacea")) return "redness";
  if (c.includes("pore")) return "pores";
  if (c.includes("dry") || c.includes("dehydrat") || c.includes("flak")) return "dryness";
  if (c.includes("dark spot") || c.includes("hyperpigment") || c.includes("pigment") ||
      c.includes("uneven") || c.includes("mark")) return "dark-spots";
  if (c.includes("sensitiv") || c.includes("irritat") || c.includes("reactive")) return "sensitivity";
  if (c.includes("fine line") || c.includes("wrinkle") || c.includes("aging") ||
      c.includes("ageing") || c.includes("firm")) return "fine-lines";
  return null;
}

/**
 * Resolve which concerns the report should score for: the user's selected
 * concerns, plus implicit concerns derived from skin type so the bars stay
 * meaningful when the user picked few. Falls back to a default set.
 */
function resolveConcerns(profile: SkinProfile): Concern[] {
  const set = new Set<Concern>();

  for (const raw of profile.concerns) {
    const c = normalizeConcern(raw);
    if (c) set.add(c);
  }

  switch (profile.skinType) {
    case "oily":
      set.add("oiliness");
      set.add("pores");
      break;
    case "combination":
      set.add("oiliness");
      break;
    case "dry":
      set.add("dryness");
      break;
    case "sensitive":
      set.add("sensitivity");
      break;
    default:
      break;
  }

  if (set.size === 0) {
    // No profile signal yet — show a sensible default spread.
    return ["acne", "oiliness", "redness", "pores", "sensitivity"];
  }

  // Stable, readable ordering regardless of insertion order.
  const ORDER: Concern[] = [
    "acne",
    "oiliness",
    "redness",
    "pores",
    "dryness",
    "dark-spots",
    "sensitivity",
    "fine-lines",
  ];
  return ORDER.filter((c) => set.has(c));
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export type ScoringResult = {
  overallScore: number;
  verdict: Verdict;
  concernScores: ConcernScore[];
  /** Per-ingredient classification + flag. `note` text is from the resolver. */
  ingredients: IngredientNote[];
};

type MatchedIngredient = {
  raw: string;
  info: ResolvedIngredient["info"];
  isAllergyHit: boolean;
};

/** Does any user allergy term appear in this ingredient string (either direction)? */
function isAllergyHit(name: string, allergies: string[]): boolean {
  const n = normalizeName(name);
  return allergies.some((a) => {
    const t = normalizeName(a);
    return t.length > 0 && (n.includes(t) || t.includes(n));
  });
}

function verdictFor(score: number): Verdict {
  if (score >= 7) return "Good Match";
  if (score >= 4.5) return "Fair Match";
  return "Poor Match";
}

/**
 * Compute the deterministic parts of a Report from the resolved ingredients +
 * profile. Pure: same inputs -> identical output.
 *
 * @param resolved ingredient classifications from lib/ingredients/resolve.ts,
 *                 aligned 1:1 (same order) with the label's ingredient list.
 */
export function scoreProduct(
  profile: SkinProfile,
  resolved: ResolvedIngredient[],
): ScoringResult {
  const allergies = profile.allergies ?? [];
  const concerns = resolveConcerns(profile);
  const userConcernSet = new Set(concerns);
  const sensitiveSkin =
    profile.skinType === "sensitive" ||
    userConcernSet.has("sensitivity") ||
    userConcernSet.has("redness");
  const acneProne =
    userConcernSet.has("acne") ||
    profile.skinType === "oily" ||
    profile.skinType === "combination";

  const matched: MatchedIngredient[] = resolved.map((r) => ({
    raw: r.raw,
    info: r.info,
    isAllergyHit: isAllergyHit(r.raw, allergies),
  }));

  /* ---- Per-concern percentages ---- */
  const concernScores: ConcernScore[] = concerns.map((concern) => {
    let percent = 40; // neutral baseline

    for (const m of matched) {
      if (m.info?.benefitsFor.includes(concern)) percent += 20;
      // Irritants/fragrance read as worse for the calming concerns.
      if (
        (concern === "sensitivity" || concern === "redness") &&
        (m.info?.isIrritant || m.info?.isFragrance)
      ) {
        percent -= 15;
      }
    }
    if (matched.some((m) => m.isAllergyHit)) percent -= 20;

    return { label: CONCERN_LABELS[concern], percent: Math.round(clamp(percent, 5, 95)) };
  });

  /* ---- Overall score (0–10) ---- */
  let score = 5.0; // neutral starting point

  // Reward each of the user's concerns that at least one ingredient addresses.
  for (const concern of concerns) {
    if (!userConcernSet.has(concern)) continue;
    if (matched.some((m) => m.info?.benefitsFor.includes(concern))) score += 1.0;
  }

  for (const m of matched) {
    if (!m.info) continue;
    if (m.info.isFragrance && sensitiveSkin) score -= 1.0;
    if (m.info.isIrritant && sensitiveSkin) score -= 0.5;
    if (m.info.comedogenic >= 3 && acneProne) score -= 0.5;
  }

  // Hard penalty for any allergen the user listed.
  const allergyHits = matched.filter((m) => m.isAllergyHit).length;
  score -= allergyHits * 3.0;

  score = Math.round(clamp(score, 0, 10) * 10) / 10;
  const verdict = verdictFor(score);

  /* ---- Per-ingredient notes + flags ---- */
  const ingredients: IngredientNote[] = matched.map((m) => {
    const benefitsUser =
      !!m.info && m.info.benefitsFor.some((c) => userConcernSet.has(c));
    const isCaution =
      !!m.info &&
      (((m.info.isIrritant || m.info.isFragrance) && sensitiveSkin) ||
        (m.info.comedogenic >= 3 && acneProne));

    let flag: IngredientNote["flag"];
    if (m.isAllergyHit) flag = "flag";
    else if (benefitsUser) flag = "good";
    else if (isCaution) flag = "caution";

    return {
      name: m.info?.display ?? m.raw,
      function: m.info?.function ?? "Unrecognized ingredient",
      note: m.isAllergyHit
        ? "Matches one of your listed allergies — avoid."
        : m.info?.note ?? "Not in our reference set yet.",
      ...(flag ? { flag } : {}),
    };
  });

  return { overallScore: score, verdict, concernScores, ingredients };
}
