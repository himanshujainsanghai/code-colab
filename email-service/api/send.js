import {
  getApiKeyFromRequest,
  sendEmail,
  serviceApiKey,
} from "../src/mailer.js";

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  if (serviceApiKey && getApiKeyFromRequest(req) !== serviceApiKey) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { to, subject, html } = parseBody(req);
  if (!to || !subject || !html) {
    return res
      .status(400)
      .json({ message: "Missing required fields: to, subject, html" });
  }

  try {
    await sendEmail({ to, subject, html });
    return res.status(202).json({ queued: true });
  } catch (error) {
    const statusCode =
      typeof error?.statusCode === "number" ? error.statusCode : 502;
    return res.status(statusCode).json({
      message: "SMTP send failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
