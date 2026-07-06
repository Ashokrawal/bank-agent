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
import StatusBadge from "@/components/admin/StatusBadge";

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
          Loading appointment...
        </p>
      </div>
    );
  }

  if (!appointment) {
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
            Appointment not found
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

  const isPending = appointment.status === "pending";

  const fields = [
    { label: "Advisor type", value: appointment.advisor_type },
    { label: "Preferred date", value: appointment.preferred_date },
    { label: "Preferred time", value: appointment.preferred_time },
    { label: "Status", value: appointment.status },
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
            <span style={{ color: "var(--text-primary)" }}>Appointment</span>
          </div>
          <StatusBadge status={appointment.status} />
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Customer details */}
        <div className="card" style={{ padding: 24 }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--text-primary)" }}>
            {appointment.user_name}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 2 }}>
            {appointment.email}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: 6 }}>
            Booked {new Date(appointment.created_at).toLocaleString("en-GB")}
          </p>
        </div>

        {/* Appointment details */}
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
            Booking details
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
                    textTransform: "capitalize",
                  }}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {appointment.reason && (
            <div
              style={{
                marginTop: 16,
                background: "var(--surface-subtle)",
                borderRadius: "var(--radius-md)",
                padding: 12,
              }}
            >
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Reason</p>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: 2 }}>
                {appointment.reason}
              </p>
            </div>
          )}
        </div>

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
                {appointment.status}
              </span>{" "}
              on{" "}
              {appointment.reviewed_at
                ? new Date(appointment.reviewed_at).toLocaleString("en-GB")
                : "unknown"}
            </p>
          </div>
        )}

        {/* Review form */}
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
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes for the customer..."
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
                onClick={() => handleDecision("confirmed")}
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
                {submitting ? "Saving..." : "Confirm appointment"}
              </button>
              <button
                onClick={() => handleDecision("cancelled")}
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
                {submitting ? "Saving..." : "Cancel appointment"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
