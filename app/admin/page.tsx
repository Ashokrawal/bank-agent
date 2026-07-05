/**
 * app/admin/page.tsx
 *
 * Admin dashboard - shows all pending loan applications
 * and appointments. Only visible to admin emails.
 *
 * Fetches directly from SQLite via server component.
 * No loading states needed - server renders the data.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLoanApplications, getAppointments } from "@/lib/db/sqlite";
import Link from "next/link";

const ADMIN_EMAILS = ["admin@novabank.com", "demo@novabank.com"];

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  // not logged in - send to sign in
  if (!session?.user) redirect("/auth/signin");

  // logged in but not admin - send home
  if (!ADMIN_EMAILS.includes(session.user.email ?? "")) redirect("/chat");

  // fetch all applications - no userId filter so we get everyone's
  const loans = await getLoanApplications();
  const appointments = await getAppointments();

  const pendingLoans = loans.filter((l) => l.status === "pending");
  const pendingAppointments = appointments.filter(
    (a) => a.status === "pending",
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              NovaBanк - Staff Portal
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Logged in as {session.user.email}
            </p>
          </div>
          <Link
            href="/chat"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Back to chat
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Pending loans",
              value: pendingLoans.length,
              color: "text-amber-600",
            },
            {
              label: "Total loans",
              value: loans.length,
              color: "text-gray-900",
            },
            {
              label: "Pending appointments",
              value: pendingAppointments.length,
              color: "text-amber-600",
            },
            {
              label: "Total appointments",
              value: appointments.length,
              color: "text-gray-900",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className={`text-3xl font-bold mt-1 ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Loan applications */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Loan applications
          </h2>
          {loans.length === 0 ? (
            <p className="text-gray-500 text-sm">No applications yet.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
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
                        className="text-left px-4 py-3 text-gray-500 font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loans.map((loan: any) => (
                    <tr
                      key={loan.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {loan.user_name}
                        </p>
                        <p className="text-gray-400 text-xs">{loan.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        £{Number(loan.loan_amount).toLocaleString("en-GB")}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{loan.ltv}%</td>
                      <td className="px-4 py-3 text-gray-700">{loan.dti}%</td>
                      <td className="px-4 py-3 text-gray-700 capitalize">
                        {loan.employment_type}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(loan.submitted_at).toLocaleDateString(
                          "en-GB",
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={loan.status as string} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/loans/${loan.id}`}
                          className="text-blue-600 hover:text-blue-700 font-medium"
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
        </section>

        {/* Appointments */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Appointments
          </h2>
          {appointments.length === 0 ? (
            <p className="text-gray-500 text-sm">No appointments yet.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
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
                        className="text-left px-4 py-3 text-gray-500 font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {appointments.map((apt: any) => (
                    <tr
                      key={apt.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {apt.user_name}
                        </p>
                        <p className="text-gray-400 text-xs">{apt.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 capitalize">
                        {apt.advisor_type}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {apt.preferred_date}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {apt.preferred_time}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                        {apt.reason || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={apt.status as string} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/appointments/${apt.id}`}
                          className="text-blue-600 hover:text-blue-700 font-medium"
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
        </section>
      </div>
    </div>
  );
}

// small reusable badge component
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    confirmed: "bg-blue-50 text-blue-700 border-blue-200",
    cancelled: "bg-gray-50 text-gray-500 border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
        styles[status] ?? styles.pending
      }`}
    >
      {status}
    </span>
  );
}
