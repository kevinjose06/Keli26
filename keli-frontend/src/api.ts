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

// Axios Response Interceptor for logging
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
    clientLogger.error(
      "API ERR",
      `${error.config?.method?.toUpperCase()} ${error.config?.url} [${status}] (${duration}ms) - ${error.message}`,
      error.response?.data || error
    );
    return Promise.reject(error);
  }
);

export const api = {
  login: (username: string, password: string) =>
    axios.post(`${BASE}/auth/login`, { username, password }),

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
