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

    # Save per-year separate files and multi-tab Excel file
    by_year_path = OUTPUT_DIR / "processed_by_year.xlsx"
    with pd.ExcelWriter(by_year_path) as writer:
        for y in sorted(combined["Year"].unique()):
            y_df = combined[combined["Year"] == y]
            # Write to multi-tab workbook
            y_df.to_excel(writer, sheet_name=f"Year {y}", index=False)
            # Write to individual file
            single_path = OUTPUT_DIR / f"processed_year{y}.xlsx"
            y_df.to_excel(single_path, index=False)
            print(f"✓ Saved Year {y} output ({len(y_df)} students) → {single_path}")

    print(f"\n✓ {len(combined)} total students processed")
    print(f"✓ {len(combined) * 2} QR codes → {QR_DIR}/")
    print(f"✓ Combined Output → {output_path}")
    print(f"✓ Multi-Tab Year Output → {by_year_path}")
    print(f"\nNext Steps:")
    print(f"  1. Upload '{QR_DIR}/' folder to Google Drive as 'keli-qr-codes'")
    print(f"  2. Import '{by_year_path}' into Google Sheets (creates tabs: Year 1, Year 2, Year 3, Year 4, Year 5)")
    print(f"  3. Open any year tab in Google Sheets and click Run in Apps Script to send emails for that year!")

if __name__ == "__main__":
    main()
