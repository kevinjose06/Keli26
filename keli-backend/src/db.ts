import path from "path";

const dbPath = path.join(__dirname, "../keli.db");
let db: any;

try {
  // Built-in SQLite module available in Node 22.5.0+
  const { DatabaseSync } = require("node:sqlite");
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
} catch (e) {
  // Fallback to better-sqlite3 if node:sqlite is not available
  const Database = require("better-sqlite3");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,
    email            TEXT    NOT NULL,
    dept             TEXT    DEFAULT '',
    year             INTEGER DEFAULT 0,
    program          TEXT    DEFAULT 'B',
    group_code       TEXT    DEFAULT '0',
    day1             TEXT    UNIQUE,
    day1_scanned     INTEGER DEFAULT 0,
    day1_scanned_at  TEXT    DEFAULT NULL,
    day1_scanned_by  TEXT    DEFAULT '',
    day2             TEXT    UNIQUE,
    day2_scanned     INTEGER DEFAULT 0,
    day2_scanned_at  TEXT    DEFAULT NULL,
    day2_scanned_by  TEXT    DEFAULT '',
    created_at       TEXT    DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_day1 ON tickets(day1);
  CREATE INDEX IF NOT EXISTS idx_day2 ON tickets(day2);
`);

export default db;
