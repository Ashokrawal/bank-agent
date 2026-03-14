import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  createCreditCardApplication,
  getCreditCardApplications,
} from "@/lib/db/sqlite";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const userId = (session.user as { id?: string }).id ?? "";
  const applications = await getCreditCardApplications(undefined, userId);
  return NextResponse.json({ applications });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Must be signed in" }, { status: 401 });

  const body = await req.json();
  const { cardType, annualIncome, employmentType } = body;

  if (!cardType || !annualIncome || !employmentType)
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );

  const allowedCardTypes = ["standard", "cashback", "premium"];
  if (!allowedCardTypes.includes(String(cardType).toLowerCase()))
    return NextResponse.json({ error: "Invalid card type" }, { status: 400 });

  const income = Number(annualIncome);
  if (!Number.isFinite(income) || income < 0 || income > 10_000_000)
    return NextResponse.json({ error: "Invalid annual income" }, { status: 400 });

  const allowedEmployment = ["employed", "self-employed", "contractor", "part-time", "unemployed"];
  if (!allowedEmployment.includes(String(employmentType).toLowerCase()))
    return NextResponse.json({ error: "Invalid employment type" }, { status: 400 });

  const id = uuid();
  const userId = (session.user as { id?: string }).id ?? "";

  try {
    await createCreditCardApplication({
      id,
      userId,
      userName: session.user.name ?? "",
      email: session.user.email ?? "",
      cardType,
      annualIncome: Number(annualIncome),
      employmentType,
    });
  } catch (e) {
    console.error("Credit card API:", e);
    return NextResponse.json(
      { error: "Failed to save application. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, applicationId: id });
}
