/**
 * Supabase client (Phase C).
 *
 * Supabase is a hosted Postgres database with auto-generated APIs. We talk to it
 * ONLY from the server (our /api routes + server components), using the secret
 * `service_role` key — which bypasses Row Level Security. The public `anon` key
 * and project URL are also available for any future browser-side use.
 *
 * The whole app is designed to run WITHOUT Supabase configured: every caller
 * first checks `isSupabaseConfigured()` and falls back to the in-memory store.
 * So missing env vars never break the app — they just mean "not persisted yet".
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True once the project URL + server service-role key are both set. The gate
 *  every persistence caller checks before reading/writing the database. */
export function isSupabaseConfigured(): boolean {
  return Boolean(URL && SERVICE_ROLE_KEY);
}

let server: SupabaseClient | null = null;

/**
 * Server-side Supabase client (service-role). Lazily created and reused.
 * Throws if called while unconfigured — guard with `isSupabaseConfigured()` first.
 */
export function getServerSupabase(): SupabaseClient {
  if (!URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  if (!server) {
    server = createClient(URL, SERVICE_ROLE_KEY, {
      // No user sessions on the server; we use the service-role key directly.
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return server;
}
