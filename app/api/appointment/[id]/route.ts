/**
 * app/api/appointment/[id]/route.ts
 * PATCH /api/appointment/[id]
 * Confirms or cancels an appointment. Admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { dbRun, dbQuery } from "@/lib/db/sqlite";

export const runtime = "nodejs";

const ADMIN_EMAILS = ["admin@novabank.com", "demo@novabank.com"];

function isAdmin(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.includes(email ?? "");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const rows = await dbQuery("SELECT * FROM appointments WHERE id = ?", [id]);
  if (!rows.length) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 },
    );
  }

  const body = await req.json();
  const { status } = body;

  if (!["confirmed", "cancelled"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be confirmed or cancelled" },
      { status: 400 },
    );
  }

  await dbRun(`UPDATE appointments SET status = ? WHERE id = ?`, [status, id]);

  return NextResponse.json({ success: true, id, status });
}
