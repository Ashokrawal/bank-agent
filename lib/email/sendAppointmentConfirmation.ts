/**
 * lib/email/sendAppointmentConfirmation.ts
 *
 * Sends the appointment confirmation email via Resend. Booking a slot never
 * depends on this succeeding - the DB row is the source of truth. If the API
 * key is missing or the send fails, we log it and report emailSent: false so
 * the agent can tell the user honestly rather than promising an email that
 * never went out.
 */

import { Resend } from "resend";

export async function sendAppointmentConfirmation(params: {
  to: string;
  userName: string;
  advisorType: string;
  preferredDate: string;
  preferredTime: string;
  reason?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !params.to) {
    console.warn("[sendAppointmentConfirmation] RESEND_API_KEY or recipient missing, skipping send");
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM_EMAIL ?? "NovaBank <onboarding@resend.dev>";

    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject: "Your NovaBank appointment is confirmed",
      html: `
        <p>Hi ${params.userName || "there"},</p>
        <p>Your appointment with a NovaBank ${params.advisorType} advisor is confirmed:</p>
        <ul>
          <li><strong>Date:</strong> ${params.preferredDate}</li>
          <li><strong>Time:</strong> ${params.preferredTime}</li>
          ${params.reason ? `<li><strong>Reason:</strong> ${params.reason}</li>` : ""}
        </ul>
        <p>See you then.</p>
      `,
    });

    if (error) {
      console.error("[sendAppointmentConfirmation] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sendAppointmentConfirmation] failed:", err);
    return false;
  }
}
