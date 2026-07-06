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
import {
  computeAffordability,
  validateLoanApplication,
  generateUnderwritingSummary,
} from "@/lib/loans/underwriting";
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
  const { salary, expenses, deposit, propertyValue, employment, existingDebts } = body;

  const financials = {
    salary: Number(salary),
    expenses: Number(expenses),
    deposit: Number(deposit),
    propertyValue: Number(propertyValue),
    existingDebts: Number(existingDebts) || 0,
  };

  const validation = validateLoanApplication({ ...financials, employment });
  if (!validation.valid)
    return NextResponse.json({ error: validation.error }, { status: 400 });

  const { loanAmount, dti, ltv } = computeAffordability(financials);

  const aiSummary = await generateUnderwritingSummary({
    userName: session.user.name ?? "",
    employment,
    ...financials,
    loanAmount,
    dti,
    ltv,
  });

  const id = uuid();
  const userId = (session.user as { id?: string }).id ?? "";

  await createLoanApplication({
    id,
    userId,
    userName: session.user.name ?? "",
    email: session.user.email ?? "",
    ...financials,
    employmentType: employment,
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
