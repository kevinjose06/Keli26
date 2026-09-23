import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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
  const secret = process.env.JWT_SECRET || "fallback_secret";
  const { username, password } = req.body as { username: string; password: string };
  
  const CREDENTIALS = loadCredentials();
  
  if (!username || !password || CREDENTIALS[username] !== password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = jwt.sign({ username }, secret, { expiresIn: "24h" });
  res.json({ token, username });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET || "fallback_secret";
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }
  try {
    const token   = header.split(" ")[1];
    const payload = jwt.verify(token, secret) as { username: string };
    (req as any).username = payload.username;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
}
