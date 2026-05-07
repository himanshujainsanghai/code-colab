import { verifySmtp } from "../src/mailer.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    await verifySmtp();
    return res.status(200).json({ ok: true });
  } catch (error) {
    const statusCode =
      typeof error?.statusCode === "number" ? error.statusCode : 503;
    return res.status(statusCode).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
