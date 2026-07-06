/**
 * app/admin/loans/[id]/page.tsx
 *
 * Loan detail page for bank advisors.
 * Shows full application details, AI summary, and approve/reject form.
 * Only accessible to admin emails.
 */

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/admin/StatusBadge";

interface LoanApplication {
  id: string;
  user_name: string;
  email: string;
  salary: number;
  expenses: number;
  deposit: number;
  property_value: number;
  employment_type: string;
  existing_debts: number;
  loan_amount: number;
  dti: number;
  ltv: number;
  status: string;
  ai_summary: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
}

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loan, setLoan] = useState<LoanApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // fetch the specific loan application
    fetch(`/api/loan?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        // find the matching application from the list
        const match = data.applications?.find(
          (a: LoanApplication) => a.id === id,
        );
        setLoan(match ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleDecision(status: "approved" | "rejected") {
    if (!notes.trim()) {
      setError("Please add notes before submitting a decision.");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/loan/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--surface-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Loading application...
        </p>
      </div>
    );
  }

  if (!loan) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--surface-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            Application not found
          </p>
          <Link
            href="/admin"
            style={{
              color: "var(--text-brand)",
              fontSize: "0.875rem",
              marginTop: 8,
              display: "block",
              textDecoration: "none",
            }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isPending = loan.status === "pending";

  const fields: Array<{ label: string; value: string; capitalize?: boolean }> = [
    { label: "Loan amount", value: `£${Number(loan.loan_amount).toLocaleString("en-GB")}` },
    { label: "Property value", value: `£${Number(loan.property_value).toLocaleString("en-GB")}` },
    { label: "Deposit", value: `£${Number(loan.deposit).toLocaleString("en-GB")}` },
    { label: "Monthly salary", value: `£${Number(loan.salary).toLocaleString("en-GB")}` },
    { label: "Monthly expenses", value: `£${Number(loan.expenses).toLocaleString("en-GB")}` },
    { label: "Existing debts", value: `£${Number(loan.existing_debts).toLocaleString("en-GB")}` },
    { label: "LTV", value: `${loan.ltv}%` },
    { label: "DTI", value: `${loan.dti}%` },
    { label: "Employment", value: loan.employment_type, capitalize: true },
  ];

  return (
    <div style={{ background: "var(--surface-subtle)", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          background: "var(--surface-raised)",
          borderBottom: "1px solid var(--surface-border)",
          padding: "20px 16px",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ fontSize: "0.875rem" }}>
            <Link
              href="/admin"
              style={{ color: "var(--text-muted)", textDecoration: "none" }}
            >
              Staff portal
            </Link>
            <span style={{ color: "var(--text-muted)", margin: "0 8px" }}>/</span>
            <span style={{ color: "var(--text-primary)" }}>Loan application</span>
          </div>
          <StatusBadge status={loan.status} />
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Applicant header */}
        <div className="card" style={{ padding: 24 }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--text-primary)" }}>
            {loan.user_name}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 2 }}>
            {loan.email}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: 6 }}>
            Submitted {new Date(loan.submitted_at).toLocaleString("en-GB")}
          </p>
        </div>

        {/* Financial details */}
        <div className="card" style={{ padding: 24 }}>
          <h2
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 16,
            }}
          >
            Financial details
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12,
            }}
          >
            {fields.map((item) => (
              <div
                key={item.label}
                style={{
                  background: "var(--surface-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: 12,
                }}
              >
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.label}</p>
                <p
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginTop: 2,
                    textTransform: item.capitalize ? "capitalize" : "none",
                  }}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* AI summary - deliberately styled as a secondary reference note,
            not a highlighted callout, so it doesn't outweigh the raw
            figures above it in the reviewer's attention. */}
        {loan.ai_summary && (
          <div
            className="card"
            style={{
              padding: 24,
              background: "var(--surface-subtle)",
            }}
          >
            <h2
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 10,
              }}
            >
              AI underwriter note (reference only - not a decision)
            </h2>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {loan.ai_summary}
            </p>
          </div>
        )}

        {/* Already reviewed */}
        {!isPending && (
          <div className="card" style={{ padding: 24, background: "var(--surface-subtle)" }}>
            <h2
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 8,
              }}
            >
              Decision
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              <span style={{ fontWeight: 600, textTransform: "capitalize", color: "var(--text-primary)" }}>
                {loan.status}
              </span>{" "}
              by {loan.reviewed_by} on{" "}
              {loan.reviewed_at ? new Date(loan.reviewed_at).toLocaleString("en-GB") : "unknown"}
            </p>
            {loan.notes && (
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: 8, fontStyle: "italic" }}>
                &ldquo;{loan.notes}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Review form - only shows if pending */}
        {isPending && (
          <div className="card" style={{ padding: 24 }}>
            <h2
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 16,
              }}
            >
              Make a decision
            </h2>

            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: 6,
              }}
            >
              Notes (required)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add your assessment notes before approving or rejecting..."
              className="input-field"
              style={{ resize: "none" }}
            />

            {error && (
              <p style={{ color: "var(--error-700)", fontSize: "0.875rem", marginTop: 8 }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button
                onClick={() => handleDecision("approved")}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: submitting ? "var(--surface-border)" : "#16a34a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: submitting ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {submitting ? "Saving..." : "Approve"}
              </button>
              <button
                onClick={() => handleDecision("rejected")}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: submitting ? "var(--surface-border)" : "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: submitting ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {submitting ? "Saving..." : "Reject"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
