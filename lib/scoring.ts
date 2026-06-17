/**
 * SkinIQ scoring engine.
 *
 * THE RULES LIVE HERE. The overall match score and per-concern percentages are
 * computed deterministically from the resolved, GRADED ingredients (the three-state
 * knowledge-base `IngredientGrade`: per concern `helps-strong|moderate|slight |
 * neutral | aggravates`, plus `irritation/comedogenic/fragrance/confidence`) + the
 * user's profile. The model grades ingredients; it never sets a number. Same inputs
 * -> identical output (pure, synchronous, no I/O).
 *
 * THREE-STATE RULE: only `helps-*` is rewarded; `aggravates` is penalized; `neutral`
 * (and any concern an ingredient simply doesn't address) is NEVER penalized — a
 * product that does nothing for your concerns sits at the neutral baseline, it isn't
 * dragged down. Contributions are weighted by ingredient POSITION (top of the label =
 * more concentrated = more impact) and the grader's CONFIDENCE. The constants below
 * are FITTED to the calibration set (test/calibration.ts).
 */

import { normalizeName, normalizeConcernKey } from "@/lib/ingredients/normalize";
import type {
  Concern,
  ConcernGrade,
  ConcernScore,
  ConfidenceLevel,
  IngredientGrade,
  IngredientNote,
  IrritationRisk,
  SkinProfile,
  Verdict,
} from "@/lib/types";
import type { ResolvedIngredient } from "@/lib/ingredients/types";

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
/* Scoring constants — FITTED to test/calibration.ts (±0.5)            */
/* ------------------------------------------------------------------ */

const BASELINE = 5.0;

/** Reward magnitude per concern at full weight (top of label, high confidence). */
const HELP_REWARD: Record<ConcernGrade, number> = {
  "helps-strong": 1.9,
  "helps-moderate": 1.0,
  "helps-slight": 0.6,
  neutral: 0,
  aggravates: 0,
};

/**
 * When a concern has more than one helper, the strongest is the primary; each
 * additional helper adds a diminished share (depth bonus — a product stacked with
 * hydrators beats one with a single hydrator).
 */
const DEPTH_WEIGHT = 0.45;

/**
 * Floor for a concern addressed by a MODERATE active: a single moderate helper deep
 * in the list still counts as meaningfully addressing the concern (a strong helper is
 * already rewarded enough on its own; this only lifts the otherwise-thin moderate case).
 */
const ADDRESSED_FLOOR = 1.3;

/** Penalty magnitude when an ingredient actively works AGAINST a relevant concern. */
const AGGRAVATE_PENALTY = 1.3;

/** Position model: top of the label = most concentrated. Drops off quadratically so
 *  actives below the ~1% line (deep in the list) contribute little. */
const POSITION_K = 0.08;
function positionWeight(index: number): number {
  return 1 / (1 + POSITION_K * index * index);
}

/** Confidence discount — a low-confidence grade pulls less weight. */
const CONFIDENCE_WEIGHT: Record<ConfidenceLevel, number> = {
  high: 1.0,
  medium: 0.85,
  low: 0.6,
};

const ALLERGY_PENALTY = 4.0;
const FRAGRANCE_PENALTY = { sensitive: 2.0, default: 0.5 };
/** Cumulative comedogenic penalty (acne-prone only), per ingredient, position-weighted. */
const COMEDOGENIC_PENALTY = { high: 0.9, moderate: 0.45 }; // com >= 4 vs com 2–3

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

const RISK_RANK: Record<IrritationRisk, number> = { none: 0, low: 1, medium: 2, high: 3 };

/** One ingredient prepared for scoring: its grade + label position + derived weights. */
type GradedIngredient = {
  raw: string;
  info: ResolvedIngredient["info"];
  grade: IngredientGrade | undefined;
  posWeight: number;
  confWeight: number;
  isAllergyHit: boolean;
};

/** The three-state grade an ingredient holds for a concern (or `neutral` if absent). */
function gradeFor(g: GradedIngredient, concern: Concern): ConcernGrade {
  return g.grade?.concerns[normalizeConcernKey(concern)] ?? "neutral";
}

const HELP_RANK: Record<ConcernGrade, number> = {
  "helps-strong": 3,
  "helps-moderate": 2,
  "helps-slight": 1,
  neutral: 0,
  aggravates: 0,
};

/** Strongest help grade any ingredient offers for a concern (null if none help). */
function bestHelpGrade(graded: GradedIngredient[], concern: Concern): ConcernGrade | null {
  let best: ConcernGrade | null = null;
  for (const g of graded) {
    const cell = gradeFor(g, concern);
    if (HELP_RANK[cell] > 0 && (best === null || HELP_RANK[cell] > HELP_RANK[best])) best = cell;
  }
  return best;
}

/** Reward for a selected concern: weighted primary helper + diminished depth bonus,
 *  floored when a moderate+ active addresses it. */
function concernReward(graded: GradedIngredient[], concern: Concern): number {
  const contributions: number[] = [];
  for (const g of graded) {
    const value = HELP_REWARD[gradeFor(g, concern)];
    if (value > 0) contributions.push(value * g.posWeight * g.confWeight);
  }
  if (contributions.length === 0) return 0;
  contributions.sort((a, b) => b - a);
  const primary = contributions[0];
  const depth = contributions.slice(1).reduce((sum, v) => sum + v, 0) * DEPTH_WEIGHT;
  let reward = primary + depth;
  // Only lift the thin single-moderate case; a strong helper deep in the list stays
  // position-discounted (that's the whole point of the SA-high/SA-low pair).
  if (bestHelpGrade(graded, concern) === "helps-moderate") reward = Math.max(reward, ADDRESSED_FLOOR);
  return reward;
}

