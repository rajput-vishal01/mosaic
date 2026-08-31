import nodemailer from "nodemailer";
import { render } from "react-email";

import { PasswordResetEmail } from "./password-reset-email";

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
