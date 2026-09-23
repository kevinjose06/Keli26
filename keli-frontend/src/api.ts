import axios from "axios";
import { safeStorage } from "./utils/storage";
import { clientLogger } from "./utils/logger";

const BASE = "/api";

function authHeader() {
  const token = safeStorage.getItem("keli_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Axios Request Interceptor for logging
axios.interceptors.request.use(
  (config) => {
    (config as any).metadata = { startTime: Date.now() };
    clientLogger.info("API REQ", `${config.method?.toUpperCase()} ${config.url}`, config.data || "");
    return config;
  },
  (error) => {
    clientLogger.error("API REQ ERROR", error.message);
    return Promise.reject(error);
  }
);

// Axios Response Interceptor for logging and automatic session expiry handling
axios.interceptors.response.use(
  (response) => {
    const startTime = (response.config as any).metadata?.startTime || Date.now();
    const duration = Date.now() - startTime;
    clientLogger.success(
      "API RES",
      `${response.config.method?.toUpperCase()} ${response.config.url} [${response.status}] (${duration}ms)`,
      response.data
    );
    return response;
  },
  (error) => {
    const startTime = (error.config as any)?.metadata?.startTime || Date.now();
    const duration = Date.now() - startTime;
    const status = error.response?.status || "NET_ERR";
    const errorData = error.response?.data;

    clientLogger.error(
      "API ERR",
      `${error.config?.method?.toUpperCase()} ${error.config?.url} [${status}] (${duration}ms) - ${error.message}`,
      errorData || error
    );

    // Auto-kick if session was overridden by another device or expired
    if (status === 401 && !error.config?.url?.includes("/auth/login")) {
      const isOverridden = errorData?.code === "SESSION_OVERRIDDEN";
      safeStorage.removeItem("keli_token");
      safeStorage.removeItem("keli_username");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        const msg = isOverridden
          ? "This account has logged in on another device. You have been logged out."
          : "Session expired. Please log in again.";
        alert(msg);
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export const api = {
  login: (username: string, password: string) =>
    axios.post(`${BASE}/auth/login`, { username, password }),

  logout: () =>
    axios.post(`${BASE}/auth/logout`, {}, { headers: authHeader() }),

  // Single call — verify + scan in one round trip, eliminates extra network lag
  scanAndVerify: (ticketId: string, day: number) =>
    axios.post(`${BASE}/tickets/scan-and-verify`, { ticketId, day }, { headers: authHeader() }),

  stats: () =>
    axios.get(`${BASE}/tickets/stats`, { headers: authHeader() }),

  search: (q: string) =>
    axios.get(`${BASE}/tickets?q=${encodeURIComponent(q)}`, { headers: authHeader() }),

  override: (id: number, data: object) =>
    axios.patch(`${BASE}/tickets/${id}`, data, { headers: authHeader() }),

  ping: () =>
    axios.get(`${BASE}/tickets/ping`, { headers: authHeader() }),
};
