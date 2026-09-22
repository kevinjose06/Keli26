import * as XLSX from "xlsx";
import path from "path";
import fs   from "fs";

const DB_PATH   = path.join(__dirname, "../keli.db");
const XLSX_PATH = process.argv[2]
  || path.join(__dirname, "../../python/output/processed.xlsx");

if (!fs.existsSync(XLSX_PATH)) {
  console.error(`[FATAL] File not found: ${XLSX_PATH}`);
  process.exit(1);
}

let db: any;
try {
  const { DatabaseSync } = require("node:sqlite");
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
} catch (e) {
  const Database = require("better-sqlite3");
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, email TEXT NOT NULL,
    dept TEXT DEFAULT '', year INTEGER DEFAULT 0,
    program TEXT DEFAULT 'B', group_code TEXT DEFAULT '0',
    day1 TEXT UNIQUE, day1_scanned INTEGER DEFAULT 0,
    day1_scanned_at TEXT DEFAULT NULL, day1_scanned_by TEXT DEFAULT '',
    day2 TEXT UNIQUE, day2_scanned INTEGER DEFAULT 0,
    day2_scanned_at TEXT DEFAULT NULL, day2_scanned_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_day1 ON tickets(day1);
  CREATE INDEX IF NOT EXISTS idx_day2 ON tickets(day2);
`);

const workbook = XLSX.readFile(XLSX_PATH);
const sheet    = workbook.Sheets[workbook.SheetNames[0]];
const rows     = XLSX.utils.sheet_to_json(sheet) as any[];

console.log(`Found ${rows.length} rows in XLSX...`);

const existing = (db.prepare("SELECT COUNT(*) as c FROM tickets").get() as any).c;
if (existing > 0) {
  console.log(`\n⚠  Database already has ${existing} tickets.`);
  console.log("   Use --force to overwrite.");
  if (!process.argv.includes("--force")) {
    console.log("   Aborted."); process.exit(0);
  }
  db.prepare("DELETE FROM tickets").run();
  console.log("   Existing data cleared.\n");
}

const insert = db.prepare(`
  INSERT INTO tickets (name, email, dept, year, program, group_code, day1, day2)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let ok = 0, skipped = 0;
for (const row of rows) {
  const name    = String(row["Name"]    || row["name"]    || "").trim();
  const email   = String(row["Email"]   || row["email"]   || "").trim();
  const dept    = String(row["Dept"]    || row["dept"]    || "").trim();
  const year    = Number(row["Year"]    || row["year"]    || 0);
  const program = String(row["Program"] || row["program"] || "B").trim();
  const group   = String(row["Group"]   || row["group"]   || "0").trim();
  const day1    = String(row["day1"]    || "").trim();
  const day2    = String(row["day2"]    || "").trim();

  if (!name || !email || !day1 || !day2) {
    console.log(`  [SKIP] Missing data: ${name} | ${email}`);
    skipped++; continue;
  }
  try {
    insert.run(name, email, dept, year, program, group, day1, day2);
    ok++;
  } catch (e: any) {
    console.log(`  [ERROR] ${name}: ${e.message}`);
    skipped++;
  }
}

const count = (db.prepare("SELECT COUNT(*) as c FROM tickets").get() as any).c;
console.log(`\n✓ Import complete · Inserted: ${ok} · Skipped: ${skipped} · Total in DB: ${count}`);
if (db.close) db.close();
