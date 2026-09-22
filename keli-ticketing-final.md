# KELI 2026 — Complete Ticketing System Architecture

> Event: Keli Arts Fest · Sept 24–26 · GEC RIT Kottayam
> Pro-shows: **Sept 25 (Day 1)** and **Sept 26 (Day 2)** — tickets required for both
> Students only · ~1500 footfall · Zero budget

---

## PART 0 — PREREQUISITES (Do These Before Writing Code)

These are not optional. Every item missed here becomes a crisis on event day.

| # | Task | Who | Deadline |
|---|---|---|---|
| 1 | Get a sample/dummy Excel from the union office — don't wait for the final list | You | Day 1 |
| 2 | Confirm exact sheet tab names in that file (CSE-A, CSE-B, ECE, etc.) | You | Day 1 |
| 3 | Confirm which days are the pro-shows (Sept 25 & 26) | You | Day 1 |
| 4 | Get login access to the college Google Workspace Gmail account | You | Day 1 |
| 5 | Create a Google Drive folder named exactly `keli-qr-codes` in that account | You | Day 1 |
| 6 | Create the GitHub repo, invite all team members | You | Day 1 |
| 7 | Assign roles: 1 person Python · 1 person Backend · 1 person Frontend · 1 person App Script | You | Day 1 |
| 8 | Each member installs: Node 20+, Python 3.10+, Git | Team | Day 2 |
| 9 | Test laptop hotspot — confirm it supports 4+ connected devices simultaneously | You | Day 3 |
| 10 | Identify the 3–4 phones to be used as scanners on event day — test their browsers open camera | You | Day 3 |
| 11 | Decide scanner credentials: scanner1/scanner2/scanner3/admin and their passwords | You | Day 4 |
| 12 | Confirm the student list will be finalised by Sept 21 — push hard for this | You | Day 1 |
| 13 | Get a power extension cord for the laptop at the venue | You | Day 4 |
| 14 | Print the final ticket ID list as a paper backup before the event | You | Sept 24 |

---

## PART 1 — SYSTEM OVERVIEW

### Flow

```
[Year-based Excel files from union]
            │
            ▼
    [Python Script — local]
    ├── Reads all year files
    ├── Detects program + dept from sheet name
    ├── Generates unique 8-char ticket IDs
    ├── Generates QR PNGs (no external API)
    └── Outputs: processed.xlsx + qr/ folder
            │
            ├──[Upload qr/ folder]──▶ Google Drive · "keli-qr-codes"
            │
            └──[Import processed.xlsx]──▶ Google Sheets · "students" sheet
                                                  │
                                                  ▼
                                        [App Script Mailer]
                                        ├── Reads sheet row by row
                                        ├── Fetches QR PNGs from Drive
                                        ├── Builds HTML email
                                        ├── Sends via GmailApp
                                        └── Marks sent/failed in sheet
                                                  │
                                                  ▼
                                        [Import Script]
                                        └── processed.xlsx ──▶ keli.db (SQLite)

                                        [Event Day — LAN only]
                                        ┌──────────────────────────────┐
                                        │  Laptop (hotspot + backend)  │
                                        │  ┌─────────────────────────┐ │
                                        │  │  Express + SQLite       │ │
                                        │  │  serving React frontend │ │
                                        │  └────────────┬────────────┘ │
                                        └───────────────┼──────────────┘
                                                        │ HTTPS · LAN
                                              ┌─────────┴─────────┐
                                         Phone 1              Phone 2–4
                                        (Scanner)            (Scanners)
```

---

## PART 2 — TICKET ID FORMAT (FINAL)

### Structure — always exactly 8 characters

```
K  [P]  [Y]  [G]  [D]  [N][N][N]
│   │    │    │    │    └────────── 001–999  (student counter per group per day)
│   │    │    │    └─────────────── 1 or 2   (pro-show day)
│   │    │    └──────────────────── Group    (see table)
│   │    └───────────────────────── 1–5      (year of study in their program)
│   └────────────────────────────── Program  (B / M / T / A)
└────────────────────────────────── K        (Keli prefix)
```

### Program Codes `[P]`

| Code | Program | Years |
|---|---|---|
| `B` | BTech | 1–4 |
| `M` | MCA | 1–2 |
| `T` | MTech | 1–2 |
| `A` | B.Arch | 1–5 |

### Group Codes `[G]`

| Code | Maps to | Notes |
|---|---|---|
| `A` | CSE Batch A | BTech CSE-A — years 1, 2, 3 only |
| `B` | CSE Batch B | BTech CSE-B — years 1, 2, 3 only |
| `C` | CSE (single) | BTech CSE year 4 — no A/B batch |
| `E` | ECE | BTech Electronics & Communication |
| `M` | ME | BTech Mechanical Engineering |
| `V` | Civil | BTech Civil Engineering |
| `L` | EEE | BTech Electrical & Electronics |
| `R` | RAI | BTech Robotics & Artificial Intelligence |
| `0` | No group | MCA, MTech, B.Arch (no batch divisions) |

### Counter Capacity — Why 999 Is More Than Enough

The counter `NNN` resets per `(Program, Year, Group, Day)` — not across all 1500 students. Each department in each year is its own counter. Realistic numbers:

| Group | Typical students per year | Counter max hit |
|---|---|---|
| CSE-A Year 1 | ~60 | 060 |
| ECE Year 2 | ~65 | 065 |
| Civil Year 3 | ~50 | 050 |
| MCA Year 1 | ~30 | 030 |

1500 students spread across ~30 group-year combinations means no single counter exceeds ~100. The 999 ceiling will never be hit. If it ever is, the script exits with an error and instructions to add a secondary group code.

### QR Complexity

`KB1A1001` is 8 uppercase alphanumeric characters. The `qrcode` library automatically generates QR Version 1 (21×21 pixel matrix) — the simplest QR that exists. Any phone camera made after 2015 scans it in under 500ms.

### Examples

