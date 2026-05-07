import dotenv from "dotenv";
import express from "express";
import healthHandler from "../api/health.js";
import sendHandler from "../api/send.js";

dotenv.config();

const port = Number(process.env.PORT ?? 4010);

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", healthHandler);
app.post("/send", sendHandler);

app.listen(port, () => {
  console.log(`[email-service] listening on :${port}`);
});
