/**
 * Ingredient classification cache (Phase B+).
 *
 * Persists Tier-3 (Gemini) classifications so each ingredient is only ever asked
 * once — after the first scan it becomes a permanent, deterministic entry. Keyed
 * by normalized INCI name.
 *
 * Phase B impl: a JSON file at data/ingredient-cache.json (survives dev restarts).
 * TODO Phase C: back this with the Supabase `ingredients` table — same
 * getCached/putCached surface, only the implementation swaps.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { IngredientInfo } from "@/lib/ingredients/types";

const CACHE_PATH = join(process.cwd(), "data", "ingredient-cache.json");

// globalThis singleton so the map survives hot-reloads and is shared across bundles.
const g = globalThis as unknown as {
  __skiniqIngredientCache?: Map<string, IngredientInfo>;
};

function load(): Map<string, IngredientInfo> {
  if (g.__skiniqIngredientCache) return g.__skiniqIngredientCache;
  const map = new Map<string, IngredientInfo>();
  try {
    const raw = readFileSync(CACHE_PATH, "utf8");
    const obj = JSON.parse(raw) as Record<string, IngredientInfo>;
    for (const [k, v] of Object.entries(obj)) map.set(k, v);
  } catch {
    // No cache file yet — start empty.
  }
  g.__skiniqIngredientCache = map;
  return map;
}

function persist(map: Map<string, IngredientInfo>): void {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(Object.fromEntries(map), null, 2));
  } catch (err) {
    console.warn("[ingredients] could not persist cache:", err);
  }
}

export function getCached(normalized: string): IngredientInfo | undefined {
  if (!normalized) return undefined;
  return load().get(normalized);
}

export function putCached(normalized: string, info: IngredientInfo): void {
  if (!normalized) return;
  const map = load();
  map.set(normalized, info);
  persist(map);
}
