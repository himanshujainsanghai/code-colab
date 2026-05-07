import { Resend } from "resend";
import { env } from "../config/env.js";

/**
 * Resend uses the HTTPS API (port 443) — never blocked by cloud firewalls.
 * This replaces nodemailer/SMTP which is blocked on Render's free tier
 * (ports 25, 465, 587 all blocked since September 2025).
 */
function createClient() {
  if (!env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(env.RESEND_API_KEY);
}

const client = createClient();

async function logMailHealthOnStartup() {
  if (!client) {
    console.warn("[mail] Resend client is disabled: RESEND_API_KEY is not set.");
    return;
  }

  // Warn loudly if the sender address is still the Resend test address.
  // onboarding@resend.dev only works with Resend test recipients — it will
  // reject every real email address in production.
  if (env.MAIL_FROM.includes("onboarding@resend.dev")) {
    console.error(
      "[mail] MAIL_FROM is still set to the Resend test address (onboarding@resend.dev). " +
      "Emails to real users WILL fail. Set MAIL_FROM to an address on your verified domain.",
    );
  }

  // Hitting the domains list is a lightweight API connectivity check.
  const { error } = await client.domains.list();
  if (error) {
    console.error("[mail] Resend connectivity check failed:", error);
  } else {
    console.log(`[mail] Resend client ready — sending from: ${env.MAIL_FROM}`);
  }
}

void logMailHealthOnStartup();

export async function sendResetPasswordMail(to: string, resetLink: string) {
  if (!client) {
    console.warn("[mail] Resend not configured – skipping reset-password email.");
    return false;
  }

  const { data, error } = await client.emails.send({
    from: env.MAIL_FROM,
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

  if (error) {
    console.error("[mail] Failed to send reset-password email:", error);
    throw new Error(error.message);
  }

  console.log("[mail] Reset-password email sent, id:", data?.id);
  return true;
}

export async function sendInvitationMail(input: {
  to: string;
  projectName: string;
  inviterName: string;
  role: "viewer" | "editor" | "admin";
  inviteLink: string;
}) {
  if (!client) {
    console.warn("[mail] Resend not configured – skipping invitation email.");
    return false;
  }

  const { data, error } = await client.emails.send({
    from: env.MAIL_FROM,
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

  if (error) {
    console.error("[mail] Failed to send invitation email:", error);
    throw new Error(error.message);
  }

  console.log("[mail] Invitation email sent, id:", data?.id);
  return true;
}
