/**
 * Label validation gate (analyze pipeline).
 *
 * Pure decision: given what readLabel returned, is this a usable cosmetic
 * ingredient list? Kept dependency-free (no Gemini, no DB) so the route can
 * refuse before scoring/saving, and so it's unit-testable in isolation.
 */

import type { LabelReading } from "@/lib/types";

export type LabelGate = { ok: true } | { ok: false; reason: string };

const DEFAULT_REASON = "We couldn't find an ingredient list in this photo.";

/** Reject when the model says it isn't an ingredient list, or when no ingredients
 *  were read (belt-and-suspenders so fabricated/empty reads never get scored). */
export function gateLabel(label: LabelReading): LabelGate {
  if (!label.isIngredientList || label.ingredients.length === 0) {
    return { ok: false, reason: label.rejectReason ?? DEFAULT_REASON };
  }
  return { ok: true };
}
