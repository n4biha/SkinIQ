/**
 * The AI grader for the knowledge base.
 *
 * Turns ingredient names into full `IngredientGrade`s: gathers CosIng functions as
 * grounding evidence, calls the (temp-0, batched) Gemini grader, and stamps the
 * result with the current grade version + model + timestamp.
 *
 * `Grader` is an injectable function type so the knowledge base + tests can swap in
 * a deterministic fake grader (no real model call in tests).
 */

import { normalizeName, normalizeConcernKey } from "@/lib/ingredients/normalize";
import { cosingFunctions } from "@/lib/ingredients/cosing";
import { gradeIngredients, GRADE_MODEL } from "@/lib/gemini";
import { CURRENT_GRADE_VERSION } from "@/lib/ingredients/version";
import type { ConcernGrade, IngredientGrade } from "@/lib/types";

/** Grade a batch of raw ingredient names → map keyed by normalizeName. */
export type Grader = (names: string[]) => Promise<Map<string, IngredientGrade>>;

/**
 * Pair each ingredient with its CosIng function list — the grounding EVIDENCE fed
 * into the AI grader. (Pure + exported so the grounding wiring is testable without
 * calling the model.)
 */
export function groundedItems(names: string[]): { name: string; cosingFunctions: string[] }[] {
  return names.map((name) => ({
    name,
    cosingFunctions: cosingFunctions(normalizeName(name)),
  }));
}

/** The default grader: CosIng-grounded AI grading at the current version. */
export const aiGrader: Grader = async (names) => {
  const out = new Map<string, IngredientGrade>();
  if (names.length === 0) return out;

  const graded = await gradeIngredients(groundedItems(names));

  // One timestamp for the batch — metadata only (re-grading is version-gated).
  const gradedAt = new Date().toISOString();

  for (const g of graded) {
    const concerns: Record<string, ConcernGrade> = {};
    for (const c of g.concerns) concerns[normalizeConcernKey(c.concern)] = c.grade;
    out.set(normalizeName(g.name), {
      irritation: g.irritation,
      comedogenic: g.comedogenic,
      fragrance: g.fragrance,
      confidence: g.confidence,
      concerns,
      gradeVersion: CURRENT_GRADE_VERSION,
      model: GRADE_MODEL,
      gradedAt,
    });
  }
  return out;
};
