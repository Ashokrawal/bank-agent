/**
 * app/admin/appointments/[id]/page.tsx
 *
 * Appointment detail page for bank advisors.
 * Shows full booking details and confirm/cancel form.
 * Only accessible to admin emails.
 */

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Appointment {
  id: string;
  user_name: string;
  email: string;
  advisor_type: string;
  preferred_date: string;
  preferred_time: string;
  reason: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/appointment`)
      .then((r) => r.json())
      .then((data) => {
        const match = data.appointments?.find((a: Appointment) => a.id === id);
        setAppointment(match ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleDecision(status: "confirmed" | "cancelled") {
    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/appointment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    });

    console.log("PATCH status:", res.status); // add this

    if (res.ok) {
      setTimeout(() => router.push("/admin"), 100);
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading appointment...</p>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 font-medium">Appointment not found</p>
          <Link href="/admin" className="text-blue-600 text-sm mt-2 block">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isPending = appointment.status === "pending";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <Link
              href="/admin"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Staff portal
            </Link>
            <span className="text-gray-300 mx-2">/</span>
            <span className="text-sm text-gray-900">Appointment</span>
          </div>
          <StatusBadge status={appointment.status} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Customer details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {appointment.user_name}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{appointment.email}</p>
          <p className="text-gray-400 text-xs mt-1">
            Booked {new Date(appointment.created_at).toLocaleString("en-GB")}
          </p>
        </div>

        {/* Appointment details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            Booking details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Advisor type", value: appointment.advisor_type },
              { label: "Preferred date", value: appointment.preferred_date },
              { label: "Preferred time", value: appointment.preferred_time },
              { label: "Status", value: appointment.status },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5 capitalize">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {appointment.reason && (
            <div className="mt-4 bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Reason</p>
              <p className="text-sm text-gray-700 mt-0.5">
                {appointment.reason}
              </p>
            </div>
          )}
        </div>

        {/* Already reviewed */}
        {!isPending && (
          <div className="bg-gray-100 rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Decision
            </h2>
            <p className="text-sm text-gray-700 capitalize">
              {appointment.status} on{" "}
              {appointment.reviewed_at
                ? new Date(appointment.reviewed_at).toLocaleString("en-GB")
                : "unknown"}
            </p>
          </div>
        )}

        {/* Review form */}
        {isPending && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
              Make a decision
            </h2>

            <label className="block text-sm text-gray-700 mb-1 font-medium">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes for the customer..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleDecision("confirmed")}
                disabled={submitting}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {submitting ? "Saving..." : "Confirm appointment"}
              </button>
              <button
                onClick={() => handleDecision("cancelled")}
                disabled={submitting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {submitting ? "Saving..." : "Cancel appointment"}
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
    confirmed: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}
