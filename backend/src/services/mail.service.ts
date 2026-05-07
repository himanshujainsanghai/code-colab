import { env } from "../config/env.js";

type ProxyMailPayload = {
  to: string;
  subject: string;
  html: string;
};

const emailServiceTimeoutMs = 20_000;

async function sendViaEmailService(payload: ProxyMailPayload) {
  if (!env.EMAIL_SERVICE_URL) {
    console.warn("[mail] EMAIL_SERVICE_URL is not configured; skipping email send.");
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), emailServiceTimeoutMs);
  const endpoint = `${env.EMAIL_SERVICE_URL.replace(/\/$/, "")}/send`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.EMAIL_SERVICE_API_KEY
        ? { "x-email-service-key": env.EMAIL_SERVICE_API_KEY }
        : {}),
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`[mail] Email proxy failed (${response.status}): ${raw || response.statusText}`);
  }

  return true;
}

export async function sendResetPasswordMail(to: string, resetLink: string) {
  try {
    await sendViaEmailService({
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
  try {
    await sendViaEmailService({
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