| Ticket ID | Decoded |
|---|---|
| `KB1A1001` | BTech · Year 1 · CSE-A · Day 1 · Student 001 |
| `KB1B2047` | BTech · Year 1 · CSE-B · Day 2 · Student 047 |
| `KB4C1120` | BTech · Year 4 · CSE single batch · Day 1 · Student 120 |
| `KB2E2001` | BTech · Year 2 · ECE · Day 2 · Student 001 |
| `KB3R1010` | BTech · Year 3 · RAI · Day 1 · Student 010 |
| `KM101001` | MCA · Year 1 · No group · Day 1 · Student 001 |
| `KT201001` | MTech · Year 2 · No group · Day 1 · Student 001 |
| `KA301001` | B.Arch · Year 3 · No group · Day 1 · Student 001 |

---

## PART 3 — EXPECTED EXCEL INPUT STRUCTURE

### File Naming Convention

Rename your downloaded files **exactly** as follows before running the Python script:

| Filename | Contains |
|---|---|
| `year1.xlsx` | All Year 1 students (BTech, MCA yr1, MTech yr1, B.Arch yr1) |
| `year2.xlsx` | All Year 2 students (BTech, MCA yr2, MTech yr2, B.Arch yr2) |
| `year3.xlsx` | All Year 3 students (BTech, B.Arch yr3) — no MCA/MTech |
| `year4.xlsx` | All Year 4 students (BTech, B.Arch yr4) |
| `year5.xlsx` | Year 5 B.Arch only — create this file **only if applicable** |

### Sheet Tab Names → Group/Program Mapping

Each file has multiple sheet tabs, one per department. The script reads the tab name to determine group and program.

| Sheet tab name (case-insensitive match) | Program | Group |
|---|---|---|
| `CSE-A`, `CSEA`, `CSE A`, `CS-A`, `Batch A` | B | A |
| `CSE-B`, `CSEB`, `CSE B`, `CS-B`, `Batch B` | B | B |
| `CSE`, `CS` *(only in year4.xlsx)* | B | C |
| `ECE`, `Electronics` | B | E |
| `ME`, `Mechanical`, `Mech` | B | M |
| `Civil`, `CE`, `Civil Engg` | B | V |
| `EEE`, `Electrical` | B | L |
| `Robotics`, `RAI`, `Artificial Intelligence` | B | R |
| `MCA` | M | 0 |
| `MTech`, `M.Tech`, `M Tech` | T | 0 |
| `B.Arch`, `BArch`, `Architecture` | A | 0 |

> **CRITICAL**: Run `python check_sheets.py` (provided below) on your actual files before the main script. It prints every sheet name it finds. Verify all of them match something in the config. Unmatched sheets are skipped with a warning.

### Row Format (same across all files and all sheets)

| Column name | Content |
|---|---|
| `Sl No` | Serial number — ignored by script |
| `Name` | Full student name |
| `Mail id` or `Email` | Student email address |

No other columns are expected. Year, program, and dept are inferred from the file/sheet.

---

## PART 4 — DATABASE: SQLite

### Why SQLite, not MongoDB

| Factor | SQLite | MongoDB |
|---|---|---|
| Setup | Zero — single file, no daemon | Requires `mongod` running as a separate process |
| Startup at event | Open terminal, start node | Open terminal, start mongod, then start node |
| If it crashes | File is intact, restart node | mongod may need its own restart first |
| Atomic scan operation | `UPDATE WHERE scanned=0` — guaranteed by SQLite | `findOneAndUpdate` — atomic but more complex |
| Backup | `cp keli.db keli_backup.db` | `mongodump` |
| 1500 records | More than adequate | Overkill |
| Your schema | Fixed columns — relational is correct here | Document store adds no benefit |

**SQLite is the right database for this project. MongoDB adds operational complexity with zero benefit at this scale.**

### Handling Changing Requirements with SQLite

A common concern is whether SQLite handles mid-build schema changes. It does.

| Scenario | How to handle it |
|---|---|
| Need to add Day 3 | `ALTER TABLE tickets ADD COLUMN day3 TEXT UNIQUE` + the three tracking columns |
| Need to add a new field (seat number, note, etc.) | `ALTER TABLE tickets ADD COLUMN seat TEXT` — one command, no migration tool needed |
| Change a value for specific rows | Standard `UPDATE tickets SET x = y WHERE z = w` |
| Fix bad data after import | `UPDATE` or re-run import with `--force` flag |
| Inspect the DB manually | `sqlite3 keli.db` then any SQL query |

The only scenario where MongoDB beats SQLite is multiple servers writing to the same DB over a network simultaneously. That is not this project — single laptop, single file, 4 phones on LAN.

---

## PART 5 — COMPONENT 1: PYTHON DATA PIPELINE

### Install

```bash
pip install pandas qrcode[pil] openpyxl
```

### File 1: `check_sheets.py` — Run This First

Run this on your actual Excel files before anything else. It shows you every sheet name the script will encounter so you can verify the config matches.

```python
import pandas as pd
from pathlib import Path

FILES = ["year1.xlsx", "year2.xlsx", "year3.xlsx", "year4.xlsx", "year5.xlsx"]
INPUT_DIR = Path("input")

for filename in FILES:
    path = INPUT_DIR / filename
    if not path.exists():
        continue
    xl = pd.ExcelFile(path)
    print(f"\n{filename}:")
    for sheet in xl.sheet_names:
        df = xl.parse(sheet)
        print(f"  [{sheet}]  →  {len(df)} rows")
```

Run: `python check_sheets.py`

Read the output. Every sheet name listed must match a keyword in `SHEET_TO_PG` in the main script. If it doesn't, add it.

---

### File 2: `process_students.py` — Main Script

