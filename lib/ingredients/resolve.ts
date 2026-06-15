/**
 * Three-tier ingredient resolver (Phase B+).
 *
 * For each ingredient, check tiers in priority order and stop at the first hit:
 *   Tier 1 — curated map        (most trusted, vetted for concern relevance)
 *   Tier 2 — CosIng dataset      (broad, offline, deterministic)
 *   Tier 3 — Gemini, then cache  (gap-filler; asked once, cached forever)
 *
 * Resolution is async because Tier 3 may call the model — that's why it runs in
 * the route, BEFORE the pure, synchronous scoreProduct. The model only supplies
 * ingredient facts; it never produces a score.
 */

import { normalizeName } from "@/lib/ingredients/normalize";
import { lookupCurated } from "@/lib/ingredients/curated";
import { lookupCosing } from "@/lib/ingredients/cosing";
import { getCached, putCached } from "@/lib/ingredients/store";
import { classifyIngredients } from "@/lib/gemini";
import type { IngredientInfo, ResolvedIngredient } from "@/lib/ingredients/types";
import type { Concern, HelpStrength, IngredientAssessment } from "@/lib/types";

function toInfo(a: IngredientAssessment): IngredientInfo {
  const helps: Partial<Record<Concern, HelpStrength>> = {};
  for (const h of a.helps) {
    helps[h.concern] =
      helps[h.concern] === "strong" || h.strength === "strong" ? "strong" : "moderate";
  }
  return {
    display: a.name.trim() || "Ingredient",
    function: a.function,
    helps,
    irritation: a.irritation,
    comedogenic: a.comedogenic,
    fragrance: a.fragrance,
    note: a.note,
  };
}

/** Resolve every ingredient through the tier cascade. Never throws. */
export async function resolveIngredients(
  names: string[],
): Promise<ResolvedIngredient[]> {
  const resolved: ResolvedIngredient[] = names.map((raw) => {
    const normalized = normalizeName(raw);

    const curated = lookupCurated(raw);
    if (curated) return { raw, normalized, info: curated, tier: 1 };

    const cosing = normalized ? lookupCosing(normalized) : undefined;
    if (cosing) return { raw, normalized, info: cosing, tier: 2 };

    const cached = normalized ? getCached(normalized) : undefined;
    if (cached) return { raw, normalized, info: cached, tier: 3 };

    return { raw, normalized, info: null, tier: null };
  });

  // Anything resolved at tier 3 here came from the persistent cache (no model call).
  const cacheHits = resolved.filter((r) => r.tier === 3).length;

  // Tier 3: classify everything still unresolved in one batched call, then cache.
  const misses = resolved.filter((r) => !r.info && r.normalized);
  let freshlyClassified = 0;
  if (misses.length) {
    try {
      const classified = await classifyIngredients(misses.map((m) => m.raw));
      const sameLength = classified.length === misses.length;
      const byNorm = new Map<string, IngredientInfo>();
      for (const c of classified) byNorm.set(normalizeName(c.name), toInfo(c));

      misses.forEach((m, i) => {
        // Prefer positional mapping (we asked for same order); fall back to name.
        const info = sameLength ? toInfo(classified[i]) : byNorm.get(m.normalized);
        if (info) {
          m.info = info;
          m.tier = 3;
          freshlyClassified++;
          putCached(m.normalized, info);
        }
      });
    } catch (err) {
      console.warn(
        "[ingredients] Tier-3 classification failed; leaving unresolved:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  let curated = 0;
  let cosing = 0;
  let unresolved = 0;
  for (const r of resolved) {
    if (r.tier === 1) curated++;
    else if (r.tier === 2) cosing++;
    else if (r.tier === null) unresolved++;
  }
  console.log(
    `[ingredients] resolved ${names.length}: curated=${curated} cosing=${cosing} ` +
      `cache=${cacheHits} gemini-call=${freshlyClassified} unresolved=${unresolved}`,
  );

  return resolved;
}
