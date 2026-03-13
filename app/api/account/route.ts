import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccountsByUserId, getTransactions } from "@/lib/db/sqlite";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "No user id in session" }, { status: 400 });
    }

    const accounts = await getAccountsByUserId(userId);

    // Get transactions for the primary (first) account
    const primaryAccount = accounts[0];
    const transactions = primaryAccount
      ? await getTransactions(primaryAccount.id as string)
      : [];

    return NextResponse.json({
      accounts: accounts.map(a => ({
        id: a.id,
        name: a.name,
        balance: a.balance,
        type: a.type,
        accountNumber: a.account_number,
        sortCode: a.sort_code,
        status: a.status,
      })),
      transactions: transactions.map(t => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        type: t.type,
      })),
    });
  } catch (err) {
    console.error("Account API error:", err);
    return NextResponse.json({ error: "Failed to fetch account data" }, { status: 500 });
  }
}
