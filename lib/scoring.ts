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
 * more concentrated = more impact) and the grader's CONFIDENCE. The canonical
 * constants are FITTED to the calibration set (test/calibration.ts).
 *
 * CUSTOM CONCERNS: a free-text concern (e.g. "texture") is AI-judged per ingredient
 * exactly like a canonical one and flows through the SAME three-state math — but its
 * contribution is weighted DOWN (`CUSTOM_CONFIDENCE`) because it's unvetted (no
 * calibration case, no curated override behind it). An all-neutral custom concern
 * contributes zero and is never a penalty.
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
import type { CustomConcern, ResolvedIngredient } from "@/lib/ingredients/types";

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
 * The user's CUSTOM (non-canonical) concerns: free-text entries that don't map to a
 * canonical concern. Deduped by normalized key; the label is kept as entered (for the
 * grading prompt + report). Exported so the route can request grades for them before
 * the synchronous scoreProduct runs.
 */
export function extractCustomConcerns(profile: SkinProfile): CustomConcern[] {
  const seen = new Set<string>();
  const out: CustomConcern[] = [];
  for (const raw of profile.concerns) {
    if (normalizeConcern(raw)) continue; // canonical → handled by selectedConcerns
    const key = normalizeConcernKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: raw.trim() });
  }
  return out;
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
  "aggravates-slight": 0,
  "aggravates-moderate": 0,
  "aggravates-strong": 0,
};

/**
 * Penalty magnitude per aggravates LEVEL — mirrors HELP_REWARD so harm and help are
 * symmetric (a strong aggravator hurts as much as a strong helper helps, before any
 * position/confidence weighting). neutral / helps-* contribute no penalty.
 */
