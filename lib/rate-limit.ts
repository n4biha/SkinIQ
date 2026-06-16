/**
 * Tiny in-memory rate limiter (Phase C · hardening).
 *
 * A fixed-window counter keyed by an arbitrary string (e.g. user id or IP). Used
 * to throttle the paid Gemini pipeline in /api/analyze.
 *
 * LIMITATION: state lives in this process's memory, so on serverless (Vercel)
 * each instance counts independently — it's a sensible first line of defense, not
 * a distributed limiter. Upgrade path: a shared store (Upstash Redis / a Supabase
 * counter table) behind this same `checkRateLimit` surface.
 */

type Window = { count: number; resetAt: number };

const g = globalThis as unknown as { __skiniqRateLimit?: Map<string, Window> };
function store(): Map<string, Window> {
  return (g.__skiniqRateLimit ??= new Map());
}

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the window resets (for a Retry-After header). */
  retryAfter: number;
};

/**
 * Allow up to `limit` calls per `windowMs` for `key`. Each call counts.
 * Returns `{ ok: false, retryAfter }` once the limit is exceeded.
 */
export function checkRateLimit(
  key: string,
  { limit = 12, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): RateLimitResult {
  const now = Date.now();
  const map = store();
  const win = map.get(key);

  if (!win || now >= win.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  win.count += 1;
  if (win.count > limit) {
    return { ok: false, retryAfter: Math.ceil((win.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}
