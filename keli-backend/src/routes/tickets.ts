import { Router, Request, Response } from "express";
import db from "../db";
import { requireAuth } from "../auth";
import { logInfo, logWarn, logError } from "../logger";

const router = Router();

// ── POST /api/tickets/scan-and-verify ────────────────────────────

router.post("/scan-and-verify", requireAuth, (req: Request, res: Response) => {
  const { ticketId, day } = req.body as { ticketId: string; day: number };
  const scannerId = (req as any).username as string;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

  logInfo("SCAN REQ", `Scanner '${scannerId}' from IP ${ip} submitted ticketId '${ticketId}' for Day ${day}`);

  if (!ticketId || ![1, 2].includes(Number(day))) {
    logWarn("SCAN INVALID PARAM", `Invalid params: ticketId='${ticketId}', day='${day}'`);
    res.status(400).json({ error: "ticketId and day (1 or 2) required" });
    return;
  }

  const field = `day${day}`;

  // Step 1: check existence and current scan state
  const existing: any = db.prepare(
    `SELECT * FROM tickets WHERE ${field} = ?`
  ).get(ticketId);

  if (!existing) {
    logWarn("SCAN NOT FOUND", `Ticket ID '${ticketId}' not found in database for Day ${day} (Scanner: ${scannerId})`);
    res.json({ status: "invalid" });
    return;
  }

  if (existing[`${field}_scanned`] === 1) {
    logWarn(
      "SCAN DUPLICATE",
      `Ticket '${ticketId}' (${existing.name}) ALREADY USED on Day ${day}. ` +
      `Prev scanned by '${existing[`${field}_scanned_by`] || "unknown"}' at ${existing[`${field}_scanned_at`]}`
    );
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

    logWarn("SCAN RACE DUPLICATE", `Concurrent scan race lost for ticket '${ticketId}' (${existing.name})`);

    res.json({
      status:     "already_scanned",
      name:       updated.name,
      scanned_at: updated[`${field}_scanned_at`],
      scanned_by: updated[`${field}_scanned_by`],
    });
    return;
  }

  logInfo(
    "SCAN VALID SUCCESS",
    `✓ VALID PASS: Ticket '${ticketId}' -> Name: '${existing.name}', Dept: '${existing.dept}', ` +
    `Prog: '${existing.program}', Year: '${existing.year}' (Scanned by: '${scannerId}')`
  );

  res.json({
    status:  "success",
    name:    existing.name,
    dept:    existing.dept,
    year:    existing.year,
    program: existing.program,
  });
});

// ── GET /api/tickets/stats ────────────────────────────────────────

router.get("/stats", requireAuth, (req: Request, res: Response) => {
  const scannerId = (req as any).username;
  logInfo("STATS FETCH", `Stats fetched by user '${scannerId}'`);

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

router.get("/", requireAuth, (req: Request, res: Response) => {
  const q         = req.query.q as string | undefined;
  const limit     = parseInt(req.query.limit as string) || 100;
  const scannerId = (req as any).username;

  logInfo("SEARCH REQ", `User '${scannerId}' searched query: '${q || "<all>"}' (limit: ${limit})`);

  const rows = q
    ? db.prepare(`
        SELECT * FROM tickets
        WHERE name LIKE ? OR email LIKE ? OR day1 = ? OR day2 = ?
        LIMIT ?
      `).all(`%${q}%`, `%${q}%`, q, q, limit)
    : db.prepare("SELECT * FROM tickets LIMIT ?").all(limit);

  logInfo("SEARCH RESULT", `Search query '${q || "<all>"}' returned ${rows.length} records`);

  res.json(rows);
});

// ── PATCH /api/tickets/:id ────────────────────────────────────────

router.patch("/:id", requireAuth, (req: Request, res: Response) => {
  const { id }    = req.params;
  const scannerId = (req as any).username;

  const allowed = [
    "day1_scanned", "day1_scanned_at", "day1_scanned_by",
    "day2_scanned", "day2_scanned_at", "day2_scanned_by",
  ];

  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (updates.length === 0) {
    logWarn("OVERRIDE REJECTED", `User '${scannerId}' attempt to override ID ${id} with no valid fields`);
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  logInfo("OVERRIDE EXEC", `User '${scannerId}' overriding ticket record ID ${id}: ${JSON.stringify(req.body)}`);

  const sets = updates.map(([k]) => `${k} = ?`).join(", ");
  const vals = updates.map(([, v]) => v);
  db.prepare(`UPDATE tickets SET ${sets} WHERE id = ?`).run(...vals, id);

  const updatedRecord = db.prepare("SELECT * FROM tickets WHERE id = ?").get(id);
  res.json(updatedRecord);
});

// ── GET /api/ping ─────────────────────────────────────────────────

router.get("/ping", requireAuth, (req: Request, res: Response) => {
  const scannerId = (req as any).username;
  logInfo("PING", `Ping received from scanner '${scannerId}'`);
  res.json({ ok: true, time: new Date().toISOString() });
});

export default router;
