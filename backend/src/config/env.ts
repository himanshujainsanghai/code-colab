import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseOrigins(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => origin.replace(/\/$/, ""));
}

function normalizeSameSite(value?: string): "lax" | "strict" | "none" {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "none" || normalized === "strict" || normalized === "lax") {
    return normalized;
  }
  return "lax";
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const clientOriginEntries = parseOrigins(process.env.CLIENT_ORIGIN ?? "http://localhost:5173");
const clientOrigin = clientOriginEntries[0] ?? "http://localhost:5173";
const configuredExtraOrigins = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);
const mergedAllowedOrigins = Array.from(
  new Set([...configuredExtraOrigins, ...clientOriginEntries.slice(1)]),
);
const configuredSameSite = normalizeSameSite(
  process.env.COOKIE_SAME_SITE ?? (nodeEnv === "production" ? "none" : "lax"),
);
const configuredSecure = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : nodeEnv === "production";
const authCookieSameSite = nodeEnv === "production" ? "none" : configuredSameSite;
const authCookieSecure = nodeEnv === "production" ? true : configuredSecure;

export const env = {
  NODE_ENV: nodeEnv,
  PORT: Number(process.env.PORT ?? 4000),
  MONGO_URI: required("MONGO_URI", "mongodb://127.0.0.1:27017/multicoder"),
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET", "dev-access-secret"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL ?? "7d",
  CLIENT_ORIGIN: clientOrigin,
  CORS_ALLOWED_ORIGINS: mergedAllowedOrigins,
  COOKIE_SAME_SITE: configuredSameSite,
  COOKIE_SECURE: configuredSecure,
  AUTH_COOKIE_SAME_SITE: authCookieSameSite,
  AUTH_COOKIE_SECURE: authCookieSecure,
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
