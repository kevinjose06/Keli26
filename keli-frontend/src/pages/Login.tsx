import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { safeStorage } from "../utils/storage";
import { clientLogger } from "../utils/logger";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  async function handleLogin() {
    if (!username || !password) {
      setError("Please enter both username and password");
      clientLogger.warn("LOGIN FORM", "Login attempt blocked: missing credentials");
      return;
    }
    setLoading(true);
    setError("");
    clientLogger.info("LOGIN ACTION", `Attempting login for '${username}'`);

    try {
      const res = await api.login(username, password);
      safeStorage.setItem("keli_token",    res.data.token);
      safeStorage.setItem("keli_username", res.data.username);
      clientLogger.success("LOGIN SUCCESS", `User '${username}' logged in successfully`);
      navigate(username === "admin" ? "/admin" : "/scan");
    } catch (err: any) {
      clientLogger.error("LOGIN FAILED", `Login error for user '${username}': ${err.message}`);
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient light glow - Professional Blue */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 font-black text-xl mb-3 border border-blue-500/30 shadow-inner">
            K
          </div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white via-slate-100 to-sky-300 bg-clip-text text-transparent tracking-wider">
            KELI 2026
          </h1>
          <p className="text-slate-400 text-xs mt-1 tracking-widest font-semibold uppercase">
            Pro-Show Scanner Portal
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 tracking-wider uppercase">
              Username
            </label>
            <input
              type="text"
              className="w-full bg-slate-950/70 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              placeholder="e.g. scanner1 or admin"
              value={username}
              autoCapitalize="none"
              onChange={e => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 tracking-wider uppercase">
              Password
            </label>
            <input
              type="password"
              className="w-full bg-slate-950/70 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
          </div>

          {error && (
            <div className="bg-rose-950/50 border border-rose-800/80 rounded-xl p-3 text-center text-xs font-semibold text-rose-400">
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-900/30 transition transform active:scale-[0.99]"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        <div className="mt-8 text-center text-slate-600 text-xs">
          GEC RIT Kottayam Student Union
        </div>
      </div>
    </div>
  );
}
