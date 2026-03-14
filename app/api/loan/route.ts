/**
 * POST /api/loan  — save loan application + generate AI summary
 * GET  /api/loan  — list applications (staff)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  createLoanApplication,
  getLoanApplications,
  dbRun,
} from "@/lib/db/sqlite";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

// ── Staff GET ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const userId = (session.user as { id?: string }).id ?? "";
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const apps = await getLoanApplications(status, userId);
  return NextResponse.json({ applications: apps });
}

// ── Customer POST ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Must be signed in" }, { status: 401 });

  const body = await req.json();
  const {
    salary,
    expenses,
    deposit,
    propertyValue,
    employment,
    existingDebts,
    loanAmount,
    dti,
    ltv,
  } = body;

  // Validate required fields exist
  if (!salary || !propertyValue || !deposit || !employment)
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );

  // Validate all financial values are positive numbers within sane ranges
  const financialFields: Record<string, [number, number]> = {
    salary:        [100,    1_000_000],
    expenses:      [0,      500_000],
    deposit:       [1,      10_000_000],
    propertyValue: [1,      50_000_000],
    existingDebts: [0,      500_000],
    loanAmount:    [1,      20_000_000],
    dti:           [0,      200],
    ltv:           [0,      200],
  };

  for (const [field, [min, max]] of Object.entries(financialFields)) {
    const val = Number(body[field]);
    if (!Number.isFinite(val) || val < min || val > max)
      return NextResponse.json(
        { error: `Invalid value for ${field}` },
        { status: 400 },
      );
  }

  const allowedEmployment = ["employed", "self-employed", "contractor", "part-time", "unemployed"];
  if (!allowedEmployment.includes(String(employment).toLowerCase()))
    return NextResponse.json({ error: "Invalid employment type" }, { status: 400 });

  // Generate AI summary
  let aiSummary = "";
  try {
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.1,
      maxOutputTokens: 200,
    });
    const prompt =
      `You are a mortgage underwriter. Write a 3-sentence assessment for a loan officer.\n` +
      `Applicant: ${session.user.name} | Employment: ${employment}\n` +
      `Salary: £${salary}/mo | Expenses: £${expenses}/mo | Existing debts: £${existingDebts}/mo\n` +
      `Property: £${propertyValue} | Deposit: £${deposit} | Loan: £${loanAmount}\n` +
      `DTI: ${dti}% | LTV: ${ltv}%\n\n` +
      `Be concise. End with "Risk: LOW", "Risk: MEDIUM", or "Risk: HIGH".`;

    const res = await llm.invoke([new HumanMessage(prompt)]);
    aiSummary = res.content as string;
  } catch (e) {
    console.error("AI summary error:", e);
    aiSummary = "Summary unavailable — please review manually.";
  }

  const id = uuid();
  const userId = (session.user as { id?: string }).id ?? "";

  await createLoanApplication({
    id,
    userId,
    userName: session.user.name ?? "",
    email: session.user.email ?? "",
    salary,
    expenses,
    deposit,
    propertyValue,
    employmentType: employment,
    existingDebts,
    loanAmount,
    dti,
    ltv,
    answers: JSON.stringify(body),
  });

  await dbRun(`UPDATE loan_applications SET ai_summary = ? WHERE id = ?`, [
    aiSummary,
    id,
  ]);

  return NextResponse.json({ success: true, applicationId: id });
}
