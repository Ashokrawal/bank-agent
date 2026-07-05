/**
 * POST /api/loan  — save loan application + generate AI summary
 * GET  /api/loan  — list applications (admin sees all, customers see own)
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
import { isAdminEmail } from "@/lib/admin";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

// GET - admin sees all, customers see only their own
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;

  // if admin, pass no userId filter so all applications come back
  // if customer, filter to their own applications only
  const admin = isAdminEmail(session.user?.email);
  const userId = admin
    ? undefined
    : ((session.user as { id?: string }).id ?? "");

  const apps = await getLoanApplications(status, admin ? undefined : userId);
  return NextResponse.json({ applications: apps });
}

// POST - customer submits a loan application
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

  if (!salary || !propertyValue || !deposit || !employment)
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );

  const financialFields: Record<string, [number, number]> = {
    salary: [100, 1_000_000],
    expenses: [0, 500_000],
    deposit: [1, 10_000_000],
    propertyValue: [1, 50_000_000],
    existingDebts: [0, 500_000],
    loanAmount: [1, 20_000_000],
    dti: [0, 200],
    ltv: [0, 200],
  };

  for (const [field, [min, max]] of Object.entries(financialFields)) {
    const val = Number(body[field]);
    if (!Number.isFinite(val) || val < min || val > max)
      return NextResponse.json(
        { error: `Invalid value for ${field}` },
        { status: 400 },
      );
  }

  const allowedEmployment = [
    "full-time",
    "part-time",
    "self-employed",
    "contractor",
    "retired",
  ];
  if (!allowedEmployment.includes(String(employment).toLowerCase()))
    return NextResponse.json(
      { error: "Invalid employment type" },
      { status: 400 },
    );

  // generate AI underwriter summary
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
    aiSummary = "Summary unavailable - please review manually.";
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
