"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Account {
  id: string;
  name: string;
  balance: number;
  type: string;
  accountNumber: string;
  sortCode: string;
  status: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  groceries: "🛒", income: "💰", entertainment: "🎬",
  food: "☕", transport: "🚗", housing: "🏠", bills: "📄",
  shopping: "🛍️", health: "💊", transfer: "↔️",
};

function AccountCard({ account }: { account: Account }) {
  const typeLabels: Record<string, string> = {
    current: "Current Account", savings: "Savings Account",
    isa: "Cash ISA", premium: "Premium Account",
  };

  return (
    <div className="card" style={{ padding: "24px", position: "relative", overflow: "hidden" }}>
      {/* Background accent */}
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 120, height: 120, borderRadius: "50%",
        background: "var(--brand-50)", opacity: 0.6,
      }} />

      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: 4 }}>
              {typeLabels[account.type] || account.type}
            </p>
            <p style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{account.name}</p>
          </div>
          <span className="badge badge-green">Active</span>
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 2 }}>Available balance</p>
          <p style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
            £{Number(account.balance).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div style={{
          display: "flex", gap: 24,
          padding: "12px 0",
          borderTop: "1px solid var(--surface-divider)",
          fontSize: "0.8125rem", color: "var(--text-secondary)",
        }}>
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.75rem" }}>Account</span>
            <span style={{ fontWeight: 500, fontFamily: "monospace" }}>{account.accountNumber}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.75rem" }}>Sort code</span>
            <span style={{ fontWeight: 500, fontFamily: "monospace" }}>{account.sortCode}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ txn }: { txn: Transaction }) {
  const isCredit = Number(txn.amount) > 0;
  const icon = CATEGORY_ICONS[txn.category] || "💳";

  return (
    <div className="txn-row">
      <div style={{
        width: 38, height: 38, borderRadius: "50%",
        background: "var(--surface-subtle)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {String(txn.description)}
        </p>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{String(txn.date)}</p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{
          fontWeight: 600, fontSize: "0.9375rem",
          color: isCredit ? "var(--success-700)" : "var(--text-primary)",
        }}>
          {isCredit ? "+" : ""}£{Math.abs(Number(txn.amount)).toFixed(2)}
        </p>
        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "capitalize" }}>{String(txn.category)}</p>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/account");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/account")
      .then(r => r.json())
      .then(data => {
        setAccounts(data.accounts || []);
        setTransactions(data.transactions || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 180 }} />)}
        </div>
        <div className="card" style={{ padding: 24 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--surface-divider)" }}>
              <div className="skeleton" style={{ width: 38, height: 38, borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 14, width: "60%", marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 11, width: "30%" }} />
              </div>
              <div className="skeleton" style={{ height: 16, width: 60 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {session?.user?.name?.split(" ")[0]} 👋
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Here's your financial overview.</p>
        </div>
        <Link href="/chat" className="btn-primary">
          💬 Ask AI
        </Link>
      </div>

      {/* Account cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
        {accounts.map(acc => <AccountCard key={acc.id} account={acc} />)}
      </div>

      {/* Total summary */}
      <div className="card" style={{ padding: "16px 24px", marginBottom: 24, display: "flex", gap: 32, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 2 }}>Total across all accounts</p>
          <p style={{ fontSize: "1.25rem", fontWeight: 700 }}>
            £{accounts.reduce((sum, a) => sum + Number(a.balance), 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 2 }}>Number of accounts</p>
          <p style={{ fontSize: "1.25rem", fontWeight: 700 }}>{accounts.length}</p>
        </div>
        <div style={{ marginLeft: "auto", alignSelf: "center" }}>
          <Link href="/chat?q=Show+me+my+statement+for+this+month" style={{ fontSize: "0.875rem", color: "var(--text-brand)", textDecoration: "none" }}>
            View full statement →
          </Link>
        </div>
      </div>

      {/* Transactions */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--surface-border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <h2 style={{ fontWeight: 600, fontSize: "1rem" }}>Recent transactions</h2>
          <Link href="/chat?q=Show+my+transactions+for+this+month" style={{ fontSize: "0.8125rem", color: "var(--text-brand)", textDecoration: "none" }}>
            View all
          </Link>
        </div>
        <div style={{ padding: "0 24px" }}>
          {transactions.length === 0 ? (
            <p style={{ color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>No transactions found.</p>
          ) : (
            transactions.slice(0, 10).map(txn => <TransactionRow key={txn.id} txn={txn} />)
          )}
        </div>
      </div>
    </div>
  );
}
