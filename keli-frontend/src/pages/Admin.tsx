import { useEffect, useState } from "react";
import { api } from "../api";

const P_LABELS: Record<string, string> = { B: "BTech", M: "MCA", T: "MTech", A: "B.Arch" };

export default function Admin() {
  const [stats,   setStats]   = useState<any>(null);
  const [search,  setSearch]  = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

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
    if (!confirm(`Reset Day ${day} scan? This allows re-entry.`)) return;
    await api.override(id, {
      [`day${day}_scanned`]:    0,
      [`day${day}_scanned_at`]: null,
      [`day${day}_scanned_by`]: "",
    });
    handleSearch();
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold text-purple-400 tracking-widest mb-6">KELI 2026 · Admin</h1>

      {stats && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Total"    value={stats.total} />
            <StatCard label="Day 1 In" value={stats.day1Scanned} />
            <StatCard label="Day 2 In" value={stats.day2Scanned} />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {stats.byProgram?.map((p: any) => (
              <div key={p.program} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm">
                <div className="text-purple-300 font-semibold">{P_LABELS[p.program] || p.program}</div>
                <div className="text-gray-400">D1: {p.day1}/{p.total} · D2: {p.day2}/{p.total}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
          placeholder="Search name, email, or ticket ID..."
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
        />
        <button onClick={handleSearch}
          className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm">
          {loading ? "..." : "Search"}
        </button>
      </div>

      <div className="space-y-2">
        {results.map((t: any) => (
          <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm">
            <div className="font-semibold text-white">{t.name}</div>
            <div className="text-gray-400 text-xs">{t.email} · {t.dept}</div>
            <div className="flex gap-4 mt-2">
              <TicketStatus label="Day 1" id={t.id} ticketId={t.day1}
                scanned={t.day1_scanned} by={t.day1_scanned_by} at={t.day1_scanned_at}
                onReset={() => resetTicket(t.id, 1)} />
              <TicketStatus label="Day 2" id={t.id} ticketId={t.day2}
                scanned={t.day2_scanned} by={t.day2_scanned_by} at={t.day2_scanned_at}
                onReset={() => resetTicket(t.id, 2)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function TicketStatus({ label, ticketId, scanned, by, at, onReset }: any) {
  return (
    <div>
      <span className={`text-xs font-mono ${scanned ? "text-green-400" : "text-gray-500"}`}>
        {label}: {ticketId || "N/A"} {scanned ? `✓ ${by}` : "○ unused"}
      </span>
      {scanned && (
        <button onClick={onReset} className="ml-2 text-xs text-red-500 hover:text-red-300">
          reset
        </button>
      )}
    </div>
  );
}
