/**
 * Single saved report (Phase C · history management).
 *
 * DELETE /api/reports/<id> — remove the signed-in user's report, its linked scan
 * row, and the stored photo.
 * PATCH  /api/reports/<id> — rename the report ({ productName }).
 * Both owner-scoped in the store layer, so a user can only touch their own.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { deleteReport, renameReport } from "@/lib/report-store";

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const name =
    body && typeof (body as { productName?: unknown }).productName === "string"
      ? (body as { productName: string }).productName
      : "";
  if (!name.trim()) {
    return NextResponse.json({ error: "A product name is required." }, { status: 400 });
  }

  const { id } = await params;
  const renamed = await renameReport(id, user.id, name);
  return NextResponse.json({ renamed });
}
