import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { safeStorage } from "../utils/storage";
import { clientLogger } from "../utils/logger";

const P_LABELS: Record<string, string> = { B: "BTech", M: "MCA", T: "MTech", A: "B.Arch" };

export default function Admin() {
  const [stats,   setStats]   = useState<any>(null);
  const [search,  setSearch]  = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();
  const username             = safeStorage.getItem("keli_username") || "admin";

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  function handleLogout() {
    clientLogger.info("LOGOUT", "Admin user logged out");
    safeStorage.removeItem("keli_token");
    safeStorage.removeItem("keli_username");
    navigate("/login", { replace: true });
  }

  async function fetchStats() {
    try { setStats((await api.stats()).data); } catch {}
  }

  async function handleSearch() {
    if (!search.trim()) return;
    setLoading(true);
    try { setResults((await api.search(search.trim())).data); } catch {}
    setLoading(false);
  }

  async function resetTicket(id: number, day: 1 | 2) {
    if (!confirm(`Reset Day ${day} scan for this ticket? This will allow re-entry.`)) return;
    await api.override(id, {
      [`day${day}_scanned`]:    0,
      [`day${day}_scanned_at`]: null,
      [`day${day}_scanned_by`]: "",
    });
    handleSearch();
    fetchStats();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Top Header Bar with Logout */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-6 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-xl font-extrabold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              KELI 2026 &middot; Admin
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Live Pro-Show Entrance Analytics</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs font-semibold text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
            {username}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-400 bg-rose-950/40 hover:bg-rose-900/70 border border-rose-800/60 px-3 py-2 rounded-xl transition"
          >
            <span>Logout</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Stats Cards */}
      {stats && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Total Tickets" value={stats.total} color="text-slate-100" />
            <StatCard label="Day 1 Checked In" value={stats.day1Scanned} color="text-blue-400" />
            <StatCard label="Day 2 Checked In" value={stats.day2Scanned} color="text-cyan-400" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {stats.byProgram?.map((p: any) => (
              <div key={p.program} className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 shadow-md">
                <div className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                  {P_LABELS[p.program] || p.program}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  D1: <strong className="text-blue-300">{p.day1}</strong>/{p.total}
                </div>
                <div className="text-xs text-slate-400">
                  D2: <strong className="text-cyan-300">{p.day2}</strong>/{p.total}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Search Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-6 shadow-xl">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Ticket Search & Override
        </h2>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-slate-950 border border-slate-800 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
            placeholder="Search student name, email, or ticket ID (e.g. KB1A1001)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* Search Results */}
      <div className="space-y-3">
        {results.map((t: any) => (
          <div key={t.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-extrabold text-white text-base">{t.name}</div>
              <div className="text-xs text-slate-400 font-medium">
                {t.email} &middot; {t.dept} (Year {t.year})
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0">
              <TicketStatus
                label="Day 1"
                ticketId={t.day1}
                scanned={t.day1_scanned}
                by={t.day1_scanned_by}
                at={t.day1_scanned_at}
                onReset={() => resetTicket(t.id, 1)}
              />
              <TicketStatus
                label="Day 2"
                ticketId={t.day2}
                scanned={t.day2_scanned}
                by={t.day2_scanned_by}
                at={t.day2_scanned_at}
                onReset={() => resetTicket(t.id, 2)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 text-center shadow-lg">
      <div className={`text-3xl sm:text-4xl font-black ${color}`}>{value ?? 0}</div>
      <div className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function TicketStatus({ label, ticketId, scanned, by, at, onReset }: any) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono">
      <div className="text-slate-400 font-bold mb-0.5">{label}: <span className="text-white">{ticketId || "N/A"}</span></div>
      <div className="flex items-center gap-2">
        <span className={scanned ? "text-emerald-400 font-bold" : "text-slate-500"}>
          {scanned ? `✓ In (${by || "scanned"})` : "○ Unused"}
        </span>
        {scanned && (
          <button
            onClick={onReset}
            className="text-xs text-rose-400 hover:text-rose-300 underline font-sans ml-1"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