```python
import pandas as pd
import qrcode
from pathlib import Path
import sys

# ═══════════════════════════════════════════════════
#  CONFIG — Edit this block to match your actual data
# ═══════════════════════════════════════════════════

FILE_TO_YEAR = {
    "year1.xlsx": 1,
    "year2.xlsx": 2,
    "year3.xlsx": 3,
    "year4.xlsx": 4,
    "year5.xlsx": 5,   # B.Arch 5th year only — delete if not applicable
}

# Map sheet name keywords → (program_code, group_code)
# Checked in order — more specific matches must come first
# Script does case-insensitive substring matching
SHEET_TO_PG = [
    # CSE batches — specific first, before generic "cse"
    (["cse-a", "csea", "cse a", "cs-a", "batch a"],    ("B", "A")),
    (["cse-b", "cseb", "cse b", "cs-b", "batch b"],    ("B", "B")),
    # CSE single batch — year 4 only; matched after the two above
    (["cse", " cs "],                                   ("B", "C")),
    # BTech departments — RIT Kottayam
    (["ece", "electronics and comm"],                   ("B", "E")),
    (["eee", "electrical"],                             ("B", "L")),
    (["mechanical", "mech", " me "],                    ("B", "M")),
    (["civil"],                                         ("B", "V")),
    (["robotics", "rai", "artificial intelligence"],    ("B", "R")),
    # PG and professional programs — group always 0
    (["mca"],                                           ("M", "0")),
    (["mtech", "m.tech", "m tech"],                    ("T", "0")),
    (["arch"],                                          ("A", "0")),
]

# ═══════════════════════════════════════════════════

INPUT_DIR  = Path("input")
OUTPUT_DIR = Path("output")
QR_DIR     = OUTPUT_DIR / "qr"
QR_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def resolve_sheet(sheet_name: str):
    """Returns (program_code, group_code) or None if no match."""
    s = " " + sheet_name.lower().strip() + " "
    for keywords, codes in SHEET_TO_PG:
        if any(kw in s for kw in keywords):
            return codes
    return None


def make_qr(ticket_id: str) -> None:
    path = QR_DIR / f"{ticket_id}.png"
    if path.exists():
        return
    qrcode.make(ticket_id).save(path)


def validate_emails(df: pd.DataFrame) -> list:
    bad = df[~df["Email"].astype(str).str.contains(
        r"^[^@\s]+@[^@\s]+\.[^@\s]+$", na=False
    )]
    return [
        f"  BAD EMAIL: {row['Name']} | {row['Email']} | {row.get('Dept', '')}"
        for _, row in bad.iterrows()
    ]


def main():
    all_rows     = []
    unmatched    = []
    email_errors = []
    counters: dict = {}

    for filename, year in FILE_TO_YEAR.items():
        path = INPUT_DIR / filename
        if not path.exists():
            print(f"  [SKIP] {filename} — file not found")
            continue

        xl = pd.ExcelFile(path)

        for sheet_name in xl.sheet_names:
            codes = resolve_sheet(sheet_name)

            if codes is None:
                unmatched.append(f"{filename} → '{sheet_name}'")
                continue

            program, group = codes

            df = xl.parse(sheet_name)
            if df.empty:
                continue

            # Normalise column names
            df.columns = df.columns.str.strip()
            rename = {}
            for col in df.columns:
                lc = col.lower().strip()
                if lc == "name":
                    rename[col] = "Name"
                elif "mail" in lc or "email" in lc:
                    rename[col] = "Email"
            df = df.rename(columns=rename)

            if "Name" not in df.columns or "Email" not in df.columns:
                print(f"  [SKIP] Sheet '{sheet_name}' in {filename} — no Name/Email columns")
                continue

            df = df[["Name", "Email"]].copy()
            df["Name"]  = df["Name"].astype(str).str.strip()
            df["Email"] = df["Email"].astype(str).str.strip()
            df = df.dropna(subset=["Name", "Email"])
            df = df[df["Name"] != ""]
            df = df[df["Name"].str.lower() != "name"]
            df = df[df["Email"].str.lower().str.strip() != "mail id"]
            df = df[df["Email"].str.lower().str.strip() != "email"]

            df["Program"] = program
            df["Year"]    = year
            df["Group"]   = group
            df["Dept"]    = sheet_name.strip()

            email_errors.extend(validate_emails(df))

            # Assign ticket IDs
            day1_ids, day2_ids = [], []
            for _ in df.itertuples():
                for day in [1, 2]:
                    key = (program, year, group, day)
                    counters[key] = counters.get(key, 0) + 1
                    n = counters[key]
                    if n > 999:
                        print(f"  [ERROR] Counter > 999 for {key}. Add a new group code.")
                        sys.exit(1)
                    ticket_id = f"K{program}{year}{group}{day}{n:03d}"
                    if day == 1:
                        day1_ids.append(ticket_id)
                    else:
                        day2_ids.append(ticket_id)

            df["day1"] = day1_ids
            df["day2"] = day2_ids

            for d in ["day1", "day2"]:
                df[f"{d}_scanned"]    = False
                df[f"{d}_scanned_at"] = ""
                df[f"{d}_scanned_by"] = ""

            all_rows.append(df)
            print(f"  [OK] {filename} / '{sheet_name}' → {len(df)} students "
                  f"(Program={program} Group={group})")

    # ── Warnings ──────────────────────────────────────────────────

    if unmatched:
        print("\n⚠  UNMATCHED SHEETS — add these to SHEET_TO_PG in the config and re-run:")
        for s in unmatched:
            print(f"   {s}")

    if email_errors:
        print(f"\n⚠  {len(email_errors)} suspicious email addresses:")
        for e in email_errors:
            print(e)
        print("  Fix these in the input files before sending emails.")

    if not all_rows:
        print("\n[FATAL] No students loaded. Check file names and sheet config.")
        sys.exit(1)

    combined = pd.concat(all_rows, ignore_index=True)

    # Duplicate ticket ID safety check
    all_ids = list(combined["day1"]) + list(combined["day2"])
    dupes   = {x for x in all_ids if all_ids.count(x) > 1}
    if dupes:
        print(f"\n[FATAL] Duplicate ticket IDs found: {dupes}")
        sys.exit(1)

    print(f"\nGenerating {len(combined) * 2} QR codes...")
    for _, row in combined.iterrows():
        make_qr(row["day1"])
        make_qr(row["day2"])

    output_path = OUTPUT_DIR / "processed.xlsx"
    combined.to_excel(output_path, index=False)

    print(f"\n✓ {len(combined)} students processed")
    print(f"✓ {len(combined) * 2} QR codes → {QR_DIR}/")
    print(f"✓ Output → {output_path}")
    print(f"\nNext:")
    print(f"  1. Upload '{QR_DIR}/' folder to Google Drive as 'keli-qr-codes'")
    print(f"  2. Import '{output_path}' into Google Sheets as sheet named 'students'")

if __name__ == "__main__":
    main()
```

