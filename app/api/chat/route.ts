/**
 * POST /api/chat
 * Runs the LangGraph agent and returns { response, intent, metadata }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth/next";
import { authOptions }               from "@/lib/auth";
import { runAgent }                  from "@/lib/agent/graph";

export const runtime    = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json() as { message?: string };

    if (!message?.trim())
      return NextResponse.json({ error: "message required" }, { status: 400 });

    if (message.length > 2000)
      return NextResponse.json({ error: "message too long" }, { status: 400 });

    // Authenticated user (optional — public queries work without login)
    let userId:   string | null = null;
    let userName: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        userId   = (session.user as { id?: string }).id ?? null;
        userName = session.user.name ?? null;
      }
    } catch { /* not logged in */ }

    const result = await runAgent({ message: message.trim(), userId, userName });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Chat API:", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
