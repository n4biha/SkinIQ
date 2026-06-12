/**
 * Tier 2 — CosIng dataset lookup (Phase B+, step 2).
 *
 * Broad, deterministic, offline coverage from the EU CosIng open dataset
 * (INCI name + functions), folded into our IngredientInfo via function-map.ts.
 *
 * The table (lib/data/cosing.json) is read from disk once via fs (NOT a static
 * import) so the ~2MB file isn't bundled into the route, then cached in a
 * globalThis Map. TODO Phase C: move into the Supabase `ingredients` table.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Concern } from "@/lib/types";
import type { IngredientInfo } from "@/lib/ingredients/types";
import { FUNCTION_MAP } from "@/lib/ingredients/function-map";

const DATA_PATH = join(process.cwd(), "lib", "data", "cosing.json");

// Each entry: [displayName, ...UPPERCASE_FUNCTIONS]
type Entry = string[];

const g = globalThis as unknown as { __skiniqCosing?: Map<string, Entry> };

function table(): Map<string, Entry> {
  if (g.__skiniqCosing) return g.__skiniqCosing;
  const map = new Map<string, Entry>();
  try {
    const obj = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Record<string, Entry>;
    for (const [k, v] of Object.entries(obj)) map.set(k, v);
  } catch (err) {
    console.warn("[cosing] could not load lib/data/cosing.json:", err);
  }
  g.__skiniqCosing = map;
  return map;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Short chemistry acronyms to keep uppercase after title-casing INCI names.
const ACRONYMS = new Set([
  "EDTA", "PCA", "PEG", "PPG", "PVP", "PG", "AHA", "BHA", "HA", "DMDM",
  "MEA", "DEA", "TEA", "EDDS", "SLS", "SLES", "UV", "C", "EGF",
]);

/** Title-case an (often all-caps) CosIng INCI name, restoring known acronyms. */
function titleCaseInci(name: string): string {
  return titleCase(name)
    .split(/(\s|\/|-)/)
    .map((tok) => (ACRONYMS.has(tok.toUpperCase()) ? tok.toUpperCase() : tok))
    .join("");
}

/** Tier 2 lookup against the CosIng table. Returns undefined when absent. */
export function lookupCosing(normalized: string): IngredientInfo | undefined {
  if (!normalized) return undefined;
  const entry = table().get(normalized);
  if (!entry) return undefined;

  const [display, ...functions] = entry;
  if (functions.length === 0) return undefined;

  const benefits = new Set<Concern>();
  let isIrritant = false;
  let isFragrance = false;
  for (const f of functions) {
    const rule = FUNCTION_MAP[f];
    if (!rule) continue;
    rule.benefitsFor?.forEach((c) => benefits.add(c));
    if (rule.isIrritant) isIrritant = true;
    if (rule.isFragrance) isFragrance = true;
  }

  // Label with the first *meaningful* function, not a generic one like MASKING.
  const labelFn = functions.find((f) => FUNCTION_MAP[f]) ?? functions[0];

  return {
    display: titleCaseInci(display || normalized),
    function: titleCase(labelFn),
    benefitsFor: [...benefits],
    comedogenic: 0, // CosIng has no comedogenic data; curated/Gemini cover those.
    isIrritant: isIrritant || undefined,
    isFragrance: isFragrance || undefined,
    note: `Listed in the EU CosIng database (${functions
      .slice(0, 3)
      .map((f) => f.toLowerCase())
      .join(", ")}).`,
  };
}
