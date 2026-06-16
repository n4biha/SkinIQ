/**
 * Ingredient knowledge base — the accumulating grid of (ingredient × concern) grades.
 *
 * The system learns each ingredient ONCE (AI grade, CosIng-grounded), stores it, and
 * reuses it forever — so over time almost every scan is cache hits and the model
 * rarely runs. Grades are SHARED across users (a fact about chemistry, not a person):
 * in-memory in-process, and the Supabase `ingredients` table when configured.
 *
 * Resolution per ingredient:
 *   1. base grade ← knowledge base hit at CURRENT_GRADE_VERSION (no AI), else AI grade
 *      (grounded by CosIng), written to the store at the current version.
 *   2. overlay any partial safety OVERRIDE (pinned fields win; AI fills the rest).
 *
 * Deterministic: AI grading is temp 0 + cached, so the same ingredient yields the
 * same grade on every future resolve. Re-grading is VERSION-gated only — never a timer.
 */

import { normalizeName, normalizeConcernKey } from "@/lib/ingredients/normalize";
import { CURRENT_GRADE_VERSION } from "@/lib/ingredients/version";
import { lookupOverride, mergeOverride } from "@/lib/ingredients/overrides";
import { aiGrader, type Grader } from "@/lib/ingredients/grade";
import { isSupabaseConfigured, getServerSupabase } from "@/lib/supabase";
import { IngredientGradeSchema, type ConcernGrade, type IngredientGrade } from "@/lib/types";

const TABLE = "ingredients";

// In-memory store of BASE (pre-override) grades, keyed by normalized name. Shared
// across requests in-process and kept across hot-reloads. Overrides are applied at
// READ time (not stored), so editing an override never requires a re-grade.
const g = globalThis as unknown as { __skiniqGrades?: Map<string, IngredientGrade> };
function mem(): Map<string, IngredientGrade> {
  return (g.__skiniqGrades ??= new Map());
}

/** The three-state rule as a pure sign — helps-* reward, aggravates penalty, neutral none. */
export function concernContribution(grade: ConcernGrade): "reward" | "penalty" | "none" {
  if (grade === "aggravates") return "penalty";
  if (grade === "neutral") return "none";
  return "reward"; // helps-strong | helps-moderate | helps-slight
}

/** All-neutral base, so a seeded safety override still applies when the AI grade is
 *  unavailable (offline / no API key). */
function neutralBase(): IngredientGrade {
  return {
    irritation: "none",
    comedogenic: 0,
    fragrance: false,
    confidence: "low",
    concerns: {},
    gradeVersion: CURRENT_GRADE_VERSION,
    model: "override-only",
    gradedAt: "",
  };
}

/* ---- Supabase store (best-effort; in-memory works without it) ---- */

async function dbGetMany(names: string[]): Promise<Map<string, IngredientGrade>> {
  const out = new Map<string, IngredientGrade>();
  if (!isSupabaseConfigured() || names.length === 0) return out;
  try {
    const { data, error } = await getServerSupabase()
      .from(TABLE)
      .select("inci_name, grade")
      .in("inci_name", names);
    if (error) {
      console.warn("[knowledge] DB read failed:", error.message);
      return out;
    }
    for (const row of data ?? []) {
      const parsed = IngredientGradeSchema.safeParse(row.grade);
      if (parsed.success) out.set(row.inci_name as string, parsed.data);
    }
  } catch (err) {
    console.warn("[knowledge] DB read error:", err instanceof Error ? err.message : err);
  }
  return out;
}

async function dbPutMany(
  entries: Array<{ name: string; grade: IngredientGrade }>,
): Promise<void> {
  if (!isSupabaseConfigured() || entries.length === 0) return;
  try {
    const rows = entries.map(({ name, grade }) => ({
      inci_name: name,
      grade,
      grade_version: grade.gradeVersion,
      model: grade.model,
      graded_at: grade.gradedAt || null,
    }));
    const { error } = await getServerSupabase()
      .from(TABLE)
      .upsert(rows, { onConflict: "inci_name" });
    if (error) console.warn("[knowledge] DB write failed:", error.message);
  } catch (err) {
    console.warn("[knowledge] DB write error:", err instanceof Error ? err.message : err);
  }
}

/* ---- Resolution ---- */

/**
 * Resolve grades for a set of ingredient names → map keyed by normalized name.
 * `opts.grader` is injectable (tests pass a deterministic fake; defaults to the AI).
 */
export async function resolveGrades(
  names: string[],
  opts: { grader?: Grader } = {},
): Promise<Map<string, IngredientGrade>> {
  const grader = opts.grader ?? aiGrader;

  // Unique normalized names + a representative raw name (for grading prompts).
  const rawByNorm = new Map<string, string>();
  for (const n of names) {
    const k = normalizeName(n);
    if (k && !rawByNorm.has(k)) rawByNorm.set(k, n);
  }
  const uniqueNorm = [...rawByNorm.keys()];

  // base[norm] = the pre-override grade. KB hit (current version) → else AI.
  const base = new Map<string, IngredientGrade>();
  const need: string[] = [];
  for (const norm of uniqueNorm) {
    const hit = mem().get(norm);
    if (hit && hit.gradeVersion >= CURRENT_GRADE_VERSION) base.set(norm, hit);
    else need.push(norm);
  }

  // Shared DB hits for the misses.
  if (need.length) {
    const db = await dbGetMany(need);
    for (const [norm, grade] of db) {
      if (grade.gradeVersion >= CURRENT_GRADE_VERSION) {
        mem().set(norm, grade);
        base.set(norm, grade);
      }
    }
  }

  // AI-grade whatever's still missing/stale; persist to mem + DB.
  const missing = need.filter((n) => !base.has(n));
  if (missing.length) {
    try {
      const graded = await grader(missing.map((n) => rawByNorm.get(n) ?? n));
      const toPersist: Array<{ name: string; grade: IngredientGrade }> = [];
      for (const norm of missing) {
        const grade = graded.get(norm);
        if (grade) {
          mem().set(norm, grade);
          base.set(norm, grade);
          toPersist.push({ name: norm, grade });
        }
      }
      await dbPutMany(toPersist);
    } catch (err) {
      console.warn("[knowledge] grading failed:", err instanceof Error ? err.message : err);
    }
  }

  // Overlay partial safety overrides.
  const result = new Map<string, IngredientGrade>();
  for (const norm of uniqueNorm) {
    const override = lookupOverride(norm);
    let grade = base.get(norm);
    if (!grade && override) grade = neutralBase(); // safety flags still apply offline
    if (!grade) continue; // truly unresolved (no AI, no override)
    result.set(norm, override ? mergeOverride(grade, override) : grade);
  }
  return result;
}

/**
 * Targeted invalidation — fix a specific error WITHOUT a full version bump:
 *  - invalidateGrade(name)          → drop the whole ingredient (re-grades next time)
 *  - invalidateGrade(name, concern) → clear one concern cell (→ neutral on read)
 */
export async function invalidateGrade(name: string, concern?: string): Promise<void> {
  const norm = normalizeName(name);
  if (!norm) return;

  if (concern) {
    const current = mem().get(norm);
    if (current) {
      const concerns = { ...current.concerns };
      delete concerns[normalizeConcernKey(concern)];
      mem().set(norm, { ...current, concerns });
    }
    return;
  }

  mem().delete(norm);
  if (isSupabaseConfigured()) {
    try {
      await getServerSupabase().from(TABLE).delete().eq("inci_name", norm);
    } catch (err) {
      console.warn("[knowledge] invalidate DB delete error:", err instanceof Error ? err.message : err);
    }
  }
}
