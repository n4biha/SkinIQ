/**
 * Opt-in sharing for a report (Phase C · hardening).
 *
 * POST   /api/reports/<id>/share  → enable sharing; returns an unguessable token
 *                                   (NOT the report id). Idempotent.
 * DELETE /api/reports/<id>/share  → revoke the token (disable the public link).
 *
 * Owner-scoped: the store only touches a row whose user_id matches the caller.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { createShareToken, revokeShareToken } from "@/lib/report-store";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const token = await createShareToken(id, user.id);
  if (!token) {
    return NextResponse.json(
      { error: "Couldn't create a share link for this report." },
      { status: 404 },
    );
  }
  return NextResponse.json({ token });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const revoked = await revokeShareToken(id, user.id);
  return NextResponse.json({ revoked });
}
