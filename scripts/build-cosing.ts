/**
 * Dev-only: build lib/data/cosing.json from the EU CosIng CSV export.
 *
 * Usage:  npx tsx scripts/build-cosing.ts [path-to-cosing.csv]
 * Default input: /tmp/cosing.csv
 *
 * Source CSV (open data): Open Beauty Facts mirror of the official CosIng export
 *   openfoodfacts/openbeautyfacts → cosing/COSING_Ingredients-Fragrance.Inventory_v2.csv
 * Columns: COSING Ref No, INCI name, INN name, …, Function, Update Date
 *
 * Output: { [normalizedINCI]: [displayName, ...UPPERCASE_FUNCTIONS] }
 * NOT part of the app runtime — produces the bundled Tier-2 table.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizeName } from "@/lib/ingredients/normalize";

const INCI_COL = 1;
const FUNCTION_COL = 8;

/** Quote-aware CSV tokenizer (handles embedded commas, quotes and newlines). */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const inputPath = process.argv[2] ?? "/tmp/cosing.csv";
const outPath = join(process.cwd(), "lib", "data", "cosing.json");

const text = readFileSync(inputPath, "utf8");
const rows = parseCSV(text);
console.log(`[build-cosing] parsed ${rows.length} rows from ${inputPath}`);

const table: Record<string, string[]> = {};
let skippedNoInci = 0;
let skippedNoFunc = 0;
let merged = 0;

for (const row of rows) {
  const inci = (row[INCI_COL] ?? "").trim();
  const funcRaw = (row[FUNCTION_COL] ?? "").trim();

  // Skip the "sep=," hint line, the header, and rows missing key fields.
  if (!inci || inci.toLowerCase() === "inci name") {
    skippedNoInci++;
    continue;
  }
  if (!funcRaw) {
    skippedNoFunc++;
    continue;
  }

  const normalized = normalizeName(inci);
  if (!normalized) {
    skippedNoInci++;
    continue;
  }

  const functions = funcRaw
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);
  if (functions.length === 0) {
    skippedNoFunc++;
    continue;
  }

  const existing = table[normalized];
  if (existing) {
    // Union new functions onto the existing entry (keep first display name).
    const set = new Set(existing.slice(1));
    for (const f of functions) set.add(f);
    table[normalized] = [existing[0], ...set];
    merged++;
  } else {
    table[normalized] = [inci, ...functions];
  }
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(table));

const count = Object.keys(table).length;
console.log(
  `[build-cosing] wrote ${count} entries to ${outPath} ` +
    `(skipped: ${skippedNoInci} no-inci/header, ${skippedNoFunc} no-function; ${merged} merged dupes)`,
);
