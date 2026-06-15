/**
 * SkinIQ scoring engine.
 *
 * THE RULES LIVE HERE. The overall match score and per-concern percentages are
 * computed deterministically from the resolved, GRADED ingredient assessments
 * (helps: strong/moderate per concern; irritation: none/low/medium/high) + the
 * user's profile. The model grades ingredients; it never sets a number. Same
 * inputs -> identical output (pure, synchronous, no I/O).
 *
 * Calibrated to grade strictly: products only earn high scores when they have
 * strong actives for the concerns the user actually selected and few negatives.
 */

import type {
  Concern,
  ConcernScore,
  HelpStrength,
  IngredientNote,
  IrritationRisk,
  SkinProfile,
  Verdict,
} from "@/lib/types";
import type { ResolvedIngredient } from "@/lib/ingredients/types";
import { normalizeName } from "@/lib/ingredients/normalize";

/* ------------------------------------------------------------------ */
/* Canonical concern model                                             */
/* ------------------------------------------------------------------ */

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

const CONCERN_ORDER: Concern[] = [
  "acne",
  "oiliness",
  "redness",
  "pores",
  "dryness",
  "dark-spots",
  "sensitivity",
  "fine-lines",
];

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

/** The concerns the user explicitly selected (deduped, canonical). */
function selectedConcerns(profile: SkinProfile): Concern[] {
  const set = new Set<Concern>();
  for (const raw of profile.concerns) {
    const c = normalizeConcern(raw);
    if (c) set.add(c);
  }
  return CONCERN_ORDER.filter((c) => set.has(c));
}

/**
 * Concerns to DISPLAY as bars: the user's selections plus skin-type-implied ones,
 * so the bars stay meaningful. (Scoring rewards only the explicit selections.)
 */
function displayConcerns(profile: SkinProfile): Concern[] {
  const set = new Set<Concern>(selectedConcerns(profile));
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
    default:
      break;
  }
  // Sensitivity is a trait, not a skin type — surface its bar when the user
  // flagged sensitive skin.
  if (profile.sensitive) set.add("sensitivity");
  if (set.size === 0) return ["acne", "oiliness", "redness", "pores", "sensitivity"];
  return CONCERN_ORDER.filter((c) => set.has(c));
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export type ScoringResult = {
  overallScore: number;
  verdict: Verdict;
  concernScores: ConcernScore[];
  ingredients: IngredientNote[];
};

type MatchedIngredient = {
  raw: string;
  info: ResolvedIngredient["info"];
  isAllergyHit: boolean;
};

const RISK_RANK: Record<IrritationRisk, number> = { none: 0, low: 1, medium: 2, high: 3 };

/** Strongest help any ingredient offers for a concern (or null if none). */
function bestHelp(matched: MatchedIngredient[], concern: Concern): HelpStrength | null {
  let best: HelpStrength | null = null;
  for (const m of matched) {
    const s = m.info?.helps[concern];
    if (s === "strong") return "strong";
    if (s === "moderate") best = "moderate";
  }
  return best;
}

function maxIrritation(matched: MatchedIngredient[]): IrritationRisk {
  let worst: IrritationRisk = "none";
  for (const m of matched) {
    if (m.info && RISK_RANK[m.info.irritation] > RISK_RANK[worst]) worst = m.info.irritation;
  }
  return worst;
}

function irritationPenalty(risk: IrritationRisk, sensitive: boolean): number {
  switch (risk) {
    case "high":
      return sensitive ? 2.5 : 1.5;
    case "medium":
      return sensitive ? 1.5 : 0.75;
    case "low":
      return sensitive ? 0.5 : 0;
    default:
      return 0;
  }
}

function isAllergyHit(name: string, allergies: string[]): boolean {
  const n = normalizeName(name);
  return allergies.some((a) => {
    const t = normalizeName(a);
    return t.length > 0 && (n.includes(t) || t.includes(n));
  });
}

