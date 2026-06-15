/**
 * Profile store (Phase C · C5).
 *
 * Saves a signed-in user's skin profile to the `profiles` table and reads it
 * back, so the profile follows the account across devices/sessions instead of
 * living only in the browser's localStorage.
 *
 * Mirrors lib/report-store.ts: server-only (service-role key), gated by
 * `isSupabaseConfigured()`, and best-effort — a failed write never throws to the
 * caller. The DB uses snake_case columns; SkinProfile is camelCase, so we map
 * between them here. There is at most one row per user (unique on user_id), so
 * saving is an upsert.
 */

import { isSupabaseConfigured, getServerSupabase } from "@/lib/supabase";
import { SkinProfileSchema, type SkinProfile } from "@/lib/types";

const TABLE = "profiles";

/** Read a user's saved profile, or null if none / DB unavailable. */
export async function getProfile(userId: string): Promise<SkinProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getServerSupabase()
    .from(TABLE)
    .select("skin_type, concerns, allergies")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[profile-store] read failed:", error.message);
    return null;
  }
  if (!data) return null;

  const parsed = SkinProfileSchema.safeParse({
    skinType: data.skin_type ?? null,
    concerns: data.concerns ?? [],
    allergies: data.allergies ?? [],
  });
  return parsed.success ? parsed.data : null;
}

/** Upsert a user's profile. Best-effort: logs and returns false on failure. */
export async function saveProfile(
  userId: string,
  profile: SkinProfile,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await getServerSupabase()
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        skin_type: profile.skinType,
        concerns: profile.concerns,
        allergies: profile.allergies,
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.warn("[profile-store] upsert failed:", error.message);
    return false;
  }
  return true;
}
