import nodemailer from "nodemailer";
import { render } from "react-email";

import { PasswordResetEmail } from "./password-reset-email";
import { AgencyInvitationEmail } from "./agency-invitation-email";

export async function sendPasswordResetEmail({ email, name, resetUrl }: { email: string; name: string; resetUrl: string }) {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) throw new Error("SMTP_HOST and SMTP_FROM are required to send authentication email.");

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  const html = await render(<PasswordResetEmail name={name} resetUrl={resetUrl} />);
  await transporter.sendMail({ from, to: email, subject: "Reset your Mosaic password", html });
}

export async function sendAgencyInvitationEmail({ email, agencyName, inviterName, invitationId }: { email: string; agencyName: string; inviterName: string; invitationId: string }) {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) throw new Error("SMTP_HOST and SMTP_FROM are required to send authentication email.");
  const transporter = nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const invitationUrl = new URL(`/accept-invitation/${encodeURIComponent(invitationId)}`, baseUrl).toString();
  const html = await render(<AgencyInvitationEmail agencyName={agencyName} inviterName={inviterName} invitationUrl={invitationUrl} />);
  await transporter.sendMail({ from, to: email, subject: `Join ${agencyName} in Mosaic`, html });
}