### Processed Output Columns

| Column | Content |
|---|---|
| `Name` | Student name |
| `Email` | Student email |
| `Dept` | Raw sheet tab name |
| `Program` | B / M / T / A |
| `Year` | 1–5 |
| `Group` | A / B / C / E / M / V / L / R / 0 |
| `day1` | Ticket ID for Sept 25 pro-show |
| `day1_scanned` | false (default) |
| `day1_scanned_at` | empty |
| `day1_scanned_by` | empty |
| `day2` | Ticket ID for Sept 26 pro-show |
| `day2_scanned` | false |
| `day2_scanned_at` | empty |
| `day2_scanned_by` | empty |

---

## PART 6 — COMPONENT 2: EMAIL SYSTEM (APP SCRIPT)

### Setup Steps

1. Import `processed.xlsx` into Google Sheets. Name the sheet tab `students`.
2. Go to Extensions → Apps Script.
3. Create two files: `mailer.gs` and `template.html`.
4. Confirm the Google Workspace account has 1500 emails/day quota (Workspace accounts have this; personal Gmail has 500).

### `mailer.gs`

```javascript
const SHEET_NAME  = "students";
const QR_FOLDER   = "keli-qr-codes";   // Must match Drive folder name exactly
const DELAY_MS    = 300;               // ms between emails — increase to 500 if failing

function sendTickets() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheet   = ss.getSheetByName(SHEET_NAME);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];

  const C = {
    name:   headers.indexOf("Name"),
    email:  headers.indexOf("Email"),
    day1:   headers.indexOf("day1"),
    day2:   headers.indexOf("day2"),
    status: headers.indexOf("mail_status"),
    sentAt: headers.indexOf("mail_sent_at"),
  };

  const missing = Object.entries(C).filter(([k, v]) => v === -1).map(([k]) => k);
  if (missing.length) throw new Error("Missing columns: " + missing.join(", "));

  const folderIter = DriveApp.getFoldersByName(QR_FOLDER);
  if (!folderIter.hasNext())
    throw new Error(`Drive folder '${QR_FOLDER}' not found. Create it and upload QR PNGs.`);
  const qrFolder = folderIter.next();

  let sent = 0, failed = 0, skipped = 0;

  for (let i = 1; i < data.length; i++) {
    const row    = data[i];
    const status = String(row[C.status] || "").trim();

    if (status === "sent") { skipped++; continue; }

    const name   = String(row[C.name]  || "").trim();
    const email  = String(row[C.email] || "").trim();
    const day1Id = String(row[C.day1]  || "").trim();
    const day2Id = String(row[C.day2]  || "").trim();

    if (!name || !email || !day1Id || !day2Id) {
      sheet.getRange(i + 1, C.status + 1).setValue("failed: missing data");
      failed++; continue;
    }

    try {
      const day1QR = getQR(qrFolder, day1Id);
      const day2QR = getQR(qrFolder, day2Id);

      const html = HtmlService.createTemplateFromFile("template");
      html.studentName = name;
      html.day1Id      = day1Id;
      html.day2Id      = day2Id;
      const body = html.evaluate().getContent();

      GmailApp.sendEmail(
        email,
        "KELI 2026 — Your Pro-Show Tickets 🎶",
        `Hi ${name}, your KELI 2026 tickets are attached. Day 1: ${day1Id} | Day 2: ${day2Id}`,
        { htmlBody: body, attachments: [day1QR, day2QR], name: "KELI 2026" }
      );

      sheet.getRange(i + 1, C.status + 1).setValue("sent");
      sheet.getRange(i + 1, C.sentAt  + 1).setValue(new Date().toISOString());
      sent++;

    } catch (e) {
      sheet.getRange(i + 1, C.status + 1).setValue("failed: " + e.message);
      Logger.log(`ROW ${i + 1} FAILED — ${email}: ${e.message}`);
      failed++;
    }

    Utilities.sleep(DELAY_MS);
  }

  Logger.log(`Done. Sent: ${sent} | Failed: ${failed} | Skipped (already sent): ${skipped}`);
}

function getQR(folder, ticketId) {
  const files = folder.getFilesByName(ticketId + ".png");
  if (!files.hasNext()) throw new Error(`QR not found in Drive: ${ticketId}.png`);
  return files.next().getBlob().setName(ticketId + ".png");
}
```

