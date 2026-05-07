import dns from "node:dns";
import dotenv from "dotenv";
import express from "express";
import nodemailer from "nodemailer";

dotenv.config();

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Safe no-op for older runtimes.
}

const port = Number(process.env.PORT ?? 4010);
const serviceApiKey = process.env.EMAIL_SERVICE_API_KEY;

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? 465);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

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

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  if (!transporter) {
    return res.status(503).json({
      ok: false,
      message: "SMTP is not configured.",
    });
  }
  try {
    await transporter.verify();
    return res.json({ ok: true });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/send", async (req, res) => {
  if (serviceApiKey && req.header("x-email-service-key") !== serviceApiKey) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { to, subject, html } = req.body ?? {};
  if (!to || !subject || !html) {
    return res.status(400).json({ message: "Missing required fields: to, subject, html" });
  }
  if (!transporter) {
    return res.status(503).json({ message: "SMTP transporter is not configured" });
  }

  try {
    await transporter.sendMail({
      from: `"Colab Code" <${smtpUser}>`,
      to,
      subject,
      html,
    });
    return res.status(202).json({ queued: true });
  } catch (error) {
    console.error("[email-service] send failed:", error);
    return res.status(502).json({
      message: "SMTP send failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(port, () => {
  console.log(`[email-service] listening on :${port}`);
});
