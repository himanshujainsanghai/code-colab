import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL as string | undefined;

  if (!import.meta.env.PROD) {
    return configured ?? "http://localhost:4000/api";
  }

  // In production, keep auth cookies first-party via Vercel rewrite (`/api`).
  // This avoids third-party cookie blocking when pointing directly to Render.
  if (!configured || configured === "/api") {
    return "/api";
  }

  try {
    const parsed = new URL(configured, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      // eslint-disable-next-line no-console
      console.warn(
        `[api] Cross-origin VITE_API_URL detected in production (${configured}); forcing /api to preserve auth cookies.`,
      );
      return "/api";
    }
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`[api] Invalid VITE_API_URL "${configured}" in production; forcing /api.`);
    return "/api";
  }

  return configured;
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status as number | undefined;
    const requestUrl = String(originalRequest?.url ?? "");

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !requestUrl.includes("/auth/login") &&
      !requestUrl.includes("/auth/register") &&
      !requestUrl.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;
      try {
        await api.post("/auth/refresh");
        return api(originalRequest);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
