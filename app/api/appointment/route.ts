import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createAppointment, getAppointments } from "@/lib/db/sqlite";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const userId = (session.user as { id?: string }).id ?? "";
  const appointments = await getAppointments(undefined, userId);
  return NextResponse.json({ appointments });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Must be signed in" }, { status: 401 });

  const body = await req.json();
  const { advisorType, preferredDate, preferredTime, reason } = body;

  if (!advisorType || !preferredDate || !preferredTime)
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );

  const id = uuid();
  const userId = (session.user as { id?: string }).id ?? "";

  try {
    await createAppointment({
      id,
      userId,
      userName: session.user.name ?? "",
      email: session.user.email ?? "",
      advisorType,
      preferredDate,
      preferredTime,
      reason: reason ?? "",
    });
  } catch (e) {
    console.error("Appointment API:", e);
    return NextResponse.json(
      { error: "Failed to save appointment. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, appointmentId: id });
}
