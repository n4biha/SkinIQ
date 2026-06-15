/**
 * Tier-3 ingredient cache (Phase C · C6).
 *
 * Persists Gemini gradings so each ingredient is only ever asked once. Two
 * backends behind one batched, async surface:
 *   - Supabase configured → the `ingredients` table (survives restarts AND scales
 *     across serverless instances; the real production cache).
 *   - Not configured (local dev) → a JSON file at data/ingredient-cache.json.
 * Either way an in-process Map (globalThis) is an L1 cache in front.
 *
 * Batched (one DB round-trip per scan) and best-effort: any DB error logs and is
 * treated as a miss, so the resolver just falls back to Gemini — never throws.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { IngredientInfo } from "@/lib/ingredients/types";
import type { Concern, HelpStrength, IrritationRisk } from "@/lib/types";
import { isSupabaseConfigured, getServerSupabase } from "@/lib/supabase";

const TABLE = "ingredients";
const CACHE_PATH = join(process.cwd(), "data", "ingredient-cache.json");

// globalThis singletons so the cache survives hot-reloads and is shared across bundles.
const g = globalThis as unknown as {
  __skiniqIngredientCache?: Map<string, IngredientInfo>;
  __skiniqIngredientFileLoaded?: boolean;
};
function mem(): Map<string, IngredientInfo> {
  return (g.__skiniqIngredientCache ??= new Map());
}

/* ---- Local JSON-file fallback (only used when Supabase isn't configured) ---- */

function loadFileOnce(): void {
  if (g.__skiniqIngredientFileLoaded) return;
  g.__skiniqIngredientFileLoaded = true;
  try {
    const obj = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Record<string, IngredientInfo>;
    for (const [k, v] of Object.entries(obj)) mem().set(k, v);
  } catch {
    // No cache file yet — start empty.
  }
}

function persistFile(): void {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(Object.fromEntries(mem()), null, 2));
  } catch (err) {
    console.warn("[ingredients] could not persist cache file:", err);
  }
}

/* ---- DB row mapping ---- */

function rowToInfo(row: Record<string, unknown>): IngredientInfo {
  return {
    display: (row.display as string) ?? "Ingredient",
    function: (row.function as string) ?? "",
    helps: (row.helps as Partial<Record<Concern, HelpStrength>>) ?? {},
    irritation: (row.irritation as IrritationRisk) ?? "none",
    comedogenic: (row.comedogenic as number) ?? 0,
    fragrance: Boolean(row.fragrance),
    note: (row.note as string) ?? "",
  };
}

/* ---- Public, batched API ---- */

/** Look up many normalized names at once → a (subset) map of the ones we have. */
export async function getCachedMany(
  normalized: string[],
): Promise<Map<string, IngredientInfo>> {
  const result = new Map<string, IngredientInfo>();
  const names = [...new Set(normalized.filter(Boolean))];
  if (names.length === 0) return result;

  const cache = mem();
  const missing: string[] = [];
  for (const n of names) {
    const hit = cache.get(n);
    if (hit) result.set(n, hit);
    else missing.push(n);
  }
  if (missing.length === 0) return result;

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getServerSupabase()
        .from(TABLE)
        .select("inci_name, display, function, helps, irritation, comedogenic, fragrance, note")
        .in("inci_name", missing);
      if (error) {
        console.warn("[ingredients] cache read failed:", error.message);
      } else {
        for (const row of data ?? []) {
          const name = row.inci_name as string;
          const info = rowToInfo(row);
          cache.set(name, info);
          result.set(name, info);
        }
      }
    } catch (err) {
      console.warn("[ingredients] cache read error:", err instanceof Error ? err.message : err);
    }
  } else {
    // Local mode: load the file into L1 once, then re-check the misses.
    loadFileOnce();
    for (const n of missing) {
      const hit = cache.get(n);
      if (hit) result.set(n, hit);
    }
  }

  return result;
}

/** Store many freshly-graded ingredients (idempotent upsert by normalized name). */
export async function putCachedMany(
  entries: Array<{ normalized: string; info: IngredientInfo }>,
): Promise<void> {
  const valid = entries.filter((e) => e.normalized);
  if (valid.length === 0) return;

  const cache = mem();
  for (const { normalized, info } of valid) cache.set(normalized, info);

  if (isSupabaseConfigured()) {
    try {
      const rows = valid.map(({ normalized, info }) => ({
        inci_name: normalized,
        display: info.display,
        function: info.function,
        helps: info.helps,
        irritation: info.irritation,
        comedogenic: info.comedogenic,
        fragrance: info.fragrance,
        note: info.note,
        source: "gemini",
      }));
      const { error } = await getServerSupabase()
        .from(TABLE)
        .upsert(rows, { onConflict: "inci_name" });
      if (error) console.warn("[ingredients] cache write failed:", error.message);
    } catch (err) {
      console.warn("[ingredients] cache write error:", err instanceof Error ? err.message : err);
    }
  } else {
    loadFileOnce();
    persistFile();
  }
}