function verdictFor(score: number): Verdict {
  if (score >= 8) return "Good Match";
  if (score >= 5.5) return "Fair Match";
  return "Poor Match";
}

/**
 * Compute the deterministic parts of a Report from the resolved (graded)
 * ingredients + profile. Pure: same inputs -> identical output.
 */
export function scoreProduct(
  profile: SkinProfile,
  resolved: ResolvedIngredient[],
): ScoringResult {
  const allergies = profile.allergies ?? [];
  const selected = selectedConcerns(profile);
  const display = displayConcerns(profile);
  // Score against explicit selections; fall back to the display set if none.
  const scoredConcerns = selected.length ? selected : display;
  const selectedSet = new Set(scoredConcerns);

  const sensitiveSkin =
    profile.sensitive ||
    selectedSet.has("sensitivity") ||
    selectedSet.has("redness");
  const acneProne =
    selectedSet.has("acne") ||
    profile.skinType === "oily" ||
    profile.skinType === "combination";

  const matched: MatchedIngredient[] = resolved.map((r) => ({
    raw: r.raw,
    info: r.info,
    isAllergyHit: isAllergyHit(r.raw, allergies),
  }));

  const worstIrritation = maxIrritation(matched);
  const hasFragrance = matched.some((m) => m.info?.fragrance);
  const maxComedogenic = matched.reduce(
    (max, m) => Math.max(max, m.info?.comedogenic ?? 0),
    0,
  );
  const allergyHits = matched.filter((m) => m.isAllergyHit).length;

  /* ---- Overall score (0–10) ---- */
  let score = 5.0;

  // Reward strong/moderate help for selected concerns; penalize ignored ones.
  for (const concern of scoredConcerns) {
    const best = bestHelp(matched, concern);
    score += best === "strong" ? 1.5 : best === "moderate" ? 0.75 : -1.0;
  }

  score -= irritationPenalty(worstIrritation, sensitiveSkin);
  if (hasFragrance) score -= sensitiveSkin ? 2.0 : 1.0;
  if (acneProne) {
    if (maxComedogenic >= 4) score -= 1.5;
    else if (maxComedogenic >= 2) score -= 0.75;
  }
  score -= allergyHits * 4.0;

  score = Math.round(clamp(score, 0, 10) * 10) / 10;
  const verdict = verdictFor(score);

  /* ---- Per-concern percentages (display set) ---- */
  const concernScores: ConcernScore[] = display.map((concern) => {
    let percent = 30;
    const best = bestHelp(matched, concern);
    if (best === "strong") percent += 35;
    else if (best === "moderate") percent += 20;

    if (
      (concern === "sensitivity" || concern === "redness") &&
      (RISK_RANK[worstIrritation] >= RISK_RANK.medium || hasFragrance)
    ) {
      percent -= 20;
    }
    if (allergyHits > 0) percent -= 25;

    return { label: CONCERN_LABELS[concern], percent: Math.round(clamp(percent, 5, 95)) };
  });

  /* ---- Per-ingredient notes + flags ---- */
  const ingredients: IngredientNote[] = matched.map((m) => {
    const info = m.info;
    const benefitsUser =
      !!info && Object.keys(info.helps).some((c) => selectedSet.has(c as Concern));
    const isCaution =
      !!info &&
      (RISK_RANK[info.irritation] >= RISK_RANK.medium ||
        (info.fragrance && sensitiveSkin) ||
        (info.comedogenic >= 3 && acneProne));

    let flag: IngredientNote["flag"];
    if (m.isAllergyHit) flag = "flag";
    else if (benefitsUser) flag = "good";
    else if (isCaution) flag = "caution";

    return {
      name: info?.display ?? m.raw,
      function: info?.function ?? "Unrecognized ingredient",
      note: m.isAllergyHit
        ? "Matches one of your listed allergies — avoid."
        : info?.note ?? "Not in our reference set yet.",
      ...(flag ? { flag } : {}),
    };
  });

  return { overallScore: score, verdict, concernScores, ingredients };
}
