import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  async function handleLogin() {
    if (!username || !password) { setError("Enter username and password"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.login(username, password);
      localStorage.setItem("keli_token",    res.data.token);
      localStorage.setItem("keli_username", res.data.username);
      navigate(username === "admin" ? "/admin" : "/scan");
    } catch {
      setError("Invalid credentials. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white text-center tracking-widest mb-2">KELI</h1>
        <p className="text-gray-500 text-center text-sm mb-8 tracking-wider">SCANNER LOGIN</p>
        <div className="space-y-3">
          <input
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
            placeholder="Username" value={username} autoCapitalize="none"
            onChange={e => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
            placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            onClick={handleLogin} disabled={loading}
            className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
