/**
 * Delete the signed-in user's account (Settings · danger zone).
 *
 * DELETE /api/account — wipes everything tied to the user, then removes the auth
 * account itself:
 *   1. all reports + scans + stored photos (clearReports)
 *   2. their saved skin profile row
 *   3. the Supabase auth user (service-role admin call)
 *
 * The client signs out + redirects afterwards. Owner-scoped; guests get 401.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { clearReports } from "@/lib/report-store";

export const runtime = "nodejs";

export async function DELETE() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const sb = getServerSupabase();

  // 1) Reports + scans + stored photos.
  await clearReports(user.id);
  // 2) Saved skin profile.
  await sb.from("profiles").delete().eq("user_id", user.id);
  // 3) The auth user itself (requires the service-role key, which sb uses).
  const { error } = await sb.auth.admin.deleteUser(user.id);
  if (error) {
    console.warn("[account] deleteUser failed:", error.message);
    return NextResponse.json({ error: "Could not delete account." }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
