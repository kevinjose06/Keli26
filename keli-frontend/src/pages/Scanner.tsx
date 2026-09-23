import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { api } from "../api";
import { safeStorage } from "../utils/storage";
import { clientLogger } from "../utils/logger";

type ScanState = "idle" | "verifying" | "success" | "duplicate" | "invalid";

const PROGRAM_LABELS: Record<string, string> = {
  B: "BTech", M: "MCA", T: "MTech", A: "B.Arch",
};

const QR_CONFIG = { fps: 15, qrbox: { width: 220, height: 220 } };

export default function Scanner() {
  const [state,      setState]      = useState<ScanState>("idle");
  const [result,     setResult]     = useState<any>(null);
  const [day,        setDay]        = useState<1 | 2 | null>(null);
  const [manualId,   setManualId]   = useState("");
  const [backOnline, setBackOnline] = useState(true);
  const scannerRef    = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const navigate      = useNavigate();
  const username     = safeStorage.getItem("keli_username") || "scanner";

  useEffect(() => {
    if (!day) return;
    clientLogger.info("SCANNER INIT", `Selected Day ${day} pro-show scanning`);
    startCamera();
    pingBackend();
    return () => {
      clientLogger.info("SCANNER TEARDOWN", `Stopping camera for Day ${day}`);
      stopCamera();
    };
  }, [day]);

  async function handleLogout() {
    clientLogger.info("LOGOUT", `User '${username}' logging out`);
    stopCamera();
    try {
      await api.logout();
    } catch {}
    safeStorage.removeItem("keli_token");
    safeStorage.removeItem("keli_username");
    navigate("/login", { replace: true });
  }

  async function pingBackend() {
    try {
      await api.ping();
      setBackOnline(true);
      clientLogger.success("BACKEND PING", "Backend is online");
    } catch (err: any) {
      setBackOnline(false);
      clientLogger.error("BACKEND PING FAILED", `Backend unreachable: ${err.message}`);
    }
  }

  async function startCamera() {
    clientLogger.info("CAMERA", "Starting camera stream...");
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        QR_CONFIG,
        (text) => handleTicketId(text.trim().toUpperCase()),
        () => {}
      );
      clientLogger.success("CAMERA", "Camera stream started successfully");
    } catch (e: any) {
      clientLogger.error("CAMERA ERROR", `Failed to start camera: ${e.message}`, e);
    }
  }

  async function stopCamera() {
    try {
      await scannerRef.current?.stop();
      clientLogger.info("CAMERA", "Camera stopped");
    } catch {}
  }

  async function handleTicketId(ticketId: string) {
    if (processingRef.current || !day) return;
    processingRef.current = true;

    clientLogger.info("QR DETECTED", `Scanned Ticket ID: '${ticketId}' on Day ${day}`);

    await stopCamera();
    setState("verifying");

    try {
      const res = await api.scanAndVerify(ticketId, day);
      const { status } = res.data;

      if (status === "success") {
        clientLogger.success("VERIFY SUCCESS", `✓ VALID PASS: ${res.data.name} (${res.data.dept})`);
        setResult(res.data); setState("success");
      } else if (status === "already_scanned") {
        clientLogger.warn("VERIFY DUPLICATE", `⚠ ALREADY USED: ${res.data.name} (by ${res.data.scanned_by} at ${res.data.scanned_at})`);
        setResult(res.data); setState("duplicate");
      } else {
        clientLogger.error("VERIFY INVALID", `✗ INVALID TICKET: '${ticketId}' not found in database`);
        setState("invalid");
      }
    } catch (err: any) {
      clientLogger.error("VERIFY NETWORK ERR", `Network error while verifying ticket '${ticketId}': ${err.message}`);
      setState("invalid");
      setBackOnline(false);
    }

    setTimeout(async () => {
      setState("idle"); setResult(null);
      setManualId(""); processingRef.current = false;
      await startCamera();
    }, 2500);
  }

  // ── Screen 1: Day Selection Screen ──────────────────────────────
  if (!day) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 relative overflow-hidden">
        {/* Ambient background glow - Professional Steel Blue */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Bar with Logout */}
        <div className="w-full max-w-sm mx-auto flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-300">Logged in: <strong className="text-white">{username}</strong></span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 px-3 py-1.5 rounded-lg transition"
          >
            <span>Logout</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="w-full max-w-sm mx-auto my-auto py-8 text-center">
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold tracking-widest uppercase mb-4">
            KELI 2026 &middot; Gate Pass
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-wider mb-2">
            Select Pro-Show Night
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            Choose which day's tickets you are scanning at the entrance gate.
          </p>

          <div className="space-y-4">
            <button
              onClick={() => setDay(1)}
              className="w-full group bg-slate-900/90 hover:bg-blue-950/60 border border-slate-800 hover:border-blue-600/60 rounded-2xl p-5 text-left transition duration-200 shadow-xl flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-blue-400 tracking-widest uppercase block mb-1">
                  Pro-Show Night 1
                </span>
                <span className="text-xl font-extrabold text-white group-hover:text-blue-200">
                  Day 1 Pass
                </span>
                <span className="text-xs text-slate-400 block mt-1">September 25</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-300 flex items-center justify-center font-bold text-lg border border-blue-500/30 group-hover:bg-blue-600 group-hover:text-white transition">
                ➔
              </div>
            </button>

            <button
              onClick={() => setDay(2)}
              className="w-full group bg-slate-900/90 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-600/60 rounded-2xl p-5 text-left transition duration-200 shadow-xl flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-cyan-400 tracking-widest uppercase block mb-1">
                  Pro-Show Night 2
                </span>
                <span className="text-xl font-extrabold text-white group-hover:text-cyan-200">
                  Day 2 Pass
                </span>
                <span className="text-xs text-slate-400 block mt-1">September 26</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-300 flex items-center justify-center font-bold text-lg border border-cyan-500/30 group-hover:bg-cyan-600 group-hover:text-white transition">
                ➔
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600">
          GEC RIT Kottayam Student Union
        </div>
      </div>
    );
  }

  // ── Screen 2: Active Scanner Screen ──────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4">
      {/* Top Header Bar */}
      <div className="w-full max-w-sm flex items-center justify-between bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 mb-4 shadow-lg">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${backOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          <span className="text-xs font-bold text-slate-200">{username}</span>
        </div>

        <span className="text-xs font-extrabold bg-blue-900/80 text-blue-200 border border-blue-700/60 px-3 py-1 rounded-full">
          Day {day} &middot; Sept 2{4 + day}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { stopCamera(); setDay(null); }}
            className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 px-2.5 py-1 rounded-lg transition"
          >
            Change
          </button>

          <button
            onClick={handleLogout}
            className="text-xs text-rose-400 hover:text-rose-300 bg-rose-950/50 hover:bg-rose-900/80 border border-rose-800/60 px-2.5 py-1 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Backend Connection Warning */}
      {!backOnline && (
        <div className="w-full max-w-sm mb-3 bg-rose-950/80 border border-rose-800 rounded-xl px-4 py-2.5 text-xs text-rose-300 font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>Backend unreachable. Ensure host laptop is online and on the same WiFi.</span>
        </div>
      )}

      {/* QR Camera Preview Window */}
      <div
        id="qr-reader"
        className="w-full max-w-sm rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 shadow-2xl relative"
        style={{ minHeight: 300 }}
      />

      {/* Verification Status Cards */}
      <div className="w-full max-w-sm mt-4">
        {state === "verifying" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center shadow-lg">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
            <div className="text-slate-300 font-semibold text-sm">Verifying Ticket...</div>
          </div>
        )}

        {state === "success" && (
          <div className="bg-emerald-950/90 border-2 border-emerald-500/80 rounded-2xl p-5 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 mb-1">
              ✓ ENTRY GRANTED
            </div>
            <div className="text-3xl font-black text-white tracking-wide">{result?.name}</div>
            <div className="text-sm font-semibold text-emerald-200 mt-2">
              {result?.dept} &middot; {PROGRAM_LABELS[result?.program] || result?.program} Year {result?.year}
            </div>
          </div>
        )}

        {state === "duplicate" && (
          <div className="bg-amber-950/90 border-2 border-amber-500/80 rounded-2xl p-5 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="text-xs font-extrabold uppercase tracking-widest text-amber-400 mb-1">
              ⚠️ TICKET ALREADY USED
            </div>
            <div className="text-2xl font-black text-white">{result?.name}</div>
            <div className="text-xs text-amber-200/80 mt-2 font-medium">
              Scanned by <strong className="text-amber-100">{result?.scanned_by}</strong>
              {result?.scanned_at ? ` at ${new Date(result.scanned_at + "Z").toLocaleTimeString()}` : ""}
            </div>
            <div className="mt-3 inline-block bg-rose-900/80 text-rose-200 border border-rose-700/80 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              DO NOT ALLOW ENTRY
            </div>
          </div>
        )}

        {state === "invalid" && (
          <div className="bg-rose-950/90 border-2 border-rose-500/80 rounded-2xl p-5 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="text-xs font-extrabold uppercase tracking-widest text-rose-400 mb-1">
              ✗ INVALID TICKET
            </div>
            <div className="text-xl font-bold text-white mt-1">Ticket Not Found</div>
            <div className="text-xs text-rose-300 mt-1">Please check ticket ID or scan again</div>
          </div>
        )}
      </div>

      {/* Manual Entry Fallback */}
      <div className="w-full max-w-sm mt-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-400 mb-2 text-center uppercase tracking-wider">
          Manual Ticket Code Entry
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-slate-950 border border-slate-700/80 text-white font-mono rounded-xl px-3 py-2.5 text-sm uppercase tracking-widest focus:outline-none focus:border-blue-500"
            placeholder="KB1A1001"
            maxLength={8}
            value={manualId}
            onChange={e => setManualId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            onKeyDown={e => e.key === "Enter" && manualId.length === 8 && handleTicketId(manualId)}
          />
          <button
            onClick={() => manualId.length === 8 && handleTicketId(manualId)}
            disabled={manualId.length !== 8}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition"
          >
            Check
          </button>
        </div>
      </div>
    </div>
  );
}
