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
