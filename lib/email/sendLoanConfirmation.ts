/**
 * lib/email/sendLoanConfirmation.ts
 *
 * Sends the loan application confirmation email via Resend. Submitting the
 * application never depends on this succeeding - the DB row is the source
 * of truth. If the API key is missing or the send fails, we log it and
 * report emailSent: false so the agent can tell the user honestly rather
 * than promising an email that never went out.
 */

import { Resend } from "resend";

export async function sendLoanConfirmation(params: {
  to: string;
  userName: string;
  loanPurpose: string;
  propertyValue: number;
  deposit: number;
  loanAmount: number;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.to) {
    console.warn("[sendLoanConfirmation] RESEND_API_KEY or recipient missing, skipping send");
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM_EMAIL ?? "NovaBank <onboarding@resend.dev>";

    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject: "Your NovaBank loan application has been received",
      html: `
        <p>Hi ${params.userName || "there"},</p>
        <p>We've received your ${params.loanPurpose} application:</p>
        <ul>
          <li><strong>Property value:</strong> £${params.propertyValue.toLocaleString()}</li>
          <li><strong>Deposit:</strong> £${params.deposit.toLocaleString()}</li>
          <li><strong>Loan amount:</strong> £${params.loanAmount.toLocaleString()}</li>
        </ul>
        <p>A NovaBank advisor will review your details and contact you within 2-3 business days.</p>
      `,
    });

    if (error) {
      console.error("[sendLoanConfirmation] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sendLoanConfirmation] failed:", err);
    return false;
  }
}
