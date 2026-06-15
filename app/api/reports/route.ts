/**
 * Clear all saved reports (Phase C · history management).
 *
 * DELETE /api/reports — removes every report (+ scans + photos) for the
 * signed-in user. Owner-scoped in the store layer.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { clearReports } from "@/lib/report-store";

export const runtime = "nodejs";

export async function DELETE() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const cleared = await clearReports(user.id);
  return NextResponse.json({ cleared });
}
