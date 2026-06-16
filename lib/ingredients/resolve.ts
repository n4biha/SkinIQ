/**
 * Ingredient resolver — now a thin adapter over the knowledge base.
 *
 * The substantive per-ingredient judgment lives in lib/ingredients/knowledge.ts
 * (override → KB hit → AI grade, all cached/versioned). This file just maps the
 * resolved three-state `IngredientGrade` into the existing `IngredientInfo` shape
 * that the current `scoreProduct` consumes — a BRIDGE so scoring stays unchanged
 * until the scoring rebuild. Each resolved ingredient also carries its full `grade`
 * for that rebuild.
 *
 * Async because grading new ingredients may call the model (once, then cached);
 * runs in the route BEFORE the pure, synchronous scoreProduct.
 */

import { normalizeName, normalizeConcernKey } from "@/lib/ingredients/normalize";
import { resolveGrades } from "@/lib/ingredients/knowledge";
import type { Grader } from "@/lib/ingredients/grade";
import type { IngredientInfo, ResolvedIngredient } from "@/lib/ingredients/types";
import { ConcernSchema, type Concern, type HelpStrength, type IngredientGrade } from "@/lib/types";

/**
 * BRIDGE: three-state grade → the legacy `IngredientInfo` scoreProduct reads.
 * Only `helps-*` cells become `helps` entries (neutral/aggravates are NOT helps);
 * "helps-slight" maps to "moderate" for now (the current HelpStrength has no
 * "slight" — the scoring rebuild consumes the real grade instead).
 */
function bridgeToInfo(raw: string, grade: IngredientGrade): IngredientInfo {
  const helps: Partial<Record<Concern, HelpStrength>> = {};
  for (const concern of ConcernSchema.options) {
    const cell = grade.concerns[normalizeConcernKey(concern)];
    if (cell === "helps-strong") helps[concern] = "strong";
    else if (cell === "helps-moderate" || cell === "helps-slight") helps[concern] = "moderate";
    // "neutral" and "aggravates" are NOT a help — left out (never rewarded here).
  }
  return {
    display: raw.trim() || "Ingredient",
    function: "Analyzed ingredient",
    helps,
    irritation: grade.irritation,
    comedogenic: grade.comedogenic,
    fragrance: grade.fragrance,
    note: "",
  };
}

/**
 * Resolve every ingredient through the knowledge base. Never throws.
 * `opts.grader` is injectable (tests pass a deterministic fake).
 */
export async function resolveIngredients(
  names: string[],
  opts: { grader?: Grader } = {},
): Promise<ResolvedIngredient[]> {
  const grades = await resolveGrades(names, opts);

  const resolved = names.map((raw): ResolvedIngredient => {
    const normalized = normalizeName(raw);
    const grade = normalized ? grades.get(normalized) : undefined;
    if (!grade) return { raw, normalized, info: null, tier: null };
    return { raw, normalized, info: bridgeToInfo(raw, grade), tier: 3, grade };
  });

  const graded = resolved.filter((r) => r.grade).length;
  console.log(
    `[ingredients] resolved ${names.length}: graded=${graded} unresolved=${names.length - graded}`,
  );

  return resolved;
}
