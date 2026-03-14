/**
 * POST /api/chat
 * Runs the LangGraph agent and returns { response, intent, metadata }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { runAgent, HistoryTurn } from "@/lib/agent/graph";

export const runtime = "nodejs";
export const maxDuration = 30;

// Prompt injection patterns — flag messages that try to override system instructions
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a\s+)?(?!nova)/i,
  /forget\s+(everything|all|your)\s+(you\s+know|instructions?|rules?)/i,
  /system\s*prompt/i,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i,
  /act\s+as\s+(?!a\s+novabank)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?|rules?)/i,
  /override\s+(your\s+)?(instructions?|rules?|behaviour)/i,
];

function detectInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(message));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      message?: string;
      history?: HistoryTurn[];
    };

    if (!body.message?.trim())
      return NextResponse.json({ error: "message required" }, { status: 400 });
    if (body.message.length > 2000)
      return NextResponse.json({ error: "message too long" }, { status: 400 });

    if (detectInjection(body.message))
      return NextResponse.json(
        { error: "Message contains disallowed content." },
        { status: 400 },
      );

    const history: HistoryTurn[] = (body.history ?? [])
      .filter(
        (t) =>
          (t.role === "user" || t.role === "bot") &&
          typeof t.content === "string",
      )
      .slice(-6);

    let userId: string | null = null;
    let userName: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        userId = (session.user as { id?: string }).id ?? null;
        userName = session.user.name ?? null;
      }
    } catch {
      /* not logged in */
    }

    const result = await runAgent({
      message: body.message.trim(),
      userId,
      userName,
      history,
    });

    // Build a fresh metadata object to avoid frozen object issues
    const metadata: Record<string, unknown> = { ...(result.metadata ?? {}) };

    if (result.intent === "loan") metadata.showLoanCTA = true;
    if (result.intent === "appointment") metadata.showAppointmentCTA = true;
    if (result.intent === "investment") metadata.showInvestmentCTA = true;
    if (result.intent === "credit_card") metadata.showCreditCardCTA = true;

    return NextResponse.json({
      response: result.response,
      intent: result.intent,
      metadata,
    });
  } catch (e) {
    console.error("Chat API:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}
