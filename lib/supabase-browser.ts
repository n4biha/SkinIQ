/**
 * Browser-side Supabase client for auth (Phase C · C5a).
 *
 * Used by client components (login page, sidebar). It uses the PUBLIC anon /
 * publishable key — safe to ship to the browser. The logged-in session is kept
 * in cookies (managed by @supabase/ssr), not localStorage.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Memoized browser client (one per tab). */
export function createBrowserSupabase(): SupabaseClient {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
