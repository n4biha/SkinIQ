/**
 * Front-of-product validation gate (analyze pipeline · SOFT gate).
 *
 * Mirrors lib/label-gate.ts, but this NEVER blocks a scan — it only decides
 * whether the front photo gives us a usable product name + thumbnail. Pure and
 * dependency-free so it's unit-testable in isolation.
 *
 * Safety rule: if the image isn't a product front, the name is forced to null —
 * a face/scene/object must never produce a product name.
 */

import type { FrontReading } from "@/lib/types";

export type FrontGate =
  | { ok: true; productName: string | null }
  | { ok: false; reason: string };

const DEFAULT_REASON = "We couldn't read a product name from the front photo.";

export function gateFront(front: FrontReading): FrontGate {
  if (!front.isProductFront) {
    return { ok: false, reason: front.frontRejectReason ?? DEFAULT_REASON };
  }
  // A product front, but the name may still be absent/illegible — that's fine,
  // the caller falls back to the name chain. Trim empties to null.
  const name = front.productName?.trim();
  return { ok: true, productName: name ? name : null };
}
