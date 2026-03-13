import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export async function sendResetPasswordMail(to: string, resetLink: string) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"MultiCoder" <${env.SMTP_USER}>`,
    to,
    subject: "Reset your MultiCoder password",
    html: `<p>Reset password using this link:</p><a href="${resetLink}">${resetLink}</a>`,
  });
}

export async function sendInvitationMail(input: {
  to: string;
  projectName: string;
  inviterName: string;
  role: "viewer" | "editor" | "admin";
  inviteLink: string;
}) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

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
}
