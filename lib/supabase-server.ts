/**
 * Server-side, session-aware Supabase client for auth (Phase C · C5a).
 *
 * Reads/writes the auth cookies via Next's `cookies()`, so server components and
 * route handlers know who's logged in. This is SEPARATE from lib/supabase.ts —
 * that one uses the secret service-role key for trusted admin work (Storage
 * signing, etc.); this one acts as the logged-in user (anon key + their session).
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component (can't set cookies there) — the
            // proxy handles session refresh, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/** The currently logged-in user, or null. */
export async function getUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
