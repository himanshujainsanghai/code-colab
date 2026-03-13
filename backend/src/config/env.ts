import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  MONGO_URI: required("MONGO_URI", "mongodb://127.0.0.1:27017/multicoder"),
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET", "dev-access-secret"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL ?? "7d",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  JUDGE0_URL: process.env.JUDGE0_URL ?? "http://localhost:2358",
  JUDGE0_KEY: process.env.JUDGE0_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  COLLAB_PORT: Number(process.env.COLLAB_PORT ?? 1234),
  HOST_RUNNER_ENABLED: (process.env.HOST_RUNNER_ENABLED ?? "true") === "true",
  HOST_RUN_TIMEOUT_MS: Number(process.env.HOST_RUN_TIMEOUT_MS ?? 6000),
};
