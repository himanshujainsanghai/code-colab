import dns from "node:dns";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Safe no-op for older runtimes.
}

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? 465);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

export const serviceApiKey = process.env.EMAIL_SERVICE_API_KEY;

function createTransporter() {
  if (!smtpHost || !smtpUser || !smtpPass) return null;
  const secure = smtpPort === 465;
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: { user: smtpUser, pass: smtpPass },
    requireTLS: !secure,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    tls: { rejectUnauthorized: true },
  });
}

const transporter = createTransporter();

export function getApiKeyFromRequest(req) {
  return req.headers?.["x-email-service-key"] ?? req.headers?.["X-Email-Service-Key"];
}

export function ensureTransporter() {
  if (!transporter) {
    const error = new Error("SMTP transporter is not configured");
    error.statusCode = 503;
    throw error;
  }
  return transporter;
}

export async function verifySmtp() {
  const readyTransporter = ensureTransporter();
  await readyTransporter.verify();
}

export async function sendEmail({ to, subject, html }) {
  const readyTransporter = ensureTransporter();
  await readyTransporter.sendMail({
    from: `"Colab Code" <${smtpUser}>`,
    to,
    subject,
    html,
  });
}
