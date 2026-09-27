# KELI 2026 — Event Ticketing & Gate-Scanning System

> **Event:** Keli Arts Fest 2026 · GEC RIT Kottayam
> **Pro-Show Nights:** September 25 (Day 1) & September 26 (Day 2)
> **Scale:** ~1,500 students · Zero external infrastructure · Fully offline on event day

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Ticket ID Format Specification](#3-ticket-id-format-specification)
4. [Repository Structure](#4-repository-structure)
5. [Component 1 — Python Data Pipeline](#5-component-1--python-data-pipeline)
6. [Component 2 — Google App Script Email System](#6-component-2--google-app-script-email-system)
7. [Component 3 — Express + SQLite Backend](#7-component-3--express--sqlite-backend)
8. [Component 4 — React Frontend (Scanner & Admin UI)](#8-component-4--react-frontend-scanner--admin-ui)
9. [Database Schema](#9-database-schema)
10. [REST API Reference](#10-rest-api-reference)
11. [Authentication & Session Model](#11-authentication--session-model)
12. [Environment Configuration](#12-environment-configuration)
13. [Setup & Deployment Guide](#13-setup--deployment-guide)
14. [Event Day Runbook](#14-event-day-runbook)
15. [Security Considerations](#15-security-considerations)
16. [Technology Decisions & Trade-offs](#16-technology-decisions--trade-offs)

---

## 1. System Overview

KELI 2026 is a fully self-contained, offline-capable event ticketing system built for the GEC RIT Kottayam annual Arts Fest. The system covers the complete lifecycle of ticket management:

| Stage | What Happens |
|---|---|
| **Pre-Event (Data Pipeline)** | Excel student lists from the college union are processed by a Python script that assigns unique 8-character ticket IDs and generates QR code PNGs for every student |
| **Pre-Event (Email Delivery)** | A Google App Script mailer reads the processed data from Google Sheets, fetches QR PNGs from Google Drive, and sends personalised HTML emails with QR attachments to each student |
| **Pre-Event (DB Import)** | The processed data is imported into a local SQLite database on the event laptop |
| **Event Day (Gate Scanning)** | The laptop runs a Node.js/Express HTTPS server over a local WiFi hotspot. 3-4 phones connect via browser and use their cameras to scan QR codes in real-time |
| **Event Day (Admin Monitor)** | An admin panel provides live entry statistics broken down by program and day, plus manual ticket lookup and scan-override capability |

**Design constraints that shaped every decision:**

- **Zero budget** - no cloud services, no paid APIs
- **Zero internet dependency on event day** - the system must work 100% offline
- **Zero install on scanner devices** - phones use a browser; no app download
- **~1,500 concurrent users** - manageable for SQLite on a single laptop
- **4 simultaneous scanner phones** - must handle concurrent scans without double-entry

---

## 2. Architecture

### 2.1 End-to-End Data Flow

```
 PRE-EVENT PHASE
 ===============

 [Union Office]
 year1.xlsx, year2.xlsx ... year5.xlsx
        |
        v
 [Python Pipeline  /python/]
 |-- check_sheets.py  -- validates sheet tab names
 +-- process_students.py
     |-- Reads all year files
     |-- Maps sheet names to (Program, Group) codes
     |-- Assigns deterministic 8-char Ticket IDs
     |-- Generates QR PNG per ticket ID (qrcode[pil])
     |-- Validates email format (regex)
     +-- Outputs:
         |-- output/processed.xlsx  (master data + ticket IDs)
         +-- output/qr/*.png        (~3000 QR images)

        |--[Manual Upload]--> Google Drive "keli-qr-codes/"
        +--[Manual Import]--> Google Sheets "students" tab
                                     |
                                     v
                         [App Script Mailer  /appscript/]
                         |-- Reads students sheet row-by-row
                         |-- Fetches QR PNGs from Drive by ID
                         |-- Renders HTML email template
                         |-- Sends via GmailApp (300ms throttle)
                         +-- Writes sent/failed status to sheet

        [npm run import] --> keli-backend/keli.db (SQLite)
          reads output/processed.xlsx, bulk-inserts rows

 EVENT DAY PHASE
 ===============

 [Laptop - WiFi Hotspot Host]
 +-- keli-backend  (Express + TypeScript)
     |-- Serves frontend SPA from /app/ (static files)
     |-- HTTPS on port 3000 (self-signed cert)
     |-- JWT-based authentication (24h expiry)
     |-- Single-device session enforcement per scanner account
     |-- SQLite (WAL mode) via better-sqlite3
     +-- Structured colour-coded console logging

     API Endpoints:
     POST /api/auth/login
     POST /api/auth/logout
     POST /api/tickets/scan-and-verify   <- atomic scan
     GET  /api/tickets/stats             <- live dashboard
     GET  /api/tickets?q=...             <- search
     PATCH /api/tickets/:id              <- admin override
     GET  /api/tickets/ping              <- liveness probe

                      | HTTPS . LAN (192.168.x.x:3000)
           +----------+-----------+
           v          v           v
      [Phone 1]  [Phone 2]  [Phone 3-4]
      /scan       /scan       /scan
      (React SPA - html5-qrcode - camera scan)

      [Admin Laptop/Phone]
      /admin  (live stats, search, override)
```

### 2.2 Component Interaction Diagram

```
+---------------+         +------------------+         +-----------------+
|  Python       |         |  Google Workspace |         |  keli-backend   |
|  Pipeline     |--xlsx-->|  Sheets + Drive  |         |  (Express)      |
+------+--------+         +--------+---------+         +--------+--------+
       |                           |                            |
       | output/processed.xlsx     | App Script sends emails    | serves
       |                           | via GmailApp               | /api/*
       v                           v                            |
+---------------+         +------------------+         +--------+--------+
| scripts/      |         |  Student Inboxes  |         |  keli-frontend  |
| import.ts     |         |  (QR PNGs in      |         |  (React SPA)    |
|               |         |   attachment)     |         |                 |
| (ts-node)     |--bulk-->|                  |         |  /login         |
+---------------+  insert +------------------+         |  /scan          |
       |                                               |  /admin         |
       v                                               +--------+--------+
+--------------+                                                |
|  keli.db     |<------------------- REST API -----------------+
|  (SQLite)    |          scan-and-verify (atomic UPDATE)
|  WAL Mode    |          stats, search, override
+--------------+
```

### 2.3 Atomic Scan Verification Flow

```
Scanner Phone                  Express Backend               SQLite (WAL)
     |                                 |                          |
     | POST /api/tickets/scan-         |                          |
     | and-verify {ticketId, day}      |                          |
     |-------------------------------->|                          |
     |                                 | SELECT * FROM tickets    |
     |                                 | WHERE day1 = ?           |
     |                                 |------------------------->|
     |                                 |<-------------------------|
     |                                 |                          |
     |                      [NOT FOUND?]                          |
     |<----------- { status: "invalid" }                          |
     |                                 |                          |
     |                   [ALREADY SCANNED?]                       |
     |<-- { status: "already_scanned", name,                      |
     |      scanned_at, scanned_by }                              |
     |                                 |                          |
     |                   [VALID - attempt atomic mark]            |
     |                                 | UPDATE tickets           |
     |                                 | SET day1_scanned=1,      |
     |                                 |     day1_scanned_at=now()|
     |                                 |     day1_scanned_by=user |
     |                                 | WHERE day1=?             |
     |                                 | AND day1_scanned=0       | <- race guard
     |                                 |------------------------->|
     |                                 |<-- changes = 0 or 1 ----|
     |                                 |                          |
     |         [changes=0: race lost]  |                          |
     |<-- { status: "already_scanned" }|                          |
     |                                 |                          |
     |         [changes=1: success]    |                          |
     |<-- { status: "success",         |                          |
     |      name, dept, year, program }|                          |
```

---

## 3. Ticket ID Format Specification

Every student receives **two** unique ticket IDs - one per pro-show night. Each ID is exactly **8 uppercase alphanumeric characters**.

### 3.1 Structure

```
 K  [P]  [Y]  [G]  [D]  [N][N][N]
 |   |    |    |    |    +-------- 001-999  sequential counter per (P,Y,G,D)
 |   |    |    |    +------------ 1 or 2   pro-show day number
 |   |    |    +----------------- Group    department/batch code
 |   |    +---------------------- 1-5      year of study in the program
 |   +--------------------------- Program  B / M / T / A
 +------------------------------- K        fixed prefix (Keli)
```

### 3.2 Program Codes

| Code | Program | Valid Years |
|------|---------|-------------|
| `B`  | BTech   | 1-4         |
| `M`  | MCA     | 1-2         |
| `T`  | MTech   | 1-2         |
| `A`  | B.Arch  | 1-5         |

### 3.3 Group Codes

| Code | Maps To | Applicable Dept | Notes |
|------|---------|-----------------|-------|
| `A`  | CSE Batch A | BTech CSE | Years 1, 2, 3 only |
| `B`  | CSE Batch B | BTech CSE | Years 1, 2, 3 only |
| `C`  | CSE (unified) | BTech CSE | Year 4 - no A/B split |
| `E`  | ECE | BTech Electronics & Communication | |
| `M`  | ME  | BTech Mechanical Engineering | |
| `V`  | Civil | BTech Civil Engineering | |
| `L`  | EEE | BTech Electrical & Electronics | |
| `R`  | RAI | BTech Robotics & Artificial Intelligence | |
| `0`  | No group | MCA, MTech, B.Arch | No batch divisions |

### 3.4 Counter Logic

The `NNN` (001-999) counter resets per unique `(Program, Year, Group, Day)` tuple - not globally across all students. Each department-year combination has its own independent counter, so no single counter ever exceeds ~120 even at maximum dept size.

### 3.5 Decoded Examples

| Ticket ID | Decoded |
|-----------|---------|
| `KB1A1001` | BTech, Year 1, CSE-A, Day 1, Student 001 |
| `KB1B2047` | BTech, Year 1, CSE-B, Day 2, Student 047 |
| `KB4C1120` | BTech, Year 4, CSE (unified), Day 1, Student 120 |
| `KB2E2001` | BTech, Year 2, ECE, Day 2, Student 001 |
| `KB3R1010` | BTech, Year 3, RAI, Day 1, Student 010 |
| `KM101001` | MCA, Year 1, No group, Day 1, Student 001 |
| `KT201001` | MTech, Year 2, No group, Day 1, Student 001 |
| `KA301001` | B.Arch, Year 3, No group, Day 1, Student 001 |

### 3.6 QR Code Properties

Each ticket ID encodes to a QR Version 1 (21x21 matrix) - the simplest QR format. 8-character uppercase alphanumeric input triggers alphanumeric mode in the QR encoder, yielding maximum scan speed. Any phone camera manufactured after 2015 decodes it in under 500ms.

---

## 4. Repository Structure

```
Keli26/
|
|-- .gitignore                    <- root gitignore (covers all components)
|-- README.md                     <- this file
|
|-- python/                       <- Data pipeline (runs once before event)
|   |-- check_sheets.py           <- Pre-flight sheet name validator
|   |-- process_students.py       <- Main ETL: Excel -> ticket IDs + QR PNGs
|   |-- gen_access_qr.py          <- Utility: generate ad-hoc QR for a given ID
|   |-- requirements.txt          <- pip dependencies
|   |-- input/                    <- Drop year1.xlsx ... year5.xlsx here
|   |   +-- .gitkeep
|   +-- output/                   <- Generated by process_students.py
|       |-- processed.xlsx        <- Master data (gitignored)
|       |-- db_import.csv         <- CSV variant for import (gitignored)
|       |-- qr/*.png              <- One PNG per ticket ID (gitignored)
|       +-- .gitkeep
|
|-- appscript/                    <- Google App Script email sender
|   |-- mailer.gs                 <- Main script: reads Sheets, sends Gmail
|   +-- template.html             <- HTML email template (Scriptlet syntax)
|
|-- keli-backend/                 <- Express + TypeScript API server
|   |-- package.json
|   |-- tsconfig.json
|   |-- .env                      <- JWT secret + scanner credentials (gitignored)
|   |-- .gitignore
|   |-- server.key                <- TLS private key (gitignored)
|   |-- server.cert               <- TLS certificate (gitignored)
|   |-- gen-cert.js               <- Self-signed cert generator (Node)
|   |-- keli.db                   <- SQLite database (gitignored)
|   |-- src/
|   |   |-- index.ts              <- Entry point: HTTPS server, middleware, routing
|   |   |-- db.ts                 <- SQLite setup, schema, WAL pragma
|   |   |-- auth.ts               <- JWT login/logout, session enforcement
|   |   |-- logger.ts             <- Colour-coded structured console logger
|   |   |-- types.d.ts            <- Shared TypeScript type declarations
|   |   +-- routes/
|   |       +-- tickets.ts        <- All /api/tickets/* route handlers
|   +-- scripts/
|       +-- import.ts             <- Bulk-import processed.xlsx -> keli.db
|
+-- keli-frontend/                <- React 18 + Vite + TailwindCSS SPA
    |-- package.json
    |-- tsconfig.json
    |-- vite.config.ts
    |-- index.html
    +-- src/
        |-- main.tsx              <- React DOM entry
        |-- App.tsx               <- Router + route protection
        |-- index.css             <- Global styles
        |-- api.ts                <- Axios API client with interceptors
        |-- pages/
        |   |-- Login.tsx         <- Credential form -> JWT storage
        |   |-- Scanner.tsx       <- Camera QR scanning + manual fallback
        |   +-- Admin.tsx         <- Live stats dashboard + search + override
        |-- components/
        |   |-- ErrorBoundary.tsx <- React error boundary wrapper
        |   +-- RouteLogger.tsx   <- Client-side navigation logger
        +-- utils/
            |-- storage.ts        <- Safe localStorage wrapper
            +-- logger.ts         <- Colour-coded browser console logger
```

---

## 5. Component 1 - Python Data Pipeline

The Python pipeline is a one-time pre-event data processing step. It transforms raw Excel student lists into a structured dataset with unique ticket IDs, QR code PNGs, and a normalised XLSX ready for database import.

### 5.1 Dependencies

```bash
pip install pandas qrcode[pil] openpyxl
# Or use requirements.txt:
pip install -r python/requirements.txt
```

### 5.2 Input Format

Place Excel files in `python/input/` with these exact filenames:

| Filename | Contains |
|----------|---------|
| `year1.xlsx` | All Year 1 students across all programs |
| `year2.xlsx` | All Year 2 students |
| `year3.xlsx` | Year 3 students (BTech, B.Arch) |
| `year4.xlsx` | Year 4 students (BTech, B.Arch) |
| `year5.xlsx` | Year 5 B.Arch only (if applicable) |

Each file contains multiple **sheet tabs**, one per department. The script reads the tab name to infer program and group codes via case-insensitive substring matching:

| Sheet Tab Pattern | Detected As |
|-------------------|-------------|
| `CSE-A`, `CSEA`, `CSE A`, `Batch A` | BTech, Group A |
| `CSE-B`, `CSEB`, `CSE B`, `Batch B` | BTech, Group B |
| `CSE`, `CS` *(year4 only)*           | BTech, Group C |
| `ECE`, `Electronics`                 | BTech, Group E |
| `EEE`, `Electrical`                  | BTech, Group L |
| `Mechanical`, `Mech`, `ME`           | BTech, Group M |
| `Civil`                              | BTech, Group V |
| `Robotics`, `RAI`                    | BTech, Group R |
| `MCA`                                | MCA, Group 0   |
| `MTech`, `M.Tech`                    | MTech, Group 0 |
| `BArch`, `Arch`, `Architecture`      | B.Arch, Group 0 |

Each sheet must have at minimum:
- A column named `Name` (or any case variant)
- A column named `Email` or `Mail id` (any column whose name contains "mail" or "email")

### 5.3 Step 1 - Validate Sheet Names

Always run this first on your actual Excel files before the main script:

```bash
cd python
python check_sheets.py
```

The script prints every sheet name found across all year files. Verify each one matches a pattern in `SHEET_TO_PG` inside `process_students.py`. Unmatched sheets are skipped with a warning during the main run.

### 5.4 Step 2 - Run Main Pipeline

```bash
cd python
python process_students.py
```

**Processing steps, in order:**

1. Iterates `year1.xlsx` through `year5.xlsx`
2. For each sheet: resolves program/group codes, normalises column names, drops empty/header rows
3. Validates email addresses against a regex - reports bad emails but continues
4. Assigns ticket IDs using per-`(program, year, group, day)` counters - deterministic and reproducible
5. Generates `output/qr/{ticketId}.png` for every ticket (skips existing files for idempotency)
6. Performs a global duplicate ticket ID check before writing output - exits on collision
7. Writes `output/processed.xlsx`

**Output columns:**

| Column | Description |
|--------|-------------|
| `Name` | Student full name |
| `Email` | Student email address |
| `Dept` | Raw sheet tab name |
| `Program` | B / M / T / A |
| `Year` | 1-5 |
| `Group` | A / B / C / E / M / V / L / R / 0 |
| `day1` | Ticket ID for Night 1 |
| `day1_scanned` | false (initial) |
| `day1_scanned_at` | empty |
| `day1_scanned_by` | empty |
| `day2` | Ticket ID for Night 2 |
| `day2_scanned` | false (initial) |
| `day2_scanned_at` | empty |
| `day2_scanned_by` | empty |

### 5.5 Error Conditions

| Condition | Script Behaviour |
|-----------|------------------|
| Year file not found | `[SKIP]` warning, continues |
| Sheet name has no match | `[SKIP]` warning, collected at end |
| Sheet has no Name/Email columns | `[SKIP]` warning |
| Bad email format | Warning printed, row is kept |
| Counter exceeds 999 | `[FATAL]` - exits with instructions |
| Duplicate ticket ID found | `[FATAL]` - exits; should never happen under normal input |

---

## 6. Component 2 - Google App Script Email System

The email system is a Google Apps Script that runs inside the Google Workspace account associated with the college. It sends personalised HTML emails to each student with their two QR code PNGs attached.

### 6.1 Setup

1. Import `output/processed.xlsx` into Google Sheets. Name the sheet tab exactly `students`.
2. Add two empty columns at the end: `mail_status` and `mail_sent_at`.
3. Go to **Extensions -> Apps Script**.
4. Create two files: `mailer.gs` and `template.html`. Source files are in `appscript/`.
5. Confirm the Google Workspace account has the 1,500 emails/day quota (Workspace accounts have this; personal Gmail is limited to 500/day).

### 6.2 How the Mailer Works

```
sendTickets()
    |
    |-- Resolves column indexes from header row (by name, not position)
    |-- Locates Drive folder named "keli-qr-codes"
    |
    +-- For each student row (skips rows where mail_status = "sent"):
        |-- Validates: name, email, day1, day2 present
        |-- Fetches day1QR.png and day2QR.png blobs from Drive
        |-- Renders HTML email via template scriptlet
        |-- Sends via GmailApp with HTML body + 2 PNG attachments
        |-- Writes "sent" + ISO timestamp to sheet on success
        |-- Writes "failed: <message>" on exception
        +-- Sleeps 300ms between sends (rate limit protection)
```

The mailer is **idempotent**: re-running it will automatically skip rows already marked `sent`. This makes it safe to run in batches or to resume after a partial failure.

### 6.3 Recommended Send Strategy

Send in batches to stay within the 1,500 email/day Workspace quota:

| Run | Cohort | Approx Count | Notes |
|-----|--------|-------------|-------|
| 1 | BTech Year 4 | ~80 | Use as dry-run - smallest cohort |
| 2 | BTech Year 3 | ~350 | Only proceed if Run 1 had zero failures |
| 3 | BTech Year 2 | ~350 | |
| 4 | BTech Year 1 | ~350 | |
| 5 | MCA + MTech + B.Arch | ~80 | |

Filter `mail_status` for `"failed"` after each run. Fix bad email addresses in the sheet. Re-run - the script auto-skips already-sent rows.

---

## 7. Component 3 - Express + SQLite Backend

The backend is the runtime heart of the system on event day. It serves both the REST API and the compiled React frontend as static files, all over self-signed HTTPS on a local LAN.

### 7.1 Tech Stack

| Technology | Version | Role |
|------------|---------|------|
| Node.js | 20+ | Runtime |
| TypeScript | 5.7 | Language |
| Express | 4.21 | HTTP framework |
| better-sqlite3 | latest | Synchronous SQLite driver |
| jsonwebtoken | 9.0 | JWT generation & verification |
| cors | 2.8 | CORS headers for LAN access |
| dotenv | 16.4 | Environment variable loader |
| ts-node | 10.9 | TypeScript execution (dev) |
| nodemon | 3.1 | Auto-reload (dev) |

### 7.2 Module Breakdown

#### `src/index.ts` - Server Entry Point

- Loads environment via `dotenv`
- Guards startup if `JWT_SECRET` is missing
- Attaches `requestLogger` middleware (all HTTP requests logged with method, URL, status, duration, IP)
- Serves compiled React SPA from `app/` directory as static files
- Mounts `/api/auth/*` and `/api/tickets/*` route groups
- Falls back to `index.html` for all non-API GET routes (SPA deep-link support)
- Global Express error handler catches any unhandled exceptions
- Prefers HTTPS (self-signed cert) - falls back to HTTP with a warning if certs are missing

#### `src/db.ts` - Database Layer

- Opens `keli.db` using `better-sqlite3`
- Enables **WAL (Write-Ahead Logging)** mode - allows concurrent reads from scanner phones while a write is in progress
- Sets `synchronous = NORMAL` - safe durability for a single-writer, multiple-reader setup
- Creates `tickets` table and two B-tree indexed columns (`day1`, `day2`) if they do not exist

#### `src/auth.ts` - Authentication & Session Management

- Loads scanner credentials from `SCANNERS` env var at request time (format: `user1:pass1,user2:pass2`)
- On login: generates a `crypto.randomUUID()` session ID, stores it in an in-memory `Map<username, SessionInfo>`
- JWT token encodes `{ username, sessionId }` - signed with `JWT_SECRET`, expires in 24h
- On every authenticated request: verifies the JWT AND checks that the embedded `sessionId` matches the currently active session for that username
- **Single-device enforcement**: logging in on a new device invalidates the previous session. The old device's next API call returns `SESSION_OVERRIDDEN` - the frontend auto-redirects to login

#### `src/logger.ts` - Structured Logger

Four exported utilities with colour-coded terminal output (ANSI escape codes):
- `logInfo(tag, message, meta?)` - cyan timestamp, green tag
- `logWarn(tag, message, meta?)` - cyan timestamp, yellow tag
- `logError(tag, message, meta?)` - cyan timestamp, red tag
- `requestLogger(req, res, next)` - Express middleware; logs method, URL, status code (coloured by range), duration, client IP; suppresses static asset noise for sub-400 responses

#### `src/routes/tickets.ts` - Ticket API Handlers

All routes are protected by `requireAuth` middleware.

| Endpoint | Handler Logic |
|----------|-----------------------|
| `POST /scan-and-verify` | Looks up ticket by ID. Returns `invalid` if not found. Returns `already_scanned` with metadata if flagged. Performs atomic `UPDATE WHERE day_scanned=0`; if `changes=0`, re-fetches and returns `already_scanned` (concurrent race handled). On success: returns name, dept, year, program. |
| `GET /stats` | Returns total tickets, day1 scanned count, day2 scanned count, plus per-program breakdown via GROUP BY. |
| `GET /` | Search by name, email, or exact ticket ID via `?q=` param. `?limit=` defaults to 100. |
| `PATCH /:id` | Admin override: updates scan status fields for a ticket row ID. Only fields in allowlist are accepted. |
| `GET /ping` | Liveness probe: returns `{ ok: true, time: ISO }`. |

#### `scripts/import.ts` - Database Import Script

Reads `python/output/processed.xlsx` (or `db_import.csv`) and bulk-inserts all rows into `keli.db`.

- Tries `node:sqlite` (Node 22+ built-in) first, falls back to `better-sqlite3`
- Checks for existing data and aborts unless `--force` flag is passed
- With `--force`: truncates the table first, then imports fresh
- Reports: inserted count, skipped count, final total

```bash
cd keli-backend
npm run import            # normal import (aborts if DB has data)
npm run import -- --force # force-overwrite existing data
```

### 7.3 Running the Backend

```bash
cd keli-backend
npm install

# Development (auto-reload on save)
npm run dev

# Production (compiled JS)
npm run build
npm start
```

---

## 8. Component 4 - React Frontend (Scanner & Admin UI)

A React 18 single-page application built with Vite and styled with TailwindCSS v4. The compiled output is placed into `keli-backend/app/` so the backend serves it directly - no separate frontend server needed on event day.

### 8.1 Tech Stack

| Technology | Version | Role |
|------------|---------|------|
| React | 18.3 | UI framework |
| React Router DOM | 7.1 | Client-side routing |
| Vite | 6.1 | Build tool + dev server |
| TailwindCSS | 4.0 | Utility-first styling |
| TypeScript | 5.7 | Language |
| Axios | 1.7 | HTTP client |
| html5-qrcode | 2.3 | Camera-based QR decoding |

### 8.2 Pages & Routing

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | `Login.tsx` | Public |
| `/scan` | `Scanner.tsx` | Protected (requires JWT in localStorage) |
| `/admin` | `Admin.tsx` | Protected (requires JWT in localStorage) |
| `*` | Redirect | to `/scan` if logged in, else `/login` |

Route protection is enforced by `ProtectedRoute` in `App.tsx` which checks `localStorage` for a valid token before rendering the protected component.

### 8.3 Scanner Page (`/scan`)

The primary gate-facing interface used by volunteer scanner phones.

**Screen 1 - Day Selection:**
The user picks Day 1 (Sep 25) or Day 2 (Sep 26). An initial ping is sent to verify backend connectivity. A logged-in username and logout button are shown.

**Screen 2 - Active Scanner:**
Activates rear camera using `Html5Qrcode` at 15 FPS with a 220x220px scan window. Displays a live backend online/offline indicator. A manual entry fallback input (8-char, uppercase enforced) is always visible below the camera view.

**Scan Result Cards** (appear for 2.5 seconds, then camera restarts):

| Result | Card | Colour |
|--------|------|--------|
| `status: "success"` | ENTRY GRANTED - shows name, dept, year, program | Dark green |
| `status: "already_scanned"` | TICKET ALREADY USED - shows who scanned it and when + DO NOT ALLOW ENTRY badge | Amber |
| `status: "invalid"` | INVALID TICKET - Ticket Not Found | Dark red |

**Concurrency handling:** A `processingRef` boolean prevents double-submission if the camera rapidly fires the same QR code twice before the API response returns.

### 8.4 Admin Page (`/admin`)

The operator's live dashboard.

- **Auto-refreshing stats** every 5 seconds via `setInterval`
- **Summary cards**: Total Tickets, Day 1 Checked In, Day 2 Checked In
- **Per-program breakdown**: BTech / MCA / MTech / B.Arch - Day 1 and Day 2 counts vs total
- **Search**: Query by name, email, or ticket ID
- **Ticket Override**: Reset a Day 1 or Day 2 scan for a ticket (with confirm dialog) - useful for legitimate re-entry edge cases

### 8.5 API Client (`src/api.ts`)

A thin Axios wrapper with:
- **Request interceptor**: logs method + URL before every request
- **Response interceptor**: logs status + duration after every response
- **Auto-logout on 401**: clears localStorage tokens and redirects to `/login`
- **Session override detection**: if `code === "SESSION_OVERRIDDEN"`, shows a device-kicked message before redirect

### 8.6 Building for Event Day Deployment

```bash
cd keli-frontend
npm run build            # outputs to dist/

# Copy to backend static serving folder
xcopy /E /Y dist\ ..\keli-backend\app\    # Windows
# cp -r dist/. ../keli-backend/app/       # macOS/Linux
```

The backend's catch-all `GET *` handler serves `app/index.html` for all non-API routes, enabling React Router deep-link support.

---

## 9. Database Schema

### Table: `tickets`

```sql
CREATE TABLE tickets (
  id               INTEGER  PRIMARY KEY AUTOINCREMENT,
  name             TEXT     NOT NULL,
  email            TEXT     NOT NULL,
  dept             TEXT     DEFAULT '',        -- raw sheet tab name
  year             INTEGER  DEFAULT 0,         -- 1-5
  program          TEXT     DEFAULT 'B',       -- B/M/T/A
  group_code       TEXT     DEFAULT '0',       -- A/B/C/E/M/V/L/R/0
  day1             TEXT     UNIQUE,            -- ticket ID for Night 1
  day1_scanned     INTEGER  DEFAULT 0,         -- 0=unused, 1=scanned
  day1_scanned_at  TEXT     DEFAULT NULL,      -- ISO datetime of scan
  day1_scanned_by  TEXT     DEFAULT '',        -- scanner username
  day2             TEXT     UNIQUE,            -- ticket ID for Night 2
  day2_scanned     INTEGER  DEFAULT 0,
  day2_scanned_at  TEXT     DEFAULT NULL,
  day2_scanned_by  TEXT     DEFAULT '',
  created_at       TEXT     DEFAULT (datetime('now'))
);

CREATE INDEX idx_day1 ON tickets(day1);        -- O(log n) lookup per scan
CREATE INDEX idx_day2 ON tickets(day2);        -- O(log n) lookup per scan
```

### Why SQLite (not MongoDB or PostgreSQL)

| Factor | SQLite Decision |
|--------|----------------|
| **Setup** | Zero - single file, no daemon or service |
| **Event day startup** | `node dist/index.js` - that is it |
| **If server crashes** | DB file is intact; restart node only |
| **Atomic scan** | `UPDATE WHERE scanned=0` - guaranteed by SQLite locking semantics |
| **Backup** | `cp keli.db keli_backup.db` |
| **Scale** | 1,500 records - SQLite handles millions with ease |
| **WAL mode** | Allows 4+ concurrent reads while 1 write is in-flight |

### Adding Fields (Schema Evolution)

SQLite `ALTER TABLE ... ADD COLUMN` is non-destructive and requires no migration tooling:

```sql
-- Add a third show night
ALTER TABLE tickets ADD COLUMN day3 TEXT UNIQUE;
ALTER TABLE tickets ADD COLUMN day3_scanned INTEGER DEFAULT 0;
ALTER TABLE tickets ADD COLUMN day3_scanned_at TEXT DEFAULT NULL;
ALTER TABLE tickets ADD COLUMN day3_scanned_by TEXT DEFAULT '';

-- Add a seat zone field
ALTER TABLE tickets ADD COLUMN zone TEXT DEFAULT 'GENERAL';
```

---

## 10. REST API Reference

**Base URL:** `https://<laptop-ip>:3000/api`

All endpoints except `/auth/login` require:
```
Authorization: Bearer <jwt_token>
```

---

### POST `/auth/login`

Authenticates a scanner and returns a signed JWT.

**Request:**
```json
{ "username": "scanner1", "password": "pass1" }
```

**Response 200:**
```json
{ "token": "<signed_jwt>", "username": "scanner1" }
```

**Response 401:**
```json
{ "error": "Invalid credentials" }
```

> Logging in on a new device with the same credentials invalidates the previous device's session.

---

### POST `/auth/logout`

Invalidates the active session for the authenticated user.

**Response 200:**
```json
{ "ok": true, "message": "Logged out successfully" }
```

---

### POST `/tickets/scan-and-verify`

Primary gate-entry endpoint. Performs lookup + atomic mark in a single round trip.

**Request:**
```json
{ "ticketId": "KB1A1001", "day": 1 }
```

**Response - Valid entry (first scan):**
```json
{
  "status": "success",
  "name": "Arjun Nair",
  "dept": "CSE-A",
  "year": 1,
  "program": "B"
}
```

**Response - Already scanned:**
```json
{
  "status": "already_scanned",
  "name": "Arjun Nair",
  "scanned_at": "2026-09-25T19:42:11",
  "scanned_by": "scanner2"
}
```

**Response - Not found:**
```json
{ "status": "invalid" }
```

---

### GET `/tickets/stats`

Returns live gate entry statistics, auto-aggregated from the database.

**Response 200:**
```json
{
  "total": 1480,
  "day1Scanned": 823,
  "day2Scanned": 0,
  "byProgram": [
    { "program": "B", "total": 1200, "day1": 720, "day2": 0 },
    { "program": "M", "total": 80,   "day1": 45,  "day2": 0 },
    { "program": "T", "total": 60,   "day1": 30,  "day2": 0 },
    { "program": "A", "total": 140,  "day1": 28,  "day2": 0 }
  ]
}
```

---

### GET `/tickets?q=<query>&limit=<n>`

Search for tickets by name, email, or exact ticket ID.

**Query params:**
- `q` - search term; matched via `LIKE %q%` on name/email, exact match on day1/day2
- `limit` - max results returned (default: 100)

**Response 200:** Array of complete ticket row objects.

---

### PATCH `/tickets/:id`

Admin override - update scan status for a specific ticket row. Only the following fields are accepted; all others are silently ignored:

```json
{
  "day1_scanned":    0,
  "day1_scanned_at": null,
  "day1_scanned_by": ""
}
```

**Response 200:** Full updated ticket row object.

---

### GET `/tickets/ping`

Liveness probe used by scanner phones for the online/offline indicator.

**Response 200:**
```json
{ "ok": true, "time": "2026-09-25T18:00:00.000Z" }
```

---

## 11. Authentication & Session Model

```
[Unauthenticated]
      |
      | POST /auth/login { username, password }
      |
      v
Validate credentials against SCANNERS env var
      |
      |--[FAIL]--> 401 Invalid credentials
      |
      | Generate sessionId = crypto.randomUUID()
      | activeSessions.set(username, { sessionId, ip, loggedInAt })
      | token = jwt.sign({ username, sessionId }, secret, { expiresIn: "24h" })
      |
      v
[Authenticated] -- JWT stored in localStorage on client
      |
      | Every API call: Authorization: Bearer <token>
      |
      v
requireAuth middleware:
  1. Verify JWT signature + expiry
  2. Extract { username, sessionId }
  3. activeSessions.get(username) -> currentSession
  4. Compare currentSession.sessionId === payload.sessionId
      |
      |--[MISMATCH]--> 401 { error: "...", code: "SESSION_OVERRIDDEN" }
      |                   Client clears token -> alert -> redirect /login
      |
      +-[MATCH]-----> req.username = username -> next()
```

**Key properties:**
- Credentials are never stored in the database - they live only in `.env`
- JWT has a 24-hour expiry - covers any single event day
- Session map is in-memory - cleared on server restart (users must re-login, acceptable for event use)
- Each username supports exactly one active session - prevents credential sharing between two phones

---

## 12. Environment Configuration

### `keli-backend/.env`

```env
# JWT signing secret - minimum 32 random characters
JWT_SECRET=replace_this_with_a_long_random_string_minimum_32_chars

# Scanner credentials - comma-separated user:password pairs
# Add one entry per physical scanning device + admin account
SCANNERS=scanner1:pass1,scanner2:pass2,scanner3:pass3,admin:adminpass
```

> **Never commit `.env` to git.** It is listed in both root and backend `.gitignore` files.

---

## 13. Setup & Deployment Guide

### Prerequisites

| Tool | Version | Required By |
|------|---------|-------------|
| Python | 3.10+ | Data pipeline |
| pip | any | Python deps |
| Node.js | 20+ | Backend + Frontend |
| npm | 10+ | Package management |
| OpenSSL | any | TLS cert generation |

### Step 1 - Clone & Install

```bash
git clone <repo-url>
cd Keli26

# Backend dependencies
cd keli-backend && npm install && cd ..

# Frontend dependencies
cd keli-frontend && npm install && cd ..

# Python dependencies
cd python && pip install -r requirements.txt && cd ..
```

### Step 2 - Configure Environment

```bash
cd keli-backend
# Create .env file manually:
# JWT_SECRET=<your_random_32+_char_secret>
# SCANNERS=scanner1:pass1,scanner2:pass2,scanner3:pass3,admin:adminpass
```

### Step 3 - Generate TLS Certificate

HTTPS is mandatory for `getUserMedia()` (camera API) on mobile browsers over LAN.

```bash
cd keli-backend
node gen-cert.js
# OR using OpenSSL directly:
openssl req -nodes -new -x509 -keyout server.key -out server.cert -days 365
```

Confirm `server.key` and `server.cert` exist in `keli-backend/`.

### Step 4 - Run Python Pipeline

```bash
# Place year1.xlsx ... year5.xlsx into python/input/
cd python
python check_sheets.py            # validate all sheet tab names first
python process_students.py        # generate ticket IDs + QR PNGs
```

Check output:
- `python/output/processed.xlsx` - master data with ticket IDs
- `python/output/qr/` - one PNG per ticket ID (~3,000 files)

### Step 5 - Email Students via App Script

1. Import `python/output/processed.xlsx` into Google Sheets as tab named `students`
2. Add columns `mail_status` and `mail_sent_at` at the end
3. Upload `python/output/qr/` folder to Google Drive as folder named `keli-qr-codes`
4. In Apps Script editor: paste `appscript/mailer.gs` and `appscript/template.html`
5. Run `sendTickets()` in batches (see Section 6.3)

### Step 6 - Import Data to SQLite

```bash
cd keli-backend
npm run import
# Check output: "Import complete . Inserted: 1480 . Skipped: 0 . Total in DB: 1480"
```

Verify with SQLite CLI:
```bash
sqlite3 keli.db "SELECT COUNT(*) FROM tickets;"
sqlite3 keli.db "SELECT name, day1, day2 FROM tickets LIMIT 5;"
```

### Step 7 - Build & Deploy Frontend

```bash
cd keli-frontend
npm run build

# Windows
xcopy /E /Y dist\ ..\keli-backend\app\

# macOS/Linux
cp -r dist/. ../keli-backend/app/
```

### Step 8 - Start Backend

```bash
cd keli-backend
npm start
# Look for: [SERVER START] KELI Scanner HTTPS server running at https://0.0.0.0:3000
```

Open `https://localhost:3000` in your browser to verify. Accept the self-signed cert warning.

### Step 9 - Connect Scanner Devices

1. Enable WiFi hotspot on the laptop (or connect all devices to the same router)
2. Find laptop IP: `ipconfig` -> look for Wireless LAN IPv4 address
3. On each scanner phone: browser -> `https://<laptop-ip>:3000`
4. Accept the certificate warning (required once per device per session)
5. Log in with assigned credentials
6. Select Day 1 or Day 2 -> camera activates

---

## 14. Event Day Runbook

### Pre-Event Checklist (Complete Night Before)

- [ ] `keli.db` imported and verified - check row count matches expected
- [ ] Frontend built and placed in `keli-backend/app/`
- [ ] `.env` has correct `SCANNERS` credentials
- [ ] `server.key` and `server.cert` present in `keli-backend/`
- [ ] Laptop hotspot configured and tested with 4+ simultaneous devices
- [ ] All scanner phones can reach `https://<laptop-ip>:3000`
- [ ] All scanner phones have accepted the TLS certificate warning
- [ ] Backup copy of DB: `cp keli-backend/keli.db keli-backend/keli_backup.db`
- [ ] Paper printout of student-to-ticket-ID list as last-resort manual backup
- [ ] Power extension cord at the venue secured

### Starting the System

```bash
cd keli-backend
npm start
```

Expected console output:
```
[HH:MM:SS] [SERVER START] KELI Scanner HTTPS server running at https://0.0.0.0:3000
[HH:MM:SS] [SERVER START] Connect scanner devices to the same WiFi hotspot.
```

### During the Event

- **Monitor the console** - every scan is logged with scanner name, ticket ID, student name, and result (colour-coded)
- **Admin panel** at `/admin` shows live entry counts with auto-refresh every 5 seconds
- **If a scanner phone disconnects**: volunteer re-opens the browser URL and logs in again
- **If a phone is handed off to another volunteer**: logging in on the new phone kicks the old session automatically
- **If a legitimate re-entry override is needed**: use `/admin` search + Reset button (prompts confirmation)

### Emergency Procedures

**Server crash/restart:**
```bash
cd keli-backend
npm start
```
The SQLite database file is safe. WAL mode ensures no data loss on abrupt shutdown. All scanner phones must log in again (sessions are in-memory).

**Phone battery dead - hand device to relief volunteer:**
The new phone opens the same URL, logs in with the same credentials. The previous session is kicked automatically.

**Database corruption (extremely unlikely):**
```bash
cp keli-backend/keli_backup.db keli-backend/keli.db
npm start
```
Scans since the backup was taken will need manual re-entry via the admin override panel.

---

## 15. Security Considerations

| Threat | Mitigation |
|--------|-----------|
| **Ticket forgery** | IDs are 8-char alphanumeric - brute-forcing 1 valid ID in 36^8 = 2.8 trillion possibilities is infeasible in a venue context |
| **Ticket sharing / screenshot replay** | QR is invalidated on first scan - a second scan immediately shows `ALREADY SCANNED` with the time and scanner identity |
| **Unauthorised API access** | All endpoints require a signed JWT; credentials are env-var-only |
| **Session hijacking** | JWTs are 24h-lived and bound to a session ID; session map enforces one active session per account |
| **Network eavesdropping on LAN** | All communication is over HTTPS (TLS) even on local LAN |
| **Secrets in version control** | All secrets (`.env`, certs, DB) are in `.gitignore`; repo contains no credentials |
| **Concurrent scan race condition** | Atomic `UPDATE WHERE scanned=0` - SQLite write serialisation prevents double-entry even under concurrent load from 4 phones |
| **Admin privilege abuse** | Override endpoint only modifies explicitly allowlisted fields; no arbitrary SQL injection surface |

---

## 16. Technology Decisions & Trade-offs

### Python for Data Pipeline

The `pandas` + `openpyxl` ecosystem handles messy, inconsistently formatted Excel files better than any other tool at zero cost. The script is designed to be run once by one person, not deployed as a service - so startup time and dependency weight are non-issues. Email validation, sheet matching, and counter logic are trivial to unit-test and iterate on.

### SQLite vs. MongoDB or PostgreSQL

At 1,500 records and 4 concurrent writers over LAN, SQLite in WAL mode is the architecturally correct choice. A document database or a full RDBMS server would require:
- A separate daemon process (`mongod`, `postgres`) running and managed
- Additional port, auth, and connection configuration
- More failure modes to troubleshoot on event day under pressure

SQLite is a single file. Recovery from any failure is `cp keli_backup.db keli.db && npm start`. The synchronous `better-sqlite3` driver also means no callback hell or async complexity in route handlers.

### Self-Signed HTTPS vs. HTTP

Browsers enforce a **secure context** requirement for the `getUserMedia()` API (camera access). HTTP on LAN works for desktop Chrome but blocks camera access on Android and iOS mobile browsers entirely. Self-signed certs require a one-time click-through per device - a worthwhile and predictable trade-off.

### Single-Session JWT Enforcement

Event-day scanner accounts use shared credentials (e.g., `scanner1`). Without session enforcement, two people could operate on the same account simultaneously and all scan records would be attributed to the same identity, making audit logs useless for tracing problems. The session override model gives a clean handoff mechanism: the new phone takes over, the old one is immediately kicked and must re-login.

### Serving Frontend from Backend

On event day the entire system runs on a single laptop. Requiring a separate Vite dev server process would add complexity and an additional failure point. Building React to `dist/` and serving it via Express static middleware means there is exactly one process to start, one port to expose, one set of logs to read, and one thing to restart when something goes wrong.

### Offline-First Architecture

The entire event day flow - scanning, verification, stats, override - works with zero internet. The only internet-dependent phases are pre-event (email sending via Gmail). This is intentional: event venues have unreliable or overloaded WiFi, and a system that depends on internet connectivity will fail at the worst possible moment.

---

## Appendix - Quick Reference

### Essential Commands

```bash
# Python pipeline
cd python
python check_sheets.py              # validate sheet tab names
python process_students.py          # generate ticket IDs + QR codes

# Backend
cd keli-backend
npm run dev                         # development server (hot-reload)
npm run build                       # compile TypeScript to dist/
npm start                           # production server
npm run import                      # import processed.xlsx to SQLite
npm run import -- --force           # force-overwrite existing DB data

# Frontend
cd keli-frontend
npm run dev                         # vite dev server (development)
npm run build                       # production build to dist/

# SQLite manual queries
sqlite3 keli.db "SELECT COUNT(*) FROM tickets;"
sqlite3 keli.db "SELECT * FROM tickets WHERE day1='KB1A1001';"
sqlite3 keli.db "SELECT COUNT(*) FROM tickets WHERE day1_scanned=1;"
sqlite3 keli.db "SELECT program, COUNT(*) FROM tickets GROUP BY program;"
```

### Ticket ID Decode Reference

```
K  B  1  A  1  0  0  1
|  |  |  |  |  +--+--+-- Counter (001)
|  |  |  |  +----------- Day (1 = Sep 25)
|  |  |  +-------------- Group (A = CSE-A)
|  |  +----------------- Year (1 = First Year)
|  +-------------------- Program (B = BTech)
+----------------------- Keli prefix (always K)
```

### Scanner Credentials Template

| Device | Username | Password |
|--------|----------|---------|
| Scanner Phone 1 | `scanner1` | *(set in .env)* |
| Scanner Phone 2 | `scanner2` | *(set in .env)* |
| Scanner Phone 3 | `scanner3` | *(set in .env)* |
| Scanner Phone 4 | `scanner4` | *(set in .env)* |
| Admin Device | `admin` | *(set in .env)* |

---

*KELI 2026 · GEC RIT Kottayam Student Union · Built by the KELI Tech Team*
