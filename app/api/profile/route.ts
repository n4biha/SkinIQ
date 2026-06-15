/**
 * Profile API (Phase C · C5).
 *
 * GET  → the signed-in user's saved skin profile (null for guests).
 * PUT  → save/upsert the signed-in user's profile.
 *
 * Auth comes from the session cookie (getUser). Guests are not an error — they
 * simply have nothing to read and nothing is saved. The browser can't touch the
 * DB directly (RLS is locked to the service-role key), so the profile context
 * goes through this route.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { getProfile, saveProfile } from "@/lib/profile-store";
import { SkinProfileSchema } from "@/lib/types";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ profile: null });

  const profile = await getProfile(user.id);
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const user = await getUser();
  // Guests have no account to save to — accept silently so the client needn't
  // special-case it.
  if (!user) return NextResponse.json({ saved: false });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SkinProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile." }, { status: 400 });
  }

  const saved = await saveProfile(user.id, parsed.data);
  return NextResponse.json({ saved });
}