const AGGRAVATE_PENALTY: Record<ConcernGrade, number> = {
  "aggravates-strong": 1.9,
  "aggravates-moderate": 1.0,
  "aggravates-slight": 0.6,
  neutral: 0,
  "helps-strong": 0,
  "helps-moderate": 0,
  "helps-slight": 0,
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
 * Canonical concerns only — custom concerns are unvetted and never floored up.
 */
const ADDRESSED_FLOOR = 1.3;

/**
 * Custom-concern weight: an unvetted, AI-judged free-text concern moves the score
 * less than a calibration-backed canonical one. Multiplies both its reward and its
 * penalty. (A custom helps-strong therefore counts less than a canonical helps-strong.)
 */
const CUSTOM_CONFIDENCE = 0.6;

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

/**
 * Conflict penalty: a "split" product that BOTH meaningfully helps AND meaningfully harms the user's
 * SELECTED concerns is worse than one that does nothing. EXTRA penalty (on top of the direct aggravates
 * harm) = CONFLICT_FACTOR × min(bestHelp, worstHarm) — the `min` requires both forces to be real, and
 * the harm side (worstHarm) carries the severity, so a strong dryness conflict bites and a slight one
 * barely registers. Does NOT touch aggravates-strong (so the fragrance cases stay put).
 */
const CONFLICT_FACTOR = 0.4;

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

/** The three-state grade an ingredient holds for a concern KEY (or `neutral` if absent).
 *  The key is already normalized (canonical keys + custom keys are both raw cell keys). */
function gradeForKey(g: GradedIngredient, key: string): ConcernGrade {
  return g.grade?.concerns[key] ?? "neutral";
}

const HELP_RANK: Record<ConcernGrade, number> = {
  "helps-strong": 3,
  "helps-moderate": 2,
  "helps-slight": 1,
  neutral: 0,
  "aggravates-slight": 0,
  "aggravates-moderate": 0,
  "aggravates-strong": 0,
};

/** Harm severity rank, mirroring HELP_RANK — used to gate the conflict penalty. */
const AGG_RANK: Record<ConcernGrade, number> = {
  "aggravates-strong": 3,
  "aggravates-moderate": 2,
  "aggravates-slight": 1,
  neutral: 0,
  "helps-strong": 0,
  "helps-moderate": 0,
  "helps-slight": 0,
};

/** True for any graded harm level (the three-state `aggravates-*` bucket). */
function isAggravates(grade: ConcernGrade): boolean {
  return (
    grade === "aggravates-slight" ||
    grade === "aggravates-moderate" ||
    grade === "aggravates-strong"
  );
}

/** Strongest help grade any ingredient offers for a concern key (null if none help). */
function bestHelpGrade(graded: GradedIngredient[], key: string): ConcernGrade | null {
  let best: ConcernGrade | null = null;
  for (const g of graded) {
    const cell = gradeForKey(g, key);
    if (HELP_RANK[cell] > 0 && (best === null || HELP_RANK[cell] > HELP_RANK[best])) best = cell;
  }
  return best;
}

/** Reward for a scored concern: weighted primary helper + diminished depth bonus.
 *  Canonical single-moderate concerns get the ADDRESSED_FLOOR — but ONLY when the
 *  product has no stronger help to offer this user (`floorEligible`); custom concerns
 *  are weighted down by CUSTOM_CONFIDENCE and never floored. */
function concernReward(
  graded: GradedIngredient[],
  key: string,
  canonical: boolean,
  floorEligible: boolean,
): number {
  const contributions: number[] = [];
  for (const g of graded) {
    const value = HELP_REWARD[gradeForKey(g, key)];
    if (value > 0) contributions.push(value * g.posWeight * g.confWeight);
  }
  if (contributions.length === 0) return 0;
  contributions.sort((a, b) => b - a);
  const primary = contributions[0];
  const depth = contributions.slice(1).reduce((sum, v) => sum + v, 0) * DEPTH_WEIGHT;
  let reward = primary + depth;
  // Lift only the THIN case: a single moderate help that is the product's best
  // contribution for this user. If the product already does something strong on a
  // scored concern (`!floorEligible`), a secondary/buried moderate is NOT floored up
  // (that's what was over-scoring Glycolic's pores and the buried-niacinamide acne);
  // and custom concerns (unvetted) are never floored.
  if (canonical && floorEligible && bestHelpGrade(graded, key) === "helps-moderate") {
    reward = Math.max(reward, ADDRESSED_FLOOR);
  }
  return canonical ? reward : reward * CUSTOM_CONFIDENCE;
}

/** Penalty for a concern an ingredient aggravates: worst weighted offender, scaled by
 *  its graded severity (aggravates-strong/moderate/slight), position and confidence. */
function aggravatePenalty(graded: GradedIngredient[], key: string, canonical: boolean): number {
  let worst = 0;
  for (const g of graded) {
    const magnitude = AGGRAVATE_PENALTY[gradeForKey(g, key)];
    if (magnitude > 0) worst = Math.max(worst, magnitude * g.posWeight * g.confWeight);
  }
  return canonical ? worst : worst * CUSTOM_CONFIDENCE;
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
  const custom = extractCustomConcerns(profile);
  const display = displayConcerns(profile);
  // Score explicit canonical selections; fall back to the display set ONLY when the
  // user picked nothing scorable at all (no canonical AND no custom concern). A user
  // whose only concern is custom is scored against THAT concern, not the default set.
  const canonicalScored = selected.length || custom.length ? selected : display;
  const selectedSet = new Set(canonicalScored);

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

  // The concerns we actually score against (canonical selections + custom picks), each
  // with its cache key and whether it's canonical (custom harm/help is weighted down).
  const scoredConcernList: { key: string; canonical: boolean }[] = [
    ...canonicalScored.map((c) => ({ key: normalizeConcernKey(c), canonical: true })),
    ...custom.map((c) => ({ key: c.key, canonical: false })),
  ];
  const scoredKeys = scoredConcernList.map((s) => s.key);
  // `hasStrongHelp` gates the moderate ADDRESSED_FLOOR: a product that already does
  // something strong for this user doesn't get its secondary/buried moderates floored up.
  const hasStrongHelp = scoredKeys.some((k) => bestHelpGrade(graded, k) === "helps-strong");
  const floorEligible = !hasStrongHelp;

  /* ---- Overall score (0–10) ---- */
  let score = BASELINE;

  // Reward helps-* for selected concerns; penalize aggravates. Neutral / unaddressed
  // concerns are NOT penalized — silence is not a negative.
  for (const concern of canonicalScored) {
    const key = normalizeConcernKey(concern);
    score += concernReward(graded, key, true, floorEligible);
    score -= aggravatePenalty(graded, key, true);
  }
  // Custom concerns: same three-state math, AI-judged, weighted lower-confidence.
  for (const c of custom) {
    score += concernReward(graded, c.key, false, floorEligible);
    score -= aggravatePenalty(graded, c.key, false);
  }
  // Trait-based: a sensitive user is harmed by anything that aggravates sensitivity
  // or redness, even when they didn't list it as a concern. Charged ONCE (the worst of
  // the two) — sensitivity and redness are one reactive-skin dimension, so an ingredient
  // graded `aggravates` on both (e.g. a fragrance allergen) isn't double-penalized.
  if (profile.sensitive) {
    let traitHarm = 0;
    for (const concern of ["sensitivity", "redness"] as Concern[]) {
      if (!selectedSet.has(concern)) {
        traitHarm = Math.max(traitHarm, aggravatePenalty(graded, normalizeConcernKey(concern), true));
      }
    }
    score -= traitHarm;
  }

  // Conflict penalty: a "split" product that BOTH meaningfully helps one selected concern AND
  // meaningfully aggravates another is worse than one that does nothing. Fires only when a selected
  // concern is helped (>= moderate) AND another is harmed (>= moderate) — `aggravates-slight` is below
  // threshold and triggers nothing. Magnitude = CONFLICT_FACTOR × min(helpMag, harmMag): the `min`
  // means both forces must be real, and the position/confidence/severity-weighted `harmMag` makes a
  // strong conflict bite while a mild one barely moves. Additive to the direct aggravates penalty.
  let helpMag = 0;
  let harmMag = 0;
  let helpsMeaningfully = false;
  let harmsMeaningfully = false;
  for (const { key, canonical } of scoredConcernList) {
    const best = bestHelpGrade(graded, key);
    if (best !== null && HELP_RANK[best] >= HELP_RANK["helps-moderate"]) helpsMeaningfully = true;
    const customScale = canonical ? 1 : CUSTOM_CONFIDENCE;
    for (const g of graded) {
      const cell = gradeForKey(g, key);
      helpMag = Math.max(helpMag, HELP_REWARD[cell] * g.posWeight * g.confWeight * customScale);
      if (AGG_RANK[cell] >= AGG_RANK["aggravates-moderate"]) harmsMeaningfully = true;
    }
    harmMag = Math.max(harmMag, aggravatePenalty(graded, key, canonical));
  }
  if (helpsMeaningfully && harmsMeaningfully) {
    score -= CONFLICT_FACTOR * Math.min(helpMag, harmMag);
  }

  // Fragrance is an informational boolean tag — its HARM flows through the graded
  // irritation level + aggravates-* cells (so a harsh sensitizer hurts a lot, a mild
  // aroma barely). No flat boolean penalty (it can't distinguish severity).
  score -= irritationPenalty(worstIrritation, sensitiveSkin);
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

  /* ---- Per-concern percentages ---- */
  // Canonical display bars.
  const concernScores: ConcernScore[] = display.map((concern) => {
    const key = normalizeConcernKey(concern);
    let percent = 30;
    const best = bestHelpGrade(graded, key);
    if (best === "helps-strong") percent += 35;
    else if (best === "helps-moderate") percent += 20;
    else if (best === "helps-slight") percent += 10;

    if (
      (concern === "sensitivity" || concern === "redness") &&
      (RISK_RANK[worstIrritation] >= RISK_RANK.medium || hasFragrance)
    ) {
      percent -= 20;
    }
    if (aggravatePenalty(graded, key, true) > 0) percent -= 20;
    if (allergyHits > 0) percent -= 25;

    return { label: CONCERN_LABELS[concern], percent: Math.round(clamp(percent, 5, 95)) };
  });
  // Custom concern bars — marked AI-assessed; all-neutral ones are "tracked, not scored".
  for (const c of custom) {
    const best = bestHelpGrade(graded, c.key);
    const aggravated = graded.some((g) => isAggravates(gradeForKey(g, c.key)));
    const addressed = best !== null || aggravated;
    let percent = 30;
    if (best === "helps-strong") percent += 35;
    else if (best === "helps-moderate") percent += 20;
    else if (best === "helps-slight") percent += 10;
    if (aggravated) percent -= 20;
    concernScores.push({
      label: c.label,
      percent: Math.round(clamp(percent, 5, 95)),
      aiAssessed: true,
      scored: addressed,
    });
  }

  /* ---- Per-ingredient notes + flags ---- */
  const ingredients: IngredientNote[] = graded.map((g) => {
    const info = g.info;
    const benefitsUser = scoredKeys.some((k) => HELP_RANK[gradeForKey(g, k)] > 0);
    const aggravatesUser =
      scoredKeys.some((k) => isAggravates(gradeForKey(g, k))) ||
      (profile.sensitive &&
        (isAggravates(gradeForKey(g, "sensitivity")) || isAggravates(gradeForKey(g, "redness"))));
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
