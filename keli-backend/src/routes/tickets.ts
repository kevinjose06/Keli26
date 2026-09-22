import { Router, Request, Response } from "express";
import db from "../db";
import { requireAuth } from "../auth";

const router = Router();

// ── POST /api/tickets/scan-and-verify ────────────────────────────
//
// Single-call endpoint: verify + mark scanned in one round trip.
// Replaces the original two-call pattern (verify then scan) to
// eliminate the extra network round trip and reduce gate lag.
//
// Concurrency safety: the UPDATE only fires if day{N}_scanned = 0.
// SQLite's write lock guarantees that if two scanner phones hit
// this simultaneously with the same ticket, only one UPDATE succeeds.
// The other sees changes = 0 and returns already_scanned.

router.post("/scan-and-verify", requireAuth, (req: Request, res: Response) => {
  const { ticketId, day } = req.body as { ticketId: string; day: number };
  const scannerId = (req as any).username as string;

  if (!ticketId || ![1, 2].includes(Number(day))) {
    res.status(400).json({ error: "ticketId and day (1 or 2) required" });
    return;
  }

  const field = `day${day}`;

  // Step 1: check existence and current scan state
  const existing: any = db.prepare(
    `SELECT * FROM tickets WHERE ${field} = ?`
  ).get(ticketId);

  if (!existing) {
    res.json({ status: "invalid" });
    return;
  }

  if (existing[`${field}_scanned`] === 1) {
    res.json({
      status:     "already_scanned",
      name:       existing.name,
      scanned_at: existing[`${field}_scanned_at`],
      scanned_by: existing[`${field}_scanned_by`],
    });
    return;
  }

  // Step 2: atomic mark — only succeeds if still unscanned
  const result = db.prepare(`
    UPDATE tickets
    SET   ${field}_scanned    = 1,
          ${field}_scanned_at = datetime('now'),
          ${field}_scanned_by = ?
    WHERE ${field} = ? AND ${field}_scanned = 0
  `).run(scannerId, ticketId);

  if (result.changes === 0) {
    // Lost the race — another scanner marked it between SELECT and UPDATE
    const updated: any = db.prepare(
      `SELECT * FROM tickets WHERE ${field} = ?`
    ).get(ticketId);
    res.json({
      status:     "already_scanned",
      name:       updated.name,
      scanned_at: updated[`${field}_scanned_at`],
      scanned_by: updated[`${field}_scanned_by`],
    });
    return;
  }

  res.json({
    status:  "success",
    name:    existing.name,
    dept:    existing.dept,
    year:    existing.year,
    program: existing.program,
  });
});

// ── GET /api/tickets/stats ────────────────────────────────────────
// Live scan counts — polled by admin dashboard every 5 seconds

router.get("/stats", requireAuth, (_req: Request, res: Response) => {
  const total       = (db.prepare("SELECT COUNT(*) as c FROM tickets").get() as any).c;
  const day1Scanned = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE day1_scanned = 1").get() as any).c;
  const day2Scanned = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE day2_scanned = 1").get() as any).c;

  const byProgram: any[] = db.prepare(`
    SELECT program,
           COUNT(*) as total,
           SUM(day1_scanned) as day1,
           SUM(day2_scanned) as day2
    FROM tickets
    GROUP BY program
  `).all();

  res.json({ total, day1Scanned, day2Scanned, byProgram });
});

// ── GET /api/tickets ──────────────────────────────────────────────
// Admin: full ticket list with optional search

router.get("/", requireAuth, (req: Request, res: Response) => {
  const q     = req.query.q as string | undefined;
  const limit = parseInt(req.query.limit as string) || 100;

  const rows = q
    ? db.prepare(`
        SELECT * FROM tickets
        WHERE name LIKE ? OR email LIKE ? OR day1 = ? OR day2 = ?
        LIMIT ?
      `).all(`%${q}%`, `%${q}%`, q, q, limit)
    : db.prepare("SELECT * FROM tickets LIMIT ?").all(limit);

  res.json(rows);
});

// ── PATCH /api/tickets/:id ────────────────────────────────────────
// Admin: manual override for edge cases at the gate

router.patch("/:id", requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const allowed = [
    "day1_scanned", "day1_scanned_at", "day1_scanned_by",
    "day2_scanned", "day2_scanned_at", "day2_scanned_by",
  ];

  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (updates.length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const sets = updates.map(([k]) => `${k} = ?`).join(", ");
  const vals = updates.map(([, v]) => v);
  db.prepare(`UPDATE tickets SET ${sets} WHERE id = ?`).run(...vals, id);

  res.json(db.prepare("SELECT * FROM tickets WHERE id = ?").get(id));
});

// ── GET /api/ping ─────────────────────────────────────────────────
// Health check — scanner frontend calls this on load to confirm backend is alive

router.get("/ping", requireAuth, (_req: Request, res: Response) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

export default router;
