import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { logInfo, logWarn } from "./logger";

interface SessionInfo {
  sessionId: string;
  ip: string;
  loggedInAt: string;
}

// In-memory store for active session per username (enforces 1 device per scanner)
const activeSessions = new Map<string, SessionInfo>();

function loadCredentials(): Record<string, string> {
  const raw = process.env.SCANNERS || "";
  return Object.fromEntries(
    raw.split(",").map((entry: string) => {
      const parts = entry.split(":");
      const user = parts[0] ? parts[0].trim() : "";
      const pass = parts[1] ? parts[1].trim() : "";
      return [user, pass];
    }).filter(([u, p]: string[]) => u && p)
  );
}

export function login(req: Request, res: Response): void {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
  const secret = process.env.JWT_SECRET || "fallback_secret";
  const { username, password } = req.body as { username?: string; password?: string };
  
  const CREDENTIALS = loadCredentials();
  
  logInfo("AUTH ATTEMPT", `User '${username || "EMPTY"}' attempting login from IP: ${ip}`);

  if (!username || !password || CREDENTIALS[username] !== password) {
    logWarn("AUTH FAILED", `Invalid credentials for user '${username}' from IP: ${ip}`);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Check if this account was already logged in on another device
  const existingSession = activeSessions.get(username);
  if (existingSession) {
    logWarn(
      "AUTH SESSION OVERRIDE",
      `Account '${username}' was active from IP ${existingSession.ip} (logged in at ${existingSession.loggedInAt}). ` +
      `Invalidating old session. New session granted to IP: ${ip}`
    );
  }

  // Generate a unique session ID for this login
  const sessionId = crypto.randomUUID();
  activeSessions.set(username, {
    sessionId,
    ip,
    loggedInAt: new Date().toISOString(),
  });

  const token = jwt.sign({ username, sessionId }, secret, { expiresIn: "24h" });
  logInfo("AUTH SUCCESS", `User '${username}' logged in successfully (Session ID: ${sessionId}) from IP: ${ip}`);
  res.json({ token, username });
}

export function logout(req: Request, res: Response): void {
  const username = (req as any).username as string;
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

  if (username) {
    activeSessions.delete(username);
    logInfo("AUTH LOGOUT", `User '${username}' logged out from IP: ${ip}`);
  }

  res.json({ ok: true, message: "Logged out successfully" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET || "fallback_secret";
  const header = req.headers.authorization;
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

  if (!header || !header.startsWith("Bearer ")) {
    logWarn("AUTH DENIED", `No token provided for ${req.method} ${req.originalUrl} from IP: ${ip}`);
    res.status(401).json({ error: "No token provided" });
    return;
  }

  try {
    const token = header.split(" ")[1];
    const payload = jwt.verify(token, secret) as { username: string; sessionId?: string };
    const username = payload.username;
    const currentSession = activeSessions.get(username);

    // Verify that this token matches the currently active session for this user
    if (!currentSession || currentSession.sessionId !== payload.sessionId) {
      logWarn(
        "AUTH SESSION KICKED",
        `Rejected stale session for '${username}' on ${req.method} ${req.originalUrl} from IP: ${ip} ` +
        `(Account logged in on another device or logged out)`
      );
      res.status(401).json({
        error: "Session expired: This account has logged in on another device. Please log in again.",
        code: "SESSION_OVERRIDDEN",
      });
      return;
    }

    (req as any).username = username;
    next();
  } catch (err: any) {
    logWarn("AUTH INVALID TOKEN", `Invalid/expired token for ${req.method} ${req.originalUrl} from IP: ${ip} (${err.message})`);
    res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
}
