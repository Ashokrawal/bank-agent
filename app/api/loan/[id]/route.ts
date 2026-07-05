/**
 * PATCH /api/loan/[id] - staff approves / rejects / requests more info
 * Admin only - checked via centralised isAdminEmail helper
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { updateLoanStatus } from "@/lib/db/sqlite";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // only admin emails can approve or reject loans
  if (!isAdminEmail(session.user.email))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { status, notes } = (await req.json()) as {
    status: string;
    notes?: string;
  };

  const validStatuses = ["approved", "rejected", "more_info", "under_review"];
  if (!validStatuses.includes(status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  await updateLoanStatus(id, status, notes ?? "", session.user.name ?? "staff");
  return NextResponse.json({ success: true });
}
