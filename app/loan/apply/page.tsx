"use client";

/**
 * app/loan/apply/page.tsx
 * Home loan application form — collects all fields at once,
 * calculates DTI/LTV live, submits to /api/loan.
 */

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface FormData {
  salary: string;
  expenses: string;
  deposit: string;
  propertyValue: string;
  employment: string;
  existingDebts: string;
  loanPurpose: string;
  agree: boolean;
}

const EMPTY: FormData = {
  salary: "",
  expenses: "",
  deposit: "",
  propertyValue: "",
  employment: "full-time",
  existingDebts: "0",
  loanPurpose: "purchase",
  agree: false,
};

// ── Inline field component ────────────────────────────────────────────────────
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--color-text-primary)",
        }}
      >
        {label}
      </label>
      {hint && (
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-tertiary)",
            marginTop: -4,
          }}
        >
          {hint}
        </span>
      )}
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid var(--color-border-secondary)",
  borderRadius: 8,
  fontSize: "0.9375rem",
  color: "var(--color-text-primary)",
  background: "var(--color-background-secondary)",
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

// ── Live affordability metrics ────────────────────────────────────────────────
function AffordabilityPanel({
  salary,
  expenses,
  existingDebts,
  deposit,
  propertyValue,
}: {
  salary: number;
  expenses: number;
  existingDebts: number;
  deposit: number;
  propertyValue: number;
}) {
  const loanAmount = propertyValue - deposit;
  const dti =
    salary > 0 ? Math.round(((expenses + existingDebts) / salary) * 100) : 0;
  const ltv =
    propertyValue > 0 ? Math.round((loanAmount / propertyValue) * 100) : 0;
  const monthly = loanAmount > 0 ? Math.round((loanAmount * 0.045) / 12) : 0; // ~4.5% indicative

  if (!salary && !propertyValue) return null;

  const dtiColor =
    dti < 35
      ? "var(--color-text-success)"
      : dti < 45
        ? "var(--color-text-warning)"
        : "var(--color-text-danger)";
  const ltvColor =
    ltv < 80
      ? "var(--color-text-success)"
      : ltv < 90
        ? "var(--color-text-warning)"
        : "var(--color-text-danger)";

  return (
    <div
      style={{
        background: "var(--color-background-info)",
        border: "1px solid var(--color-border-info)",
        borderRadius: 10,
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          color: "var(--color-text-info)",
          marginBottom: 12,
        }}
      >
        LIVE AFFORDABILITY ESTIMATE
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          {
            label: "Loan amount",
            value: loanAmount > 0 ? `£${loanAmount.toLocaleString()}` : "—",
          },
          {
            label: "Est. monthly payment",
            value: monthly > 0 ? `~£${monthly.toLocaleString()}` : "—",
            sub: "indicative at 4.5%",
          },
          {
            label: "Debt-to-income",
            value: dti > 0 ? `${dti}%` : "—",
            color: dti > 0 ? dtiColor : undefined,
            sub:
              dti > 0
                ? dti < 35
                  ? "healthy"
                  : dti < 45
                    ? "acceptable"
                    : "too high"
                : "",
          },
          {
            label: "Loan-to-value",
            value: ltv > 0 ? `${ltv}%` : "—",
            color: ltv > 0 ? ltvColor : undefined,
            sub:
              ltv > 0
                ? ltv < 80
                  ? "good"
                  : ltv < 90
                    ? "acceptable"
                    : "high — more deposit needed"
                : "",
          },
        ].map(({ label, value, sub, color }) => (
          <div
            key={label}
            style={{
              background: "var(--color-background-primary)",
              borderRadius: 8,
              padding: "10px 14px",
              border: "1px solid var(--color-border-tertiary)",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--color-text-tertiary)",
                marginBottom: 2,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 500,
                color: color ?? "var(--color-text-primary)",
              }}
            >
              {value}
            </div>
            {sub && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--color-text-secondary)",
                  marginTop: 2,
                }}
              >
                {sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LoanApplyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated")
      router.push("/auth/signin?callbackUrl=/loan/apply");
  }, [status, router]);

  function set(key: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const n = (k: keyof FormData) => parseFloat(String(form[k])) || 0;

  function validate(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!n("salary")) e.salary = "Required";
    if (!n("expenses")) e.expenses = "Required";
    if (!n("deposit")) e.deposit = "Required";
    if (!n("propertyValue")) e.propertyValue = "Required";
    if (n("deposit") >= n("propertyValue") && n("propertyValue") > 0)
      e.deposit = "Deposit cannot exceed property value";
    if (!form.agree) e.agree = "You must agree to continue";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const salary = n("salary");
    const expenses = n("expenses");
    const deposit = n("deposit");
    const propertyValue = n("propertyValue");
    const existingDebts = n("existingDebts");
    const loanAmount = propertyValue - deposit;
    const dti = Math.round(((expenses + existingDebts) / salary) * 100);
    const ltv = Math.round((loanAmount / propertyValue) * 100);

    setLoading(true);
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
      setSubmitted(data.applicationId);
    } catch (err) {
      setErrors({
        agree: err instanceof Error ? err.message : "Submission failed",
      });
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") return null;

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: "60px auto",
          padding: "0 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--color-background-success)",
            border: "2px solid var(--color-border-success)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 24,
          }}
        >
          ✓
        </div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 500,
            color: "var(--color-text-primary)",
            margin: "0 0 10px",
          }}
        >
          Application submitted
        </h1>
        <p
          style={{
            color: "var(--color-text-secondary)",
            lineHeight: 1.7,
            margin: "0 0 8px",
          }}
        >
          Thank you, {session?.user?.name?.split(" ")[0]}. Our team will review
          your application and contact you at{" "}
          <strong>{session?.user?.email}</strong> within 2–3 business days.
        </p>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--color-text-tertiary)",
            marginBottom: 28,
          }}
        >
          Application ID: {submitted}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={() => router.push("/chat")}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              cursor: "pointer",
              border: "1px solid var(--color-border-secondary)",
              background: "var(--color-background-secondary)",
              color: "var(--color-text-primary)",
              fontFamily: "inherit",
              fontSize: "0.875rem",
            }}
          >
            Back to chat
          </button>
          <button
            onClick={() => router.push("/account")}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              cursor: "pointer",
              border: "none",
              background: "var(--brand-500, #4f6ef7)",
              color: "#fff",
              fontFamily: "inherit",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            View my account
          </button>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "32px 24px 60px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 500,
            color: "var(--color-text-primary)",
            margin: "0 0 6px",
          }}
        >
          Home loan application
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          Fill in your details below. We'll review your application within 2–3
          business days.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        {/* Section: Loan details */}
        <SectionLabel>Loan details</SectionLabel>

        <Field label="Loan purpose">
          <select
            value={form.loanPurpose}
            onChange={(e) => set("loanPurpose", e.target.value)}
            style={inputStyle}
          >
            <option value="purchase">Purchase a new property</option>
            <option value="remortgage">Remortgage existing property</option>
            <option value="buy-to-let">Buy to let</option>
          </select>
        </Field>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <Field label="Property value (£)" hint="Asking price or valuation">
            <input
              type="number"
              min="0"
              placeholder="e.g. 250000"
              value={form.propertyValue}
              onChange={(e) => set("propertyValue", e.target.value)}
              style={{
                ...inputStyle,
                borderColor: errors.propertyValue
                  ? "var(--color-border-danger)"
                  : undefined,
              }}
            />
            {errors.propertyValue && <ErrMsg>{errors.propertyValue}</ErrMsg>}
          </Field>
          <Field label="Deposit amount (£)" hint="How much you have saved">
            <input
              type="number"
              min="0"
              placeholder="e.g. 30000"
              value={form.deposit}
              onChange={(e) => set("deposit", e.target.value)}
              style={{
                ...inputStyle,
                borderColor: errors.deposit
                  ? "var(--color-border-danger)"
                  : undefined,
              }}
            />
            {errors.deposit && <ErrMsg>{errors.deposit}</ErrMsg>}
          </Field>
        </div>

        {/* Section: Income */}
        <SectionLabel>Your finances</SectionLabel>

        <Field label="Employment type">
          <select
            value={form.employment}
            onChange={(e) => set("employment", e.target.value)}
            style={inputStyle}
          >
            <option value="full-time">Full-time employed</option>
            <option value="part-time">Part-time employed</option>
            <option value="self-employed">Self-employed</option>
            <option value="contractor">Contractor</option>
            <option value="retired">Retired</option>
          </select>
        </Field>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <Field label="Gross monthly salary (£)" hint="Before tax">
            <input
              type="number"
              min="0"
              placeholder="e.g. 3500"
              value={form.salary}
              onChange={(e) => set("salary", e.target.value)}
              style={{
                ...inputStyle,
                borderColor: errors.salary
                  ? "var(--color-border-danger)"
                  : undefined,
              }}
            />
            {errors.salary && <ErrMsg>{errors.salary}</ErrMsg>}
          </Field>
          <Field label="Monthly expenses (£)" hint="Rent, bills, subscriptions">
            <input
              type="number"
              min="0"
              placeholder="e.g. 1200"
              value={form.expenses}
              onChange={(e) => set("expenses", e.target.value)}
              style={{
                ...inputStyle,
                borderColor: errors.expenses
                  ? "var(--color-border-danger)"
                  : undefined,
              }}
            />
            {errors.expenses && <ErrMsg>{errors.expenses}</ErrMsg>}
          </Field>
        </div>

        <Field
          label="Existing loan / credit card repayments (£/month)"
          hint="Enter 0 if none"
        >
          <input
            type="number"
            min="0"
            placeholder="0"
            value={form.existingDebts}
            onChange={(e) => set("existingDebts", e.target.value)}
            style={inputStyle}
          />
        </Field>

        {/* Live affordability panel */}
        <AffordabilityPanel
          salary={n("salary")}
          expenses={n("expenses")}
          existingDebts={n("existingDebts")}
          deposit={n("deposit")}
          propertyValue={n("propertyValue")}
        />

        {/* Agreement */}
        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.agree}
            onChange={(e) => set("agree", e.target.checked)}
            style={{ marginTop: 3, flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: "0.8rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            I confirm the information provided is accurate. I understand this is
            an initial application and NovaBanк may request further
            documentation before a final decision is made.
          </span>
        </label>
        {errors.agree && <ErrMsg>{errors.agree}</ErrMsg>}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 24px",
            borderRadius: 8,
            border: "none",
            background: loading
              ? "var(--color-border-secondary)"
              : "var(--brand-500, #4f6ef7)",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: "1rem",
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {loading ? "Submitting..." : "Submit application"}
        </button>

        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-tertiary)",
            textAlign: "center",
            margin: 0,
          }}
        >
          Your data is encrypted and will only be used for this application. We
          will never share it with third parties without your consent.
        </p>
      </form>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "0.75rem",
        fontWeight: 500,
        color: "var(--color-text-tertiary)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        paddingBottom: 8,
        borderBottom: "1px solid var(--color-border-tertiary)",
      }}
    >
      {children}
    </div>
  );
}

function ErrMsg({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: "0.75rem",
        color: "var(--color-text-danger)",
        marginTop: 2,
      }}
    >
      {children}
    </span>
  );
}
