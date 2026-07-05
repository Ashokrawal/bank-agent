/**
 * POST /api/chat
 *
 * The chat API route - entry point for every user message.
 *
 * What changed from prototype.1:
 * - imports runBankAgent from mcpGraph instead of runAgent from graph
 * - CTA flags now come from agent.ctaAction instead of result.intent
 * - removed the intent-based branching - agent handles that now
 * - kept the injection check - that stays at the API layer
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { runBankAgent } from "@/lib/agent/mcpGraph";

export const runtime = "nodejs";
export const maxDuration = 60; // increased - MCP server spawn takes a moment

// ── Input guardrail ───────────────────────────────────────────────────────────
// blocks prompt injection attempts before they reach the LLM
// this lives here not in the agent so bad messages never cost API credits
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
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    // basic validation
    if (!body.message?.trim())
      return NextResponse.json({ error: "message required" }, { status: 400 });

    if (body.message.length > 2000)
      return NextResponse.json({ error: "message too long" }, { status: 400 });

    // input guardrail - block injection before touching the LLM
    if (detectInjection(body.message))
      return NextResponse.json(
        { error: "Message contains disallowed content." },
        { status: 400 },
      );

    // get the logged in user from the session
    // userId gets injected into the agent so tools can query the right data
    let userId = "guest";
    let userName = "Guest";

    try {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        userId = (session.user as { id?: string }).id ?? "guest";
        userName = session.user.name ?? "Guest";
      }
    } catch {
      // not logged in - tools will return no account data
    }

    // cap history at 6 turns - same as before
    const history = (body.history ?? [])
      .filter(
        (t) =>
          (t.role === "user" || t.role === "assistant") &&
          typeof t.content === "string",
      )
      .slice(-6);

    // run the new MCP agent
    // this replaces runAgent from prototype.1
    const result = await runBankAgent({
      message: body.message.trim(),
      userId,
      conversationHistory: history,
    });

    // ── Output guardrail ────────────────────────────────────────────────────
    // basic check - if agent answered a financial question without using
    // any tools, it likely made something up
    const financialKeywords = /balance|transaction|rate|fee|interest/i;
    const answeredFinancial = financialKeywords.test(result.response);
    const usedNoTools = result.toolsUsed.length === 0;

    if (answeredFinancial && usedNoTools) {
      console.warn(
        `[OutputGuardrail] Financial response with no tools used. userId: ${userId}`,
      );
      // log but don't block - could be a general explanation not personal data
    }

    // build the metadata the frontend reads for CTA forms
    // prototype.1 used intent flags - prototype.2 uses ctaAction from the agent
    const metadata: Record<string, unknown> = {
      toolsUsed: result.toolsUsed,
      userName,
    };

    if (result.ctaAction === "SHOW_LOAN_FORM") metadata.showLoanCTA = true;
    if (result.ctaAction === "SHOW_APPOINTMENT_FORM")
      metadata.showAppointmentCTA = true;
    if (result.ctaAction === "SHOW_CREDIT_CARD_FORM")
      metadata.showCreditCardCTA = true;

    return NextResponse.json({
      response: result.response,
      metadata,
    });
  } catch (e) {
    console.error("Chat API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}