/** Penalty for a concern an ingredient actively aggravates (worst weighted offender). */
function aggravatePenalty(graded: GradedIngredient[], concern: Concern): number {
  let worst = 0;
  for (const g of graded) {
    if (gradeFor(g, concern) === "aggravates") {
      worst = Math.max(worst, AGGRAVATE_PENALTY * g.posWeight * g.confWeight);
    }
  }
  return worst;
}

function irritationPenalty(risk: IrritationRisk, sensitive: boolean): number {
  switch (risk) {
    case "high":
      return sensitive ? 2.5 : 1.5;
    case "medium":
      return sensitive ? 1.5 : 0.5;
    case "low":
      return sensitive ? 0.4 : 0;
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
  // Explicit user-set flag is the primary signal. The rest is a MIGRATION
  // FALLBACK: profiles saved before `acneProne` existed have it false/unset, so
  // we keep the old inference (oily/combination skin, or the Acne concern) for
  // them — this keeps existing users' scores stable.
  const acneProne =
    profile.acneProne ||
    selectedSet.has("acne") ||
    profile.skinType === "oily" ||
    profile.skinType === "combination";

  const graded: GradedIngredient[] = resolved.map((r, index) => ({
    raw: r.raw,
    info: r.info,
    grade: r.grade,
    posWeight: positionWeight(index),
    confWeight: r.grade ? CONFIDENCE_WEIGHT[r.grade.confidence] : 1,
    isAllergyHit: isAllergyHit(r.raw, allergies),
  }));

  // An allergy hit is a hard "avoid"; its −4 subsumes any fragrance/irritation/
  // comedogenic nitpicks, so it's excluded from those aggregates (no double-dip).
  const safe = graded.filter((g) => !g.isAllergyHit);
  const worstIrritation = safe.reduce<IrritationRisk>((worst, g) => {
    const risk = g.grade?.irritation ?? "none";
    return RISK_RANK[risk] > RISK_RANK[worst] ? risk : worst;
  }, "none");
  const hasFragrance = safe.some((g) => g.grade?.fragrance);
  const allergyHits = graded.filter((g) => g.isAllergyHit).length;

  /* ---- Overall score (0–10) ---- */
  let score = BASELINE;

  // Reward helps-* for selected concerns; penalize aggravates. Neutral / unaddressed
  // concerns are NOT penalized — silence is not a negative.
  for (const concern of scoredConcerns) {
    score += concernReward(graded, concern);
    score -= aggravatePenalty(graded, concern);
  }
  // Trait-based: a sensitive user is harmed by anything that aggravates sensitivity
  // or redness, even when they didn't list it as a concern.
  if (profile.sensitive) {
    for (const concern of ["sensitivity", "redness"] as Concern[]) {
      if (!selectedSet.has(concern)) score -= aggravatePenalty(graded, concern);
    }
  }

  score -= irritationPenalty(worstIrritation, sensitiveSkin);
  if (hasFragrance) score -= sensitiveSkin ? FRAGRANCE_PENALTY.sensitive : FRAGRANCE_PENALTY.default;
  if (acneProne) {
    for (const g of safe) {
      const com = g.grade?.comedogenic ?? 0;
      if (com >= 4) score -= COMEDOGENIC_PENALTY.high * g.posWeight;
      else if (com >= 2) score -= COMEDOGENIC_PENALTY.moderate * g.posWeight;
    }
  }
  score -= allergyHits * ALLERGY_PENALTY;

  score = Math.round(clamp(score, 0, 10) * 10) / 10;
  const verdict = verdictFor(score);

  /* ---- Per-concern percentages (display set) ---- */
  const concernScores: ConcernScore[] = display.map((concern) => {
    let percent = 30;
    const best = bestHelpGrade(graded, concern);
    if (best === "helps-strong") percent += 35;
    else if (best === "helps-moderate") percent += 20;
    else if (best === "helps-slight") percent += 10;

    if (
      (concern === "sensitivity" || concern === "redness") &&
      (RISK_RANK[worstIrritation] >= RISK_RANK.medium || hasFragrance)
    ) {
      percent -= 20;
    }
    if (aggravatePenalty(graded, concern) > 0) percent -= 20;
    if (allergyHits > 0) percent -= 25;

    return { label: CONCERN_LABELS[concern], percent: Math.round(clamp(percent, 5, 95)) };
  });

  /* ---- Per-ingredient notes + flags ---- */
  const ingredients: IngredientNote[] = graded.map((g) => {
    const info = g.info;
    const benefitsUser = scoredConcerns.some((c) => HELP_RANK[gradeFor(g, c)] > 0);
    const aggravatesUser =
      scoredConcerns.some((c) => gradeFor(g, c) === "aggravates") ||
      (profile.sensitive &&
        (gradeFor(g, "sensitivity") === "aggravates" || gradeFor(g, "redness") === "aggravates"));
    const isCaution =
      !!g.grade &&
      (aggravatesUser ||
        RISK_RANK[g.grade.irritation] >= RISK_RANK.medium ||
        (g.grade.fragrance && sensitiveSkin) ||
        (g.grade.comedogenic >= 3 && acneProne));

    let flag: IngredientNote["flag"];
    if (g.isAllergyHit) flag = "flag";
    else if (benefitsUser) flag = "good";
    else if (isCaution) flag = "caution";

    return {
      name: info?.display ?? g.raw,
      function: info?.function ?? "Unrecognized ingredient",
      note: g.isAllergyHit
        ? "Matches one of your listed allergies — avoid."
        : info?.note || (g.grade ? "" : "Not in our reference set yet."),
      ...(flag ? { flag } : {}),
    };
  });

  return { overallScore: score, verdict, concernScores, ingredients };
}
