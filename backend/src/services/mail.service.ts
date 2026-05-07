import nodemailer from "nodemailer";
import { env } from "../config/env.js";

/**
 * Singleton transporter.
 *
 * Key decisions:
 *  - port 465 + secure:true  → implicit TLS (SMTPS).
 *    Gmail blocks STARTTLS (port 587) connections from cloud/serverless IPs
 *    (Vercel, Railway …) because those address ranges are often flagged as
 *    potential spam sources.  Implicit TLS on 465 is always accepted.
 *  - tls.rejectUnauthorized: true  → keep certificate verification on; never
 *    disable this in production.
 *  - The transporter is built once and reused across all calls to avoid the
 *    overhead (and subtle connection-state bugs) of recreating it per request.
 */
function createTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  const secure = env.SMTP_PORT === 465;

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 uses implicit TLS, 587 uses STARTTLS.
    secure,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    requireTLS: !secure,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    tls: {
      rejectUnauthorized: true, // always validate the server certificate
    },
  });
}

// Build once at module load time so the TCP connection can be reused.
const transporter = createTransporter();

export async function sendResetPasswordMail(to: string, resetLink: string) {
  if (!transporter) {
    console.warn("[mail] SMTP credentials not configured – skipping reset-password email.");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"Colab Code" <${env.SMTP_USER}>`,
      to,
      subject: "Reset your Colab Code password",
      html: `
      <p>You requested a password reset for your Colab Code account.</p>
      <p>
        <a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#007acc;color:#fff;text-decoration:none;border-radius:6px;">
          Reset Password
        </a>
      </p>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>This link expires in 15 minutes. If you didn't request a reset, you can safely ignore this email.</p>
    `,
    });
    return true;
  } catch (error) {
    console.error("[mail] Failed to send reset-password email:", error);
    throw error;
  }
}

export async function sendInvitationMail(input: {
  to: string;
  projectName: string;
  inviterName: string;
  role: "viewer" | "editor" | "admin";
  inviteLink: string;
}) {
  if (!transporter) {
    console.warn("[mail] SMTP credentials not configured – skipping invitation email.");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"Colab Code" <${env.SMTP_USER}>`,
      to: input.to,
      subject: `Invitation to collaborate on ${input.projectName}`,
      html: `
      <p><strong>${input.inviterName}</strong> invited you to collaborate on <strong>${input.projectName}</strong>.</p>
      <p>Your role: <strong>${input.role}</strong></p>
      <p>
        <a href="${input.inviteLink}" style="display:inline-block;padding:10px 16px;background:#007acc;color:#fff;text-decoration:none;border-radius:6px;">
          Accept Invitation
        </a>
      </p>
      <p>If the button does not work, use this link:</p>
      <p><a href="${input.inviteLink}">${input.inviteLink}</a></p>
    `,
    });
    return true;
  } catch (error) {
    console.error("[mail] Failed to send invitation email:", error);
    throw error;
  }
}
