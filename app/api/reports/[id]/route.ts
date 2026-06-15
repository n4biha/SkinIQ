/**
 * Delete a single saved report (Phase C · history management).
 *
 * DELETE /api/reports/<id> — removes the signed-in user's report, its linked
 * scan row, and the stored photo. Owner-scoped in the store layer, so a user can
 * only delete their own.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { deleteReport } from "@/lib/report-store";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteReport(id, user.id);
  return NextResponse.json({ deleted });
}
