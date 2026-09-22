import { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { api } from "../api";

type ScanState = "idle" | "verifying" | "success" | "duplicate" | "invalid";

const PROGRAM_LABELS: Record<string, string> = {
  B: "BTech", M: "MCA", T: "MTech", A: "B.Arch",
};

// Smaller qrbox = fewer pixels processed per frame = faster detection
const QR_CONFIG = { fps: 15, qrbox: { width: 220, height: 220 } };

export default function Scanner() {
  const [state,      setState]      = useState<ScanState>("idle");
  const [result,     setResult]     = useState<any>(null);
  const [day,        setDay]        = useState<1 | 2 | null>(null);
  const [manualId,   setManualId]   = useState("");
  const [backOnline, setBackOnline] = useState(true);
  const scannerRef    = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const username = localStorage.getItem("keli_username") || "scanner";

  useEffect(() => {
    if (!day) return;
    startCamera();
    pingBackend();
    return () => { stopCamera(); };
  }, [day]);

  async function pingBackend() {
    try { await api.ping(); setBackOnline(true); }
    catch { setBackOnline(false); }
  }

  async function startCamera() {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        QR_CONFIG,
        (text) => handleTicketId(text.trim().toUpperCase()),
        () => {}
      );
    } catch (e) {
      console.error("Camera start failed:", e);
    }
  }

  async function stopCamera() {
    try { await scannerRef.current?.stop(); } catch {}
  }

  async function handleTicketId(ticketId: string) {
    if (processingRef.current || !day) return;
    processingRef.current = true;

    // Pause camera, show spinner immediately before the await
    await stopCamera();
    setState("verifying");

    try {
      // Single call — verify + scan in one round trip
      const res = await api.scanAndVerify(ticketId, day);
      const { status } = res.data;

      if (status === "success") {
        setResult(res.data); setState("success");
      } else if (status === "already_scanned") {
        setResult(res.data); setState("duplicate");
      } else {
        setState("invalid");
      }
    } catch {
      setState("invalid");
      setBackOnline(false);
    }

    setTimeout(async () => {
      setState("idle"); setResult(null);
      setManualId(""); processingRef.current = false;
      await startCamera();
    }, 2500);
  }

  if (!day) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold text-white tracking-widest mb-2">KELI 2026</h1>
        <p className="text-gray-500 text-sm mb-10">Select tonight's pro-show</p>
        <div className="space-y-4 w-full max-w-xs">
          <button onClick={() => setDay(1)}
            className="w-full py-5 bg-purple-900 hover:bg-purple-800 text-white rounded-xl font-semibold text-lg border border-purple-700">
            Day 1 · September 25
          </button>
          <button onClick={() => setDay(2)}
            className="w-full py-5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-semibold text-lg border border-indigo-700">
            Day 2 · September 26
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center p-4">
      <div className="w-full max-w-sm flex items-center justify-between mb-4">
        <span className="text-xs text-gray-500">{username}</span>
        <span className="text-xs bg-purple-900 text-purple-200 px-3 py-1 rounded-full">
          Day {day} · Sept 2{4 + day}
        </span>
        <button onClick={() => { stopCamera(); setDay(null); }}
          className="text-xs text-gray-600 hover:text-gray-400">
          Change day
        </button>
      </div>

      {/* Backend offline warning */}
      {!backOnline && (
        <div className="w-full max-w-sm mb-3 bg-red-950 border border-red-800 rounded-lg px-3 py-2 text-xs text-red-400">
          ⚠ Cannot reach backend. Check laptop is on and on the same network.
        </div>
      )}

      <div id="qr-reader"
        className="w-full max-w-sm rounded-xl overflow-hidden border border-gray-800 bg-gray-950"
        style={{ minHeight: 300 }}
      />

      <div className="w-full max-w-sm mt-4">
        {state === "verifying" && (
          <div className="text-center text-gray-400 animate-pulse py-4">Checking...</div>
        )}
        {state === "success" && (
          <div className="bg-green-950 border border-green-700 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-400">✓ VALID</div>
            <div className="text-lg text-white mt-1 font-semibold">{result?.name}</div>
            <div className="text-sm text-gray-400 mt-1">
              {result?.dept} · {PROGRAM_LABELS[result?.program] || result?.program} Year {result?.year}
            </div>
          </div>
        )}
        {state === "duplicate" && (
          <div className="bg-orange-950 border border-orange-700 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-orange-400">⚠ ALREADY USED</div>
            <div className="text-lg text-white mt-1">{result?.name}</div>
            <div className="text-xs text-gray-400 mt-1">
              Scanned by <span className="text-orange-300">{result?.scanned_by}</span>
              {result?.scanned_at ? ` at ${new Date(result.scanned_at + "Z").toLocaleTimeString()}` : ""}
            </div>
            <div className="text-xs text-red-400 mt-2 font-semibold">DO NOT ALLOW ENTRY</div>
          </div>
        )}
        {state === "invalid" && (
          <div className="bg-red-950 border border-red-700 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-400">✗ INVALID</div>
            <div className="text-sm text-gray-400 mt-1">Ticket not found in system</div>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm mt-6">
        <p className="text-xs text-gray-600 mb-2 text-center">Manual entry (if QR won't scan)</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-900 border border-gray-700 text-white font-mono rounded-lg px-3 py-2 text-sm uppercase tracking-widest"
            placeholder="KB1A1001" maxLength={8} value={manualId}
            onChange={e => setManualId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            onKeyDown={e => e.key === "Enter" && manualId.length === 8 && handleTicketId(manualId)}
          />
          <button
            onClick={() => manualId.length === 8 && handleTicketId(manualId)}
            disabled={manualId.length !== 8}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm"
          >
            Check
          </button>
        </div>
      </div>
    </div>
  );
}
