"use client";

/**
 * app/chat/page.tsx
 *
 * CHANGES vs previous version
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. CONVERSATION HISTORY  — last 6 turns sent to /api/chat on every request
 *    so the LLM has context for follow-ups like "what about last month?".
 *
 * 2. CONTEXTUAL CHIPS  — after every bot reply, 3 smart follow-up chips appear
 *    below the message, chosen based on the detected intent returned by the API.
 *    They disappear the moment the user sends their next message.
 *
 * 3. SPENDING CHIPS  — when intent === "spending", chips offer drill-down
 *    queries like "Show my transactions" or "Which month was worst?".
 */

import { useState, useRef, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

interface HistoryTurn {
  role: "user" | "bot";
  content: string;
}

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
  intent?: string;
  metadata?: Record<string, unknown>;
}

// ── Contextual chips per intent ────────────────────────────────────────────────
const CHIPS_BY_INTENT: Record<string, string[]> = {
  balance: [
    "Show my transactions",
    "Analyse my spending",
    "Statement for last month",
  ],
  transactions: [
    "Analyse my spending",
    "Check my balance",
    "Transactions last month",
  ],
  spending: ["Show my transactions", "Check my balance", "Spending last month"],
  onboard: [
    "What documents do I need?",
    "How long does verification take?",
    "What accounts do you offer?",
  ],
  rag: [
    "What are your opening hours?",
    "How do I open an account?",
    "Is my money protected?",
  ],
  greeting: [
    "Check my balance",
    "Show my transactions",
    "How do I open an account?",
  ],
  loan: ["Book an advisor appointment", "Show my balance", "Apply for a credit card"],
  appointment: ["Show my balance", "Investment options", "Apply for a credit card"],
  investment: ["Book an investment advisor", "Open a Cash ISA", "Show my balance"],
  credit_card: ["Book an appointment", "Apply for a loan", "Show my balance"],
};

// ── Fallback chips shown before first message ──────────────────────────────────
const INITIAL_SUGGESTED = [
  "What are your opening hours?",
  "How do I open an account?",
  "What documents do I need?",
  "What savings rates do you offer?",
  "How do I report a lost card?",
  "Is my money protected?",
];

const INITIAL_ACCOUNT_SUGGESTED = [
  "Show me my balance",
  "Analyse my spending",
  "Statement for last month",
  "Show my recent transactions",
];

// ── Icons ─────────────────────────────────────────────────────────────────────
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M1 8h14M9 2l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BotAvatar() {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: "var(--brand-500)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: 14,
      }}
    >
      🏦
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
      <BotAvatar />
      <div
        className="bubble-bot"
        style={{
          display: "flex",
          gap: 5,
          alignItems: "center",
          padding: "12px 16px",
        }}
      >
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