### `template.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body{margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;color:#f0f0f0}
    .wrap{max-width:600px;margin:0 auto;padding:32px 24px}
    .logo{text-align:center;padding-bottom:24px;border-bottom:1px solid #222;margin-bottom:28px}
    .logo h1{margin:0;font-size:30px;letter-spacing:6px;color:#fff}
    .logo p{margin:6px 0 0;color:#666;font-size:13px;letter-spacing:2px}
    .ticket{background:#111;border:1px solid #2a2a2a;border-radius:10px;padding:20px 24px;margin-bottom:14px}
    .ticket-day{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#a78bfa;margin-bottom:8px}
    .ticket-id{font-family:monospace;font-size:24px;font-weight:bold;letter-spacing:4px;color:#fff}
    .ticket-note{font-size:12px;color:#555;margin-top:6px}
    .warn{background:#1a0e00;border:1px solid #7c3a00;border-radius:8px;padding:12px 16px;
          margin:24px 0;font-size:13px;color:#f59e0b;line-height:1.5}
    .footer{text-align:center;margin-top:36px;font-size:12px;color:#444}
  </style>
</head>
<body>
<div class="wrap">
  <div class="logo">
    <h1>KELI 2026</h1>
    <p>GEC RIT KOTTAYAM · ARTS FEST</p>
  </div>

  <p>Hi <?= studentName ?>,</p>
  <p style="color:#aaa;font-size:14px">
    Your pro-show passes are attached as QR images.
    Show the QR code at the gate on the respective night.
  </p>

  <div class="ticket">
    <div class="ticket-day">Day 1 Pass · September 25</div>
    <div class="ticket-id"><?= day1Id ?></div>
    <div class="ticket-note">QR attached: <?= day1Id ?>.png</div>
  </div>

  <div class="ticket">
    <div class="ticket-day">Day 2 Pass · September 26</div>
    <div class="ticket-id"><?= day2Id ?></div>
    <div class="ticket-note">QR attached: <?= day2Id ?>.png</div>
  </div>

  <div class="warn">
    ⚠ Do not share these tickets or forward this email.
    Each QR is unique to you and will be invalidated after first scan.
    Duplicate or forwarded tickets will be denied at the gate.
  </div>

  <div class="footer">KELI 2026 · GEC RIT Kottayam</div>
</div>
</body>
</html>
```

### Also add two columns to your Google Sheet

Add these two column headers manually at the end:

| Column | Initial value |
|---|---|
| `mail_status` | *(empty)* |
| `mail_sent_at` | *(empty)* |

The script will fill them as it runs.

### Send Strategy

Send year by year. Never send all 1500 in one run.

| Run | Which students | ~Count | Notes |
|---|---|---|---|
| 1 | BTech Year 4 | 80–100 | Smallest — use as the test run |
| 2 | BTech Year 3 | 350–400 | Only proceed if Run 1 had zero failures |
| 3 | BTech Year 2 | 350–400 | |
| 4 | BTech Year 1 | 350–400 | |
| 5 | MCA + MTech + B.Arch | ~50–100 | Small — send last |

After each run: filter `mail_status` column for "failed" rows. Fix email addresses. Re-run — the script automatically skips `sent` rows.

**Never start sending less than 3 days before the event.** If you hit the 1500/day limit you must wait 24 hours. Build in that buffer.

**Before every run:** In App Script editor → Edit → Clear Cache. This prevents the template caching bug that caused failures in RITU.

---

## PART 7 — COMPONENT 3: SCANNER BACKEND

### Tech Stack

- **Express.js + TypeScript**
- **better-sqlite3** (synchronous SQLite — no mongod process needed)
- **jsonwebtoken** for scanner auth
- **HTTPS** via self-signed cert

### Project Setup

```bash
mkdir keli-backend && cd keli-backend
npm init -y
npm install express better-sqlite3 jsonwebtoken cors dotenv
npm install xlsx   # for import script only
npm install -D typescript ts-node nodemon \
  @types/express @types/node @types/jsonwebtoken \
  @types/better-sqlite3
npx tsc --init
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### `.env`

```
JWT_SECRET=replace_this_with_a_long_random_string_minimum_32_chars
SCANNERS=scanner1:pass1,scanner2:pass2,scanner3:pass3,admin:adminpass
```

**Never commit `.env` to git. Add it to `.gitignore` immediately.**

### `.gitignore`

```
node_modules/
dist/
.env
server.key
server.cert
keli.db
keli_backup.db
app/
```

### HTTPS Certificate

```bash
openssl req -nodes -new -x509 -keyout server.key -out server.cert -days 365
```

Hit Enter through all prompts. Place `server.key` and `server.cert` in the project root.

---

### `src/db.ts` — Database Setup

```typescript
import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(__dirname, "../keli.db"));

// WAL mode: allows concurrent reads while writing — critical for multiple scanners
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

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
```

---

### `src/auth.ts` — Scanner Auth

```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function loadCredentials(): Record<string, string> {
  const raw = process.env.SCANNERS || "";
  return Object.fromEntries(
    raw.split(",").map(entry => {
      const [user, pass] = entry.split(":");
      return [user.trim(), pass.trim()];
    })
  );
}

const CREDENTIALS = loadCredentials();
const SECRET      = process.env.JWT_SECRET!;

export function login(req: Request, res: Response): void {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password || CREDENTIALS[username] !== password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = jwt.sign({ username }, SECRET, { expiresIn: "24h" });
  res.json({ token, username });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }
  try {
    const token   = header.split(" ")[1];
    const payload = jwt.verify(token, SECRET) as { username: string };
    (req as any).username = payload.username;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
}
```

---

### `src/routes/tickets.ts` — All Ticket Routes

```typescript
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

router.get("/ping", requireAuth, (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

export default router;
```

---

### `src/index.ts` — Server Entry Point

```typescript
import express    from "express";
import https      from "https";
import fs         from "fs";
import path       from "path";
import cors       from "cors";
import dotenv     from "dotenv";
import ticketRoutes from "./routes/tickets";
import { login }  from "./auth";

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("[FATAL] JWT_SECRET not set in .env");
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

const frontendPath = path.join(__dirname, "../app");
if (fs.existsSync(frontendPath)) app.use(express.static(frontendPath));

app.post("/api/auth/login", login);
app.use("/api/tickets", ticketRoutes);

app.get("*", (_req, res) => {
  const index = path.join(frontendPath, "index.html");
  fs.existsSync(index)
    ? res.sendFile(index)
    : res.status(404).send("Frontend not built. Run: cd ../keli-frontend && npm run build");
});

const httpsOptions = {
  key:  fs.readFileSync(path.join(__dirname, "../server.key")),
  cert: fs.readFileSync(path.join(__dirname, "../server.cert")),
};

https.createServer(httpsOptions, app).listen(3000, "0.0.0.0", () => {
  console.log("KELI Scanner running at https://0.0.0.0:3000");
  console.log("Connect scanner devices to the same WiFi hotspot.");
});
```

---

### `scripts/import.ts` — Load Excel into SQLite

**Run this before the event, after processed.xlsx is ready.**

```typescript
import Database from "better-sqlite3";
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

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

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

const insertMany = db.transaction((rows: any[]) => {
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
    try { insert.run(name, email, dept, year, program, group, day1, day2); ok++; }
    catch (e: any) { console.log(`  [ERROR] ${name}: ${e.message}`); skipped++; }
  }
  return { ok, skipped };
});

const { ok, skipped } = insertMany(rows);
const count = (db.prepare("SELECT COUNT(*) as c FROM tickets").get() as any).c;
console.log(`\n✓ Import complete · Inserted: ${ok} · Skipped: ${skipped} · Total in DB: ${count}`);
db.close();
```

Run: `npx ts-node scripts/import.ts ../../python/output/processed.xlsx`
Force overwrite: append `--force`

### `package.json` scripts block

```json
{
  "scripts": {
    "dev":    "nodemon --exec ts-node src/index.ts",
    "build":  "tsc",
    "start":  "node dist/index.js",
    "import": "ts-node scripts/import.ts"
  }
}
```

---

## PART 8 — COMPONENT 4: SCANNER FRONTEND

### Project Setup

```bash
npm create vite@latest keli-frontend -- --template react-ts
cd keli-frontend
npm install html5-qrcode axios react-router-dom
npm install tailwindcss @tailwindcss/vite
```

### `vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react            from "@vitejs/plugin-react";
import tailwindcss      from "@tailwindcss/vite";
import * as fs          from "node:fs";
import * as path        from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    https: {
      key:  fs.readFileSync(path.resolve(__dirname, "../keli-backend/server.key")),
      cert: fs.readFileSync(path.resolve(__dirname, "../keli-backend/server.cert")),
    },
    proxy: {
      "/api": {
        target:       "https://localhost:3000",
        secure:       false,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir:     "../keli-backend/app",
    emptyOutDir: true,
    minify:     true,
  },
});
```

### `src/api.ts` — All API Calls in One Place

```typescript
import axios from "axios";

const BASE = "/api";

function authHeader() {
  const token = localStorage.getItem("keli_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  login: (username: string, password: string) =>
    axios.post(`${BASE}/auth/login`, { username, password }),

  // Single call — verify + scan in one round trip, eliminates extra network lag
  scanAndVerify: (ticketId: string, day: number) =>
    axios.post(`${BASE}/tickets/scan-and-verify`, { ticketId, day }, { headers: authHeader() }),

  stats: () =>
    axios.get(`${BASE}/tickets/stats`, { headers: authHeader() }),

  search: (q: string) =>
    axios.get(`${BASE}/tickets?q=${encodeURIComponent(q)}`, { headers: authHeader() }),

  override: (id: number, data: object) =>
    axios.patch(`${BASE}/tickets/${id}`, data, { headers: authHeader() }),

  ping: () =>
    axios.get(`${BASE}/tickets/ping`, { headers: authHeader() }),
};
```

### `src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login   from "./pages/Login";
import Scanner from "./pages/Scanner";
import Admin   from "./pages/Admin";

function isLoggedIn() {
  return !!localStorage.getItem("keli_token");
}

function ProtectedRoute({ element }: { element: JSX.Element }) {
  return isLoggedIn() ? element : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"   element={<Login />} />
        <Route path="/scan"    element={<ProtectedRoute element={<Scanner />} />} />
        <Route path="/admin"   element={<ProtectedRoute element={<Admin />} />} />
        <Route path="*"        element={<Navigate to={isLoggedIn() ? "/scan" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### `src/pages/Login.tsx`

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  async function handleLogin() {
    if (!username || !password) { setError("Enter username and password"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.login(username, password);
      localStorage.setItem("keli_token",    res.data.token);
      localStorage.setItem("keli_username", res.data.username);
      navigate(username === "admin" ? "/admin" : "/scan");
    } catch {
      setError("Invalid credentials. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white text-center tracking-widest mb-2">KELI</h1>
        <p className="text-gray-500 text-center text-sm mb-8 tracking-wider">SCANNER LOGIN</p>
        <div className="space-y-3">
          <input
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
            placeholder="Username" value={username} autoCapitalize="none"
            onChange={e => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
            placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            onClick={handleLogin} disabled={loading}
            className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### `src/pages/Scanner.tsx`

```tsx
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
    return () => stopCamera();
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
```

### `src/pages/Admin.tsx`

```tsx
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
```

### Build and Deploy Frontend

```bash
cd keli-frontend
npm run build
# Outputs to ../keli-backend/app/
# Backend now serves the frontend from GET /
```

---

## PART 9 — LAN NETWORK SETUP

### On the Laptop (Event Day)

```bash
# 1. Enable hotspot
#    Windows: Settings → Mobile Hotspot → On
#    SSID: keli-scan | Password: keli2026
#
# 2. Find your LAN IP
#    Windows: ipconfig  →  "IPv4 Address" under the hotspot adapter
#    Linux:   ip a       →  inet under wlan0 or ap0
#    Typical: 192.168.137.1 (Windows) or 192.168.x.x (Linux)
#
# 3. Start backend
cd keli-backend && npm run dev
#
# 4. Backend is now at: https://192.168.137.1:3000
```

### On Each Scanner Phone

1. Connect to WiFi `keli-scan`
2. Open browser → `https://192.168.137.1:3000`
3. Tap **Advanced → Proceed** on the cert warning (one-time per device)
4. Login and select day

### Print this QR and stick it on the scanning station

```python
import qrcode
qrcode.make("https://192.168.137.1:3000").save("scanner-access-qr.png")
```

Volunteers scan this QR with Google Lens to open the app — no typing the URL.

---

## PART 10 — SECURITY CONSIDERATIONS

| Risk | Mitigation |
|---|---|
| Student shares ticket screenshot | QR is unique and invalidated after first scan. Second scan returns `already_scanned`. |
| Student forwards email to friend | Same — system catches duplicate at gate. |
| Brute-force ticket ID guessing | Requires being on the LAN network (physical presence). Not a realistic attack vector. |
| Scanner credentials exposed | Keep `.env` out of git. Use separate credential per scanner. |
| JWT token stolen off a scanner phone | Tokens expire in 24h. Each token is tied to a username — auditable. |
| Admin password weak | Use 12+ chars. Don't share with general volunteers. |
| DB corruption | SQLite WAL mode is highly resilient. Run `cp keli.db keli_backup.db` before event. |
| `.env` committed to git | Add to `.gitignore` before first commit. Check with `git status` before every push. |

---

## PART 11 — FAILURE MODES AND RECOVERY

Every item here has a recovery plan. Print these steps and keep them at the scanning station.

| Failure | Probability | Recovery |
|---|---|---|
| **Scanner phone battery dies** | High | Have 2 backup devices pre-configured, connected, and charged. Hand over immediately. |
| **Scanner phone loses WiFi** | Medium | Reconnect to `keli-scan`. Refresh browser. No re-login needed (token lasts 24h). |
| **QR code on screen hard to scan** | Medium | Student types ticket ID manually using the text field. 8 chars, easy to read aloud. |
| **Backend process crashes** | Low | `npm run dev` in backend terminal. DB is intact. Back up in under 30 seconds. |
| **Laptop overheats / slow** | Low | Keep laptop plugged in, lid open. Close all non-essential apps before event. |
| **Laptop battery dies** | Low | Must be plugged in. Bring an extension cord. Non-negotiable. |
| **Hotspot adapter fails** | Very Low | USB tether the laptop to one phone, use that phone's hotspot. Test USB tethering before the event. |
| **Student not in the DB** | Expected | Escalation protocol: student goes to a designated organiser with email proof. Scanner volunteers do NOT make this call. |
| **Email bounced — student never got ticket** | Expected | Check `mail_status` column in Sheets. Resend to corrected email. At event: search DB by name in Admin panel. |
| **All technology fails** | Possible | Use the printed ticket ID list. Student quotes name → find in list → strike off. |
| **Disk full on laptop** | Not possible | SQLite DB with 1500 records is under 2MB. |
| **Gmail daily limit hit mid-send** | Possible if you start late | Wait 24h and resend. Prevention: start sending 3+ days before event. |
| **QR not found in Drive during mailing** | Possible if folder name wrong | Verify folder is named `keli-qr-codes` exactly. Check all QR files are uploaded. |
| **App Script cache bug (old template used)** | Known issue from RITU | Before each mailing run: Edit → Clear Cache in App Script editor. |

---

## PART 12 — EDGE CASES (EXHAUSTIVE)

### Excel/Python Stage

| Edge Case | Handling |
|---|---|
| Two students with same email | Allowed — each gets unique ticket IDs regardless. |
| Email address has a typo | `validate_emails()` flags bad formats. Fix in input file, re-run. |
| Sheet name doesn't match any config entry | Script prints warning and skips. Run `check_sheets.py` first. |
| Year 4 CSE sheet accidentally named "CSE-A" | Matches group A instead of C. Confirm with college — Year 4 CSE should be a single-batch sheet. |
| B.Arch year 5 not in any file | Create `year5.xlsx` with a single "B.Arch" sheet. |
| PG students in BTech year files | Already handled — script detects MCA/MTech from sheet name. |
| Empty rows in the middle of a sheet | `dropna(subset=["Name","Email"])` removes them. |
| Header row duplicated partway through sheet | `df[df["Name"].str.lower() != "name"]` removes it. |
| Counter exceeds 999 in a group | Script exits with `[ERROR]`. Won't happen in practice — split dept into two groups if needed. |

### Email Stage

| Edge Case | Handling |
|---|---|
| Gmail marks ticket as spam | Unlikely with Workspace account. Ask students to check spam if not received. |
| QR PNG not in Drive | Script throws error, row marked `failed`. Re-upload missing QR, re-run. |
| Student says they got the email but can't open QR | Attachment is a plain PNG. Ask them to download the attachment, not view inline. |
| Student deleted the email | Admin panel: search by name → get ticket ID → manual gate check. |

### Scanning Stage — Including Lag

| Edge Case | Handling |
|---|---|
| Two scanners scan same QR simultaneously | Atomic SQLite UPDATE — only one succeeds. The other gets `already_scanned`. |
| Scanner shows `invalid` for a valid ticket | Likely wrong day selected. Ask which night's ticket they're showing — switch day and re-scan. |
| Student shows Day 2 ticket on Day 1 night | Returns `invalid` — Day 2 ticket ID is not in the `day1` column. Correct response. |
| Student scanned in but exits and tries to re-enter | Returns `already_scanned`. Only admin can reset. Escalate. |
| QR code is damaged or unreadable | Volunteer types 8-char ticket ID in manual entry field. |
| Student's phone screen brightness too low | Ask them to increase brightness. |
| Camera permission denied on scanner phone | Browser settings → allow camera → refresh page. |
| Scan response feels slow | The single `scan-and-verify` call over LAN should respond in under 200ms. If slow, the phone likely dropped off the hotspot — reconnect. Use 5GHz hotspot band if your laptop supports it. |
| Camera detection feels slow | `fps: 15` and `qrbox: 220×220` are already tuned for speed. Ensure the QR code fills most of the box — don't hold the phone too far away. |
| Admin panel search returns no results | Try searching by ticket ID (e.g. `KB1A001`) or partial email instead of full name. |
| Backend unreachable warning appears on scanner | Phone dropped off the hotspot. Reconnect to `keli-scan`, refresh the page. |

---

## PART 13 — COMPLETE FOLDER STRUCTURE

```
keli-ticketing/
│
├── python/
│   ├── check_sheets.py              ← Run first on actual files
│   ├── process_students.py          ← Main pipeline
│   ├── requirements.txt             ← pandas qrcode[pil] openpyxl
│   ├── input/
│   │   ├── year1.xlsx
│   │   ├── year2.xlsx
│   │   ├── year3.xlsx
│   │   ├── year4.xlsx
│   │   └── year5.xlsx               ← Only if B.Arch has 5th year
│   └── output/
│       ├── processed.xlsx
│       └── qr/
│           ├── KB1A1001.png
│           └── ...
│
├── appscript/
│   ├── mailer.gs
│   └── template.html
│
├── keli-backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── db.ts
│   │   ├── auth.ts
│   │   └── routes/
│   │       └── tickets.ts
│   ├── scripts/
│   │   └── import.ts
│   ├── app/                         ← Auto-generated by frontend build
│   ├── keli.db                      ← Generated at runtime
│   ├── keli_backup.db               ← Copy before event
│   ├── server.key                   ← .gitignore this
│   ├── server.cert                  ← .gitignore this
│   ├── .env                         ← .gitignore this
│   ├── .gitignore
│   ├── package.json
│   └── tsconfig.json
│
└── keli-frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── api.ts
    │   └── pages/
    │       ├── Login.tsx
    │       ├── Scanner.tsx
    │       └── Admin.tsx
    ├── vite.config.ts
    ├── package.json
    └── index.html
```

---

## PART 14 — TECH STACK

| Component | Technology | Reason |
|---|---|---|
| Data pipeline | Python 3 · pandas · qrcode[pil] · openpyxl | No rate limits · Local · Free |
| QR generation | Python `qrcode` library | Zero cost · No API calls · No rate limits |
| Email | Google App Script · GmailApp | Workspace 1500/day limit · Free |
| QR delivery to mailer | Google Drive folder | Reliable · Free · No rate limits |
| Scanner database | **SQLite (better-sqlite3)** | No daemon · Single file · Atomic writes · Right tool for this scale |
| Scanner backend | Express.js · TypeScript | Familiar · Fast setup |
| Scanner frontend | React · Vite · TailwindCSS | Fast to build |
| QR scanning in browser | html5-qrcode | Works on all mobile browsers |
| Network | Laptop hotspot · LAN only | Offline · Fast · No cellular dependency |
| HTTPS | Self-signed openssl cert | Required for camera API in browser |

---

## PART 15 — REMAINING TIMELINE (Event: Sept 24–26)

| Day | Date | Tasks |
|---|---|---|
| **Today** | Sep 20 | Finalise team · assign roles · create repo · run check_sheets.py on sample Excel |
| **Day 2** | Sep 21 | Python pipeline working on dummy data · Backend SQLite setup + import script |
| **Day 3** | Sep 22 | Backend routes + auth + HTTPS · Frontend login + scanner page |
| **Day 4** | Sep 23 | Frontend admin page · Full LAN test with phones · Student list must be final · Run pipeline on real data · Upload QRs to Drive · Import to DB · Send emails: Year 4 → Year 3 |
| **Day 5** | Sep 24 | **Event Day 1** (no tickets) · Send remaining emails (Year 2 → Year 1 → PG/Arch) early morning · Fix failures · Final LAN test · Backup DB · Print fallback list |
| **Day 6** | Sep 25 | **Pro-show Day 1** · Scanner live · Day 1 tickets |
| **Day 7** | Sep 26 | **Pro-show Day 2** · Scanner live · Day 2 tickets |

> **You are extremely tight on time.** Every task listed for Sept 23 must be done that day — there is no buffer. Prioritise in this order if things slip: (1) get emails sent, (2) get scanner working on LAN, (3) everything else.

---

## PART 16 — EVENT DAY RUNBOOK

Print this. Keep one copy at the scanning station.

```
╔═══════════════════════════════════════════════════════╗
║           KELI 2026 — GATE SCANNER RUNBOOK            ║
╚═══════════════════════════════════════════════════════╝

  BEFORE GATES OPEN (45 mins prior)
  ─────────────────────────────────
  □ Plug laptop into power outlet. Confirm power LED is on.
  □ Disable laptop sleep: Settings → Power → Sleep → Never
  □ Open terminal: cd keli-backend && npm run dev
  □ Confirm: "KELI Scanner running at https://..."
  □ Open laptop browser → https://localhost:3000 → accept cert
  □ Enable hotspot: SSID=keli-scan Password=keli2026
  □ Connect all scanner phones to keli-scan
  □ On each phone: open https://192.168.137.1:3000
    → Tap Advanced → Proceed (cert warning, one-time only)
  □ Login each phone with its scanner credential
    Phone 1: scanner1 / pass1
    Phone 2: scanner2 / pass2
    Phone 3: scanner3 / pass3
  □ Select the correct day on each phone
  □ Scan 3 test tickets — confirm green results appear
  □ Open Admin on laptop: login as admin, confirm stats show 0 scanned
  □ Backup DB: cp keli.db keli_backup.db

  SIGNAL TO OPEN GATES: All phones show scanner screen, no errors.

  ─────────────────────────────────
  AT THE GATE
  ─────────────────────────────────
  GREEN (VALID):      Let the student in. Done.
  ORANGE (USED):      Do NOT let in. Note scanner name + time.
                      Escalate to organiser. Do not argue at gate.
  RED (INVALID):      Ask student to show original email.
                      Do NOT let in based on screenshot only.
                      Escalate if student insists.

  ─────────────────────────────────
  IF PHONE DROPS OFF NETWORK
  ─────────────────────────────────
  1. Re-connect to keli-scan
  2. Refresh browser tab
  3. No re-login needed (token lasts 24h)
  4. Confirm day is still selected

  ─────────────────────────────────
  IF BACKEND CRASHES
  ─────────────────────────────────
  1. Press Ctrl+C in terminal
  2. Run: npm run dev
  3. Wait for "KELI Scanner running" message
  4. All data is safe — SQLite does not lose data on crash
  5. Scanner phones resume on next scan attempt

  ─────────────────────────────────
  TOTAL TECHNOLOGY FAILURE
  ─────────────────────────────────
  1. Get the printed ticket ID list
  2. Student quotes name → find in list → cross off
  3. Note the time technology went down for later audit

  ─────────────────────────────────
  AFTER ALL STUDENTS HAVE ENTERED
  ─────────────────────────────────
  □ Open Admin panel → screenshot final stats
  □ Backup DB: cp keli.db keli_backup_post_day1.db (or day2)
  □ Stop backend: Ctrl+C
  □ Turn off hotspot
```

---

## PART 17 — POST-EVENT

After both pro-shows are done:

1. Export final scan data: `sqlite3 keli.db ".mode csv" ".output export.csv" "SELECT * FROM tickets;"`
2. Keep the DB backup — useful if anyone disputes entry records
3. Share the repo link with next year's team with notes on what sheet names you actually received and any last-minute config changes

---

*Final · CSE-A/CSE-B batches · RIT Kottayam departments (ECE, EEE, ME, Civil, RAI) · Single scan-and-verify endpoint · SQLite · Sept 24–26 event dates*
