import axios from "axios";

const BASE = "/api";

function authHeader() {
  const token = localStorage.getItem("keli_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