function TransactionTable({
  transactions,
}: {
  transactions: Record<string, unknown>[];
}) {
  return (
    <div
      style={{
        marginTop: 12,
        overflow: "hidden",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--surface-border)",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.8125rem",
        }}
      >
        <thead>
          <tr style={{ background: "var(--surface-subtle)" }}>
            {["Date", "Description", "Amount"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.slice(0, 8).map((t, i) => (
            <tr
              key={i}
              style={{ borderTop: "1px solid var(--surface-divider)" }}
            >
              <td
                style={{
                  padding: "8px 12px",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {String(t.date)}
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {String(t.description)}
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  whiteSpace: "nowrap",
                  fontWeight: 500,
                  color:
                    Number(t.amount) < 0
                      ? "var(--error-700)"
                      : "var(--success-700)",
                }}
              >
                {Number(t.amount) < 0 ? "-" : "+"}£
                {Math.abs(Number(t.amount)).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Chip button ───────────────────────────────────────────────────────────────
function ChipButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 13px",
        background: "var(--surface-raised)",
        border: "1px solid var(--surface-border)",
        borderRadius: "var(--radius-full)",
        fontSize: "0.8rem",
        color: "var(--text-brand)",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--brand-50)";
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "var(--brand-200, #c7d8ff)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--surface-raised)";
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "var(--surface-border)";
      }}
    >
      {label}
    </button>
  );
}

// ── Shared success card ────────────────────────────────────────────────────────
function SuccessCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: "14px 16px",
        background: "var(--surface-raised)",
        border: "1px solid var(--surface-border)",
        borderRadius: 10,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 18 }}>✅</span>
      <div>
        <div
          style={{
            fontWeight: 500,
            fontSize: "0.875rem",
            color: "var(--text-primary)",
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

// ── Appointment booking form ───────────────────────────────────────────────────
function InlineAppointmentForm() {
  const [form, setForm] = useState({
    advisorType: "general",
    preferredDate: "",
    preferredTime: "09:00",
    reason: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.preferredDate) {
      setError("Please select a preferred date.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Booking failed");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  const fieldInput: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--surface-border)",
    borderRadius: 6,
    fontSize: "0.8125rem",
    background: "var(--surface-subtle)",
    color: "var(--text-primary)",
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };

  const [minDateStr, setMinDateStr] = useState("");
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setMinDateStr(d.toISOString().split("T")[0]);
  }, []);

  if (submitted)
    return (
      <SuccessCard
        title="Appointment booked"
        body="A NovaBanк advisor will confirm your slot via email within 1 business day."
      />
    );

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: 10,
        padding: "16px",
        background: "var(--surface-raised)",
        border: "1px solid var(--surface-border)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 480,
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Book an Appointment
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          Advisor type
        </label>
        <select
          value={form.advisorType}
          onChange={(e) => setField("advisorType", e.target.value)}
          style={fieldInput}
        >
          <option value="general">General banking</option>
          <option value="mortgage">Mortgage advisor</option>
          <option value="investment">Investment advisor</option>
          <option value="business">Business banking</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
          >
            Preferred date *
          </label>
          <input
            type="date"
            min={minDateStr}
            value={form.preferredDate}
            onChange={(e) => setField("preferredDate", e.target.value)}
            style={fieldInput}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
          >
            Preferred time
          </label>
          <select
            value={form.preferredTime}
            onChange={(e) => setField("preferredTime", e.target.value)}
            style={fieldInput}
          >
            {["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"].map(
              (t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          Reason for appointment (optional)
        </label>
        <input
          type="text"
          placeholder="e.g. Review my mortgage options"
          value={form.reason}
          onChange={(e) => setField("reason", e.target.value)}
          style={fieldInput}
        />
      </div>

      {error && (
        <div style={{ fontSize: "0.8rem", color: "var(--error-700, #b91c1c)" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "9px 16px",
          background: loading
            ? "var(--surface-border)"
            : "var(--brand-500, #4f6ef7)",
          color: "#fff",
          border: "none",
          borderRadius: 7,
          fontSize: "0.875rem",
          fontWeight: 500,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          transition: "background 0.15s",
        }}
      >
        {loading ? "Booking…" : "Book appointment →"}
      </button>
    </form>
  );
}

// ── Investment options panel ───────────────────────────────────────────────────
function InlineInvestmentPanel() {
  const products = [
    {
      name: "Cash ISA",
      rate: "4.6% AER",
      desc: "Tax-free savings up to £20,000/year. Withdraw any time.",
      badge: "Tax-free",
      badgeColor: "#16a34a",
    },
    {
      name: "Stocks & Shares ISA",
      rate: "Market returns",
      desc: "Invest in funds and shares tax-free. Capital at risk.",
      badge: "High potential",
      badgeColor: "#2563eb",
    },
    {
      name: "Easy Access Saver",
      rate: "4.5% AER",
      desc: "Instant access to your money with a great rate.",
      badge: "Flexible",
      badgeColor: "#7c3aed",
    },
    {
      name: "Fixed Rate Bond",
      rate: "5.1% AER",
      desc: "Lock in for 1–3 years for our highest guaranteed rate.",
      badge: "Best rate",
      badgeColor: "#b45309",
    },
  ];

  return (
    <div
      style={{
        marginTop: 10,
        padding: "16px",
        background: "var(--surface-raised)",
        border: "1px solid var(--surface-border)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 480,
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Investment Options
      </div>

      {products.map((p) => (
        <div
          key={p.name}
          style={{
            padding: "12px 14px",
            background: "var(--surface-subtle)",
            borderRadius: 8,
            border: "1px solid var(--surface-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 3,
              }}
            >
              <span
                style={{
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  color: "var(--text-primary)",
                }}
              >
                {p.name}
              </span>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: p.badgeColor + "20",
                  color: p.badgeColor,
                }}
              >
                {p.badge}
              </span>
            </div>
            <div
              style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
            >
              {p.desc}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--brand-500, #4f6ef7)",
              }}
            >
              {p.rate}
            </div>
          </div>
        </div>
      ))}

      <p
        style={{
          fontSize: "0.7rem",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        Rates correct as of today. Capital at risk for investment products.
        Ask me to book an investment advisor for personalised advice.
      </p>
    </div>
  );
}

// ── Credit card application form ──────────────────────────────────────────────
function InlineCreditCardForm() {
  const [form, setForm] = useState({
    cardType: "standard",
    annualIncome: "",
    employmentType: "full-time",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.annualIncome) {
      setError("Please enter your annual income.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/credit-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardType: form.cardType,
          annualIncome: parseFloat(form.annualIncome),
          employmentType: form.employmentType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Application failed");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Application failed");
    } finally {
      setLoading(false);
    }
  }

  const fieldInput: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--surface-border)",
    borderRadius: 6,
    fontSize: "0.8125rem",
    background: "var(--surface-subtle)",
    color: "var(--text-primary)",
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };

  const cards = [
    {
      id: "standard",
      name: "Standard",
      perks: "0% foreign transaction fees · Up to £5,000 limit",
      fee: "No annual fee",
    },
    {
      id: "cashback",
      name: "Cashback",
      perks: "1.5% cashback on all spending · Up to £10,000 limit",
      fee: "£5/month",
    },
    {
      id: "premium",
      name: "Premium",
      perks: "2% cashback · Travel insurance · Airport lounge access",
      fee: "£15/month",
    },
  ];

  if (submitted)
    return (
      <SuccessCard
        title="Credit card application submitted"
        body="We'll review your application and you'll hear back within 2–3 business days."
      />
    );

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: 10,
        padding: "16px",
        background: "var(--surface-raised)",
        border: "1px solid var(--surface-border)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 480,
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Credit Card Application
      </div>

      {/* Card type selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          Choose your card
        </label>
        {cards.map((c) => (
          <label
            key={c.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 12px",
              border: `1.5px solid ${form.cardType === c.id ? "var(--brand-500, #4f6ef7)" : "var(--surface-border)"}`,
              borderRadius: 8,
              cursor: "pointer",
              background:
                form.cardType === c.id
                  ? "var(--brand-50, #eef2ff)"
                  : "var(--surface-subtle)",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <input
              type="radio"
              name="cardType"
              value={c.id}
              checked={form.cardType === c.id}
              onChange={() => setField("cardType", c.id)}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <div>
              <div
                style={{
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  color: "var(--text-primary)",
                }}
              >
                {c.name}{" "}
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    fontWeight: 400,
                  }}
                >
                  — {c.fee}
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  marginTop: 2,
                }}
              >
                {c.perks}
              </div>
            </div>
          </label>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
          >
            Annual income (£) *
          </label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 35000"
            value={form.annualIncome}
            onChange={(e) => setField("annualIncome", e.target.value)}
            style={fieldInput}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
          >
            Employment type
          </label>
          <select
            value={form.employmentType}
            onChange={(e) => setField("employmentType", e.target.value)}
            style={fieldInput}
          >
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="self-employed">Self-employed</option>
            <option value="contractor">Contractor</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: "0.8rem", color: "var(--error-700, #b91c1c)" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "9px 16px",
          background: loading
            ? "var(--surface-border)"
            : "var(--brand-500, #4f6ef7)",
          color: "#fff",
          border: "none",
          borderRadius: 7,
          fontSize: "0.875rem",
          fontWeight: 500,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          transition: "background 0.15s",
        }}
      >
        {loading ? "Submitting…" : "Apply now →"}
      </button>

      <p
        style={{
          fontSize: "0.7rem",
          color: "var(--text-muted)",
          margin: 0,
          textAlign: "center",
        }}
      >
        Subject to credit check. Your data is encrypted and secure.
      </p>
    </form>
  );
}

// ── Inline loan application form ──────────────────────────────────────────────
function InlineLoanForm() {
  const [form, setForm] = useState({
    salary: "",
    expenses: "",
    deposit: "",
    propertyValue: "",
    employment: "full-time",
    existingDebts: "0",
    loanPurpose: "mortgage",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const n = (k: string) =>
    parseFloat(form[k as keyof typeof form] as string) || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const salary = n("salary");
    const expenses = n("expenses");
    const deposit = n("deposit");
    const propertyValue = n("propertyValue");
    const existingDebts = n("existingDebts");

    if (!salary || !propertyValue || !deposit) {
      setError("Please fill in all required fields.");
      return;
    }
    if (deposit >= propertyValue) {
      setError("Deposit cannot exceed property value.");
      return;
    }

    const loanAmount = propertyValue - deposit;
    const dti =
      salary > 0
        ? Math.round(((expenses + existingDebts) / salary) * 100)
        : 0;
    const ltv = Math.round((loanAmount / propertyValue) * 100);

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/loan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salary,
          expenses,
          deposit,
          propertyValue,
          employment: form.employment,
          existingDebts,
          loanAmount,
          dti,
          ltv,
          loanPurpose: form.loanPurpose,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  const fieldInput: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--surface-border)",
    borderRadius: 6,
    fontSize: "0.8125rem",
    background: "var(--surface-subtle)",
    color: "var(--text-primary)",
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };

  if (submitted) {
    return (
      <div
        style={{
          marginTop: 10,
          padding: "14px 16px",
          background: "var(--surface-raised)",
          border: "1px solid var(--surface-border)",
          borderRadius: 10,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18 }}>✅</span>
        <div>
          <div
            style={{
              fontWeight: 500,
              fontSize: "0.875rem",
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            Application submitted for human review
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            A NovaBanк advisor will review your details and contact you within
            2–3 business days.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: 10,
        padding: "16px",
        background: "var(--surface-raised)",
        border: "1px solid var(--surface-border)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 480,
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Loan Application
      </div>

      {/* Loan purpose */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label
          style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
        >
          Loan purpose
        </label>
        <select
          value={form.loanPurpose}
          onChange={(e) => setField("loanPurpose", e.target.value)}
          style={fieldInput}
        >
          <option value="mortgage">Mortgage</option>
          <option value="personal">Personal loan</option>
          <option value="car">Car loan</option>
          <option value="home">Home loan</option>
          <option value="remortgage">Remortgage</option>
          <option value="buy-to-let">Buy to let</option>
        </select>
      </div>

      {/* Property value + Deposit */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
          >
            Property value (£) *
          </label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 250000"
            value={form.propertyValue}
            onChange={(e) => setField("propertyValue", e.target.value)}
            style={fieldInput}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
          >
            Deposit (£) *
          </label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 30000"
            value={form.deposit}
            onChange={(e) => setField("deposit", e.target.value)}
            style={fieldInput}
          />
        </div>
      </div>

      {/* Employment */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label
          style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
        >
          Employment type
        </label>
        <select
          value={form.employment}
          onChange={(e) => setField("employment", e.target.value)}
          style={fieldInput}
        >
          <option value="full-time">Full-time employed</option>
          <option value="part-time">Part-time employed</option>
          <option value="self-employed">Self-employed</option>
          <option value="contractor">Contractor</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      {/* Salary + Expenses */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
          >
            Monthly salary (£) *
          </label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 3500"
            value={form.salary}
            onChange={(e) => setField("salary", e.target.value)}
            style={fieldInput}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
          >
            Monthly expenses (£) *
          </label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 1200"
            value={form.expenses}
            onChange={(e) => setField("expenses", e.target.value)}
            style={fieldInput}
          />
        </div>
      </div>

      {/* Existing debts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label
          style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
        >
          Existing loan / credit repayments (£/month)
        </label>
        <input
          type="number"
          min="0"
          placeholder="0"
          value={form.existingDebts}
          onChange={(e) => setField("existingDebts", e.target.value)}
          style={fieldInput}
        />
      </div>

      {/* Live affordability metrics */}
      {n("salary") > 0 && n("propertyValue") > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            padding: "10px 12px",
            background: "var(--surface-subtle)",
            borderRadius: 8,
            fontSize: "0.75rem",
          }}
        >
          {[
            {
              label: "Loan amount",
              value:
                n("propertyValue") > n("deposit")
                  ? `£${(n("propertyValue") - n("deposit")).toLocaleString()}`
                  : "—",
            },
            {
              label: "LTV",
              value:
                n("propertyValue") > 0
                  ? `${Math.round(((n("propertyValue") - n("deposit")) / n("propertyValue")) * 100)}%`
                  : "—",
            },
            {
              label: "DTI ratio",
              value:
                n("salary") > 0
                  ? `${Math.round(((n("expenses") + n("existingDebts")) / n("salary")) * 100)}%`
                  : "—",
            },
            {
              label: "Est. monthly payment",
              value:
                n("propertyValue") > n("deposit")
                  ? `~£${Math.round(((n("propertyValue") - n("deposit")) * 0.045) / 12).toLocaleString()}`
                  : "—",
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ color: "var(--text-muted)" }}>{label}</div>
              <div
                style={{
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  marginTop: 2,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          style={{ fontSize: "0.8rem", color: "var(--error-700, #b91c1c)" }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "9px 16px",
          background: loading
            ? "var(--surface-border)"
            : "var(--brand-500, #4f6ef7)",
          color: "#fff",
          border: "none",
          borderRadius: 7,
          fontSize: "0.875rem",
          fontWeight: 500,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          transition: "background 0.15s",
        }}
      >
        {loading ? "Submitting…" : "Submit for review →"}
      </button>

      <p
        style={{
          fontSize: "0.7rem",
          color: "var(--text-muted)",
          margin: 0,
          textAlign: "center",
        }}
      >
        Your data is encrypted and only used for this application.
      </p>
    </form>
  );
}

// ── Main chat component ───────────────────────────────────────────────────────
function ChatContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content:
        "Hi! I'm NovaBanк's AI assistant. I can help you with opening hours, account information, how to open an account, and much more.\n\nIf you're signed in, I can also show your balance, transactions, and spending breakdown.",
      timestamp: new Date(),
      intent: "greeting",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Track which message's chips are currently visible — only the latest bot msg
  const [activeChipsMsgId, setActiveChipsMsgId] = useState<string>("welcome");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Build history from current messages for next API call (last 6 turns)
  function buildHistory(msgs: Message[]): HistoryTurn[] {
    return msgs
      .filter((m) => m.id !== "welcome")
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Hide chips the moment user sends
    setActiveChipsMsgId("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    // Build history BEFORE updating state, then update state and fire API separately
    const currentHistory = buildHistory([...messages, userMsg]);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    fetchBot(trimmed, currentHistory);
  }

  async function fetchBot(text: string, history: HistoryTurn[]) {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();

      const botId = (Date.now() + 1).toString();
      const botMsg: Message = {
        id: botId,
        role: "bot",
        content: data.response || data.error || "Sorry, something went wrong.",
        timestamp: new Date(),
        intent: data.intent,
        metadata: data.metadata,
      };

      setMessages((prev) => [...prev, botMsg]);
      setActiveChipsMsgId(botId);
    } catch {
      const errId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        {
          id: errId,
          role: "bot",
          content: "Connection error. Please try again or call 0800 123 4567.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const initialChips = session ? INITIAL_ACCOUNT_SUGGESTED : INITIAL_SUGGESTED;
  const showInitialChips = messages.length <= 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      {/* Session bar */}
      {session && (
        <div
          style={{
            padding: "10px 20px",
            background: "var(--brand-50)",
            borderBottom: "1px solid var(--brand-100, #e0eaff)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.8125rem",
            color: "var(--text-brand)",
          }}
        >
          <span>🔐</span>
          <span>
            Signed in as <strong>{session.user?.name}</strong> — I can access
            your account details.
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>
        {/* Initial chips — only before first message */}
        {showInitialChips && (
          <div style={{ marginBottom: 24 }}>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginBottom: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Try asking
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {initialChips.map((s) => (
                <ChipButton key={s} label={s} onClick={() => sendMessage(s)} />
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            paddingBottom: 20,
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="animate-fade-in"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                gap: 4,
              }}
            >
              {msg.role === "bot" && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-end",
                    maxWidth: "100%",
                  }}
                >
                  <BotAvatar />
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {!(
                      msg.intent === "transactions" &&
                      Array.isArray(msg.metadata?.transactions) &&
                      (msg.metadata!.transactions as unknown[]).length > 0
                    ) && (
                      <div
                        className="bubble-bot"
                        style={{ whiteSpace: "pre-wrap" }}
                      >
                        {msg.content}
                      </div>
                    )}

                    {/* Transaction table */}
                    {Array.isArray(msg.metadata?.transactions) &&
                      (msg.metadata!.transactions as unknown[]).length > 0 &&
                      msg.intent === "transactions" && (
                        <TransactionTable
                          transactions={
                            msg.metadata!.transactions as Record<
                              string,
                              unknown
                            >[]
                          }
                        />
                      )}

                    {/* Inline loan application form */}
                    {!!msg.metadata?.showLoanCTA && <InlineLoanForm />}

                    {/* Inline appointment booking */}
                    {!!msg.metadata?.showAppointmentCTA && (
                      <InlineAppointmentForm />
                    )}

                    {/* Inline investment options */}
                    {!!msg.metadata?.showInvestmentCTA && (
                      <InlineInvestmentPanel />
                    )}

                    {/* Inline credit card application */}
                    {!!msg.metadata?.showCreditCardCTA && (
                      <InlineCreditCardForm />
                    )}

                    {/* Contextual follow-up chips — only for the latest bot message */}
                    {msg.id === activeChipsMsgId &&
                      msg.intent &&
                      CHIPS_BY_INTENT[msg.intent] && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: 4,
                          }}
                        >
                          {CHIPS_BY_INTENT[msg.intent].map((chip) => (
                            <ChipButton
                              key={chip}
                              label={chip}
                              onClick={() => sendMessage(chip)}
                            />
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              )}

              {msg.role === "user" && (
                <div className="bubble-user">{msg.content}</div>
              )}

              <span
                suppressHydrationWarning
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  marginLeft: msg.role === "bot" ? 40 : 0,
                }}
              >
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div
        style={{
          padding: "16px 20px 20px",
          borderTop: "1px solid var(--surface-border)",
          background: "var(--surface-raised)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            background: "var(--surface-subtle)",
            border: "1px solid var(--surface-border)",
            borderRadius: "var(--radius-lg)",
            padding: "10px 14px",
            transition: "border-color 0.15s",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height =
                Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about NovaBanк..."
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              resize: "none",
              border: "none",
              background: "transparent",
              fontSize: "0.9375rem",
              color: "var(--text-primary)",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: 1.5,
              maxHeight: 120,
              overflow: "auto",
            }}
          />
          <button
            className="btn-primary"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 36,
              height: 36,
              padding: 0,
              borderRadius: "50%",
              flexShrink: 0,
              marginBottom: 2,
            }}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--text-muted)",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          NovaBanк AI may make mistakes. For urgent help call 0800 123 4567.
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}
