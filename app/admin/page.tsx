/**
 * app/admin/page.tsx
 * NovaBanк Staff Portal - fully responsive
 * Uses design tokens from globals.css
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLoanApplications, getAppointments } from "@/lib/db/sqlite";
import { isAdminEmail } from "@/lib/admin";
import Link from "next/link";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (!isAdminEmail(session.user.email)) redirect("/chat");

  const loans = await getLoanApplications();
  const appointments = await getAppointments();

  const pendingLoans = loans.filter((l) => l.status === "pending");
  const pendingAppointments = appointments.filter(
    (a) => a.status === "pending",
  );

  return (
    <div style={{ background: "var(--surface-subtle)", minHeight: "100vh" }}>
      {/* Page header */}
      <div
        style={{
          background: "var(--surface-raised)",
          borderBottom: "1px solid var(--surface-border)",
          padding: "20px 16px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Staff Portal
            </h1>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              {session.user.email}
            </p>
          </div>
          <Link
            href="/chat"
            style={{
              fontSize: "0.875rem",
              color: "var(--text-brand)",
              textDecoration: "none",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            Back to chat
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* Stats - 2 col mobile, 4 col desktop */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            {
              label: "Pending loans",
              value: pendingLoans.length,
              highlight: pendingLoans.length > 0,
            },
            { label: "Total loans", value: loans.length, highlight: false },
            {
              label: "Pending appointments",
              value: pendingAppointments.length,
              highlight: pendingAppointments.length > 0,
            },
            {
              label: "Total appointments",
              value: appointments.length,
              highlight: false,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="card"
              style={{ padding: "16px 20px" }}
            >
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-muted)",
                  marginBottom: 8,
                }}
              >
                {stat.label}
              </p>
              <p
                style={{
                  fontSize: "1.875rem",
                  fontWeight: 700,
                  color: stat.highlight ? "#d97706" : "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Loan applications */}
        <div className="card" style={{ marginBottom: 20, overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--surface-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <h2
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Loan applications
            </h2>
            <span className="badge badge-amber">
              {pendingLoans.length} pending
            </span>
          </div>

          {loans.length === 0 ? (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "0.875rem",
              }}
            >
              No applications yet
            </div>
          ) : (
            <div
              style={
                {
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                } as React.CSSProperties
              }
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.875rem",
                  minWidth: 640,
                }}
              >
                <thead>
                  <tr style={{ background: "var(--surface-subtle)" }}>
                    {[
                      "Applicant",
                      "Loan amount",
                      "LTV",
                      "DTI",
                      "Employment",
                      "Submitted",
                      "Status",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 16px",
                          color: "var(--text-muted)",
                          fontWeight: 500,
                          fontSize: "0.8125rem",
                          borderBottom: "1px solid var(--surface-border)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan: any) => (
                    <tr
                      key={loan.id}
                      style={{
                        borderBottom: "1px solid var(--surface-divider)",
                      }}
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <p
                          style={{
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {loan.user_name}
                        </p>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            marginTop: 2,
                          }}
                        >
                          {loan.email}
                        </p>
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "var(--text-primary)",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        £{Number(loan.loan_amount).toLocaleString("en-GB")}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {loan.ltv}%
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {loan.dti}%
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "var(--text-secondary)",
                          textTransform: "capitalize",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {loan.employment_type}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "var(--text-muted)",
                          fontSize: "0.8125rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(loan.submitted_at).toLocaleDateString(
                          "en-GB",
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <StatusBadge status={loan.status as string} />
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <Link
                          href={`/admin/loans/${loan.id}`}
                          style={{
                            color: "var(--text-brand)",
                            fontWeight: 500,
                            fontSize: "0.875rem",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Appointments */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--surface-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <h2
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Appointments
            </h2>
            <span className="badge badge-amber">
              {pendingAppointments.length} pending
            </span>
          </div>

          {appointments.length === 0 ? (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "0.875rem",
              }}
            >
              No appointments yet
            </div>
          ) : (
            <div
              style={
                {
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                } as React.CSSProperties
              }
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.875rem",
                  minWidth: 560,
                }}
              >
                <thead>
                  <tr style={{ background: "var(--surface-subtle)" }}>
                    {[
                      "Customer",
                      "Advisor type",
                      "Date",
                      "Time",
                      "Reason",
                      "Status",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 16px",
                          color: "var(--text-muted)",
                          fontWeight: 500,
                          fontSize: "0.8125rem",
                          borderBottom: "1px solid var(--surface-border)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((apt: any) => (
                    <tr
                      key={apt.id}
                      style={{
                        borderBottom: "1px solid var(--surface-divider)",
                      }}
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <p
                          style={{
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {apt.user_name}
                        </p>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            marginTop: 2,
                          }}
                        >
                          {apt.email}
                        </p>
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "var(--text-secondary)",
                          textTransform: "capitalize",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {apt.advisor_type}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {apt.preferred_date}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {apt.preferred_time}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "var(--text-muted)",
                          maxWidth: 180,
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {apt.reason || "-"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <StatusBadge status={apt.status as string} />
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <Link
                          href={`/admin/appointments/${apt.id}`}
                          style={{
                            color: "var(--text-brand)",
                            fontWeight: 500,
                            fontSize: "0.875rem",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "badge badge-amber",
    approved: "badge badge-green",
    rejected: "badge badge-red",
    confirmed: "badge badge-blue",
    cancelled: "badge badge-gray",
  };
  return <span className={styles[status] ?? "badge badge-gray"}>{status}</span>;
}
