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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading application...</p>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 font-medium">Application not found</p>
          <Link href="/admin" className="text-blue-600 text-sm mt-2 block">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isPending = loan.status === "pending";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <Link
              href="/admin"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Staff portal
            </Link>
            <span className="text-gray-300 mx-2">/</span>
            <span className="text-sm text-gray-900">Loan application</span>
          </div>
          <StatusBadge status={loan.status} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Applicant header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {loan.user_name}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{loan.email}</p>
          <p className="text-gray-400 text-xs mt-1">
            Submitted {new Date(loan.submitted_at).toLocaleString("en-GB")}
          </p>
        </div>

        {/* Financial details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            Financial details
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              {
                label: "Loan amount",
                value: `£${Number(loan.loan_amount).toLocaleString("en-GB")}`,
              },
              {
                label: "Property value",
                value: `£${Number(loan.property_value).toLocaleString("en-GB")}`,
              },
              {
                label: "Deposit",
                value: `£${Number(loan.deposit).toLocaleString("en-GB")}`,
              },
              {
                label: "Monthly salary",
                value: `£${Number(loan.salary).toLocaleString("en-GB")}`,
              },
              {
                label: "Monthly expenses",
                value: `£${Number(loan.expenses).toLocaleString("en-GB")}`,
              },
              {
                label: "Existing debts",
                value: `£${Number(loan.existing_debts).toLocaleString("en-GB")}`,
              },
              { label: "LTV", value: `${loan.ltv}%` },
              { label: "DTI", value: `${loan.dti}%` },
              {
                label: "Employment",
                value: loan.employment_type,
                capitalize: true,
              },
            ].map((item: any) => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p
                  className={`text-sm font-semibold text-gray-900 mt-0.5 ${item.capitalize ? "capitalize" : ""}`}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* AI summary */}
        {loan.ai_summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-3">
              AI underwriter assessment
            </h2>
            <p className="text-blue-800 text-sm leading-relaxed whitespace-pre-wrap">
              {loan.ai_summary}
            </p>
          </div>
        )}

        {/* Already reviewed */}
        {!isPending && (
          <div className="bg-gray-100 rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Decision
            </h2>
            <p className="text-sm text-gray-700">
              <span className="font-medium capitalize">{loan.status}</span> by{" "}
              {loan.reviewed_by} on{" "}
              {loan.reviewed_at
                ? new Date(loan.reviewed_at).toLocaleString("en-GB")
                : "unknown"}
            </p>
            {loan.notes && (
              <p className="text-sm text-gray-600 mt-2 italic">
                "{loan.notes}"
              </p>
            )}
          </div>
        )}

        {/* Review form - only shows if pending */}
        {isPending && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
              Make a decision
            </h2>

            <label className="block text-sm text-gray-700 mb-1 font-medium">
              Notes (required)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add your assessment notes before approving or rejecting..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleDecision("approved")}
                disabled={submitting}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {submitting ? "Saving..." : "Approve"}
              </button>
              <button
                onClick={() => handleDecision("rejected")}
                disabled={submitting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}
