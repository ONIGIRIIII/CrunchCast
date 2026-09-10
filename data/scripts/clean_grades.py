"""Parse the raw PAIR CSVs into one tidy table.

Reads every data/raw/pair-reports/UBC/<year><S|W>/*.csv file and concatenates
them into a single long table with consistent, lowercased column names and
numeric types. Writes data/processed/sections_clean.parquet.

Known data quirks handled here (documented in data/README.md):
  - Numeric fields are blank for very small/sensitive rows (e.g. a section
    with 7 audited students and no graded students) -> coerced to NaN.
  - Some rows are exact duplicates -> dropped.
  - A few rows are duplicated except for the Professor column (one blank,
    one populated) because of a known upstream data quirk. We do not attempt
    the upstream repo's manual per-row fix; instead we keep the row with a
    non-null Professor when both exist, which is a documented simplification.
  - "OVERALL" is a real value of the Section column (a course-level rollup
    row, not an individual section) - we keep it but flag it with
    is_overall=True so downstream code can choose to use it or not.
"""

from pathlib import Path

import pandas as pd
from grade_bins import BIN_COLS

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "data" / "raw" / "pair-reports" / "UBC"
OUT_PATH = REPO_ROOT / "data" / "processed" / "sections_clean.parquet"

NUMERIC_COLS = [
    "Enrolled", "Avg", "Std dev", "High", "Low",
    "Pass", "Fail", "Withdrew", "Audit", "Other",
    "0-9", "10-19", "20-29", "30-39", "40-49", "<50",
    "50-54", "55-59", "60-63", "64-67", "68-71", "72-75",
    "76-79", "80-84", "85-89", "90-100",
]

RENAME = {
    "Campus": "campus",
    "Year": "year",
    "Session": "session",
    "Subject": "subject",
    "Course": "course",
    "Detail": "detail",
    "Section": "section",
    "Title": "title",
    "Professor": "professor",
    "Enrolled": "enrolled",
    "Avg": "avg",
    "Std dev": "std_dev",
    "High": "high",
    "Low": "low",
    "Pass": "n_pass",
    "Fail": "n_fail",
    "Withdrew": "withdrew",
    "Audit": "audit",
    "Other": "other",
}

# See grade_bins.py for BIN_COLS and why PAIR's own "<50" column is used
# directly rather than re-summing the finer 0-9..40-49 columns underneath it.
BIN_SOURCE_COLS = {  # BIN_COLS entry -> raw PAIR column(s)
    "below_50": ["<50"],
    "50_54": ["50-54"], "55_59": ["55-59"], "60_63": ["60-63"], "64_67": ["64-67"],
    "68_71": ["68-71"], "72_75": ["72-75"], "76_79": ["76-79"], "80_84": ["80-84"],
    "85_89": ["85-89"], "90_100": ["90-100"],
}


def load_raw_csvs() -> pd.DataFrame:
    csv_paths = sorted(RAW_DIR.glob("*/*.csv"))
    if not csv_paths:
        raise FileNotFoundError(
            f"No CSVs found under {RAW_DIR}. Run download_pair_data.py first."
        )
    frames = [pd.read_csv(path, dtype=str) for path in csv_paths]
    return pd.concat(frames, ignore_index=True)


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.rename(columns=RENAME)
    df["year"] = df["year"].astype(int)
    df["subject"] = df["subject"].str.strip()
    df["course"] = df["course"].astype(str).str.strip()
    df["section"] = df["section"].astype(str).str.strip()
    df["professor"] = df["professor"].fillna("").str.strip()
    df["is_overall"] = df["section"].eq("OVERALL")

    key_cols = ["campus", "year", "session", "subject", "course", "section"]
    df = df.sort_values(key_cols + ["professor"], na_position="first")
    df = df.drop_duplicates(subset=key_cols, keep="last")  # keep non-blank professor when both exist
    df = df.drop_duplicates()

    df["fail_rate"] = df["n_fail"] / df["enrolled"]
    df["session_order"] = df["year"] * 2 + (df["session"] == "W").astype(int)

    for bin_col, raw_cols in BIN_SOURCE_COLS.items():
        df[bin_col] = df[raw_cols].sum(axis=1, skipna=True, min_count=1)

    keep_cols = key_cols + [
        "is_overall", "detail", "title", "professor", "enrolled",
        "avg", "std_dev", "high", "low", "n_pass", "n_fail", "fail_rate",
        "withdrew", "audit", "other", "session_order",
    ] + BIN_COLS
    return df[keep_cols].reset_index(drop=True)


def main():
    raw = load_raw_csvs()
    cleaned = clean(raw)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_parquet(OUT_PATH, index=False)
    print(f"Wrote {len(cleaned):,} rows to {OUT_PATH}")
    print(f"  sections (non-OVERALL): {(~cleaned['is_overall']).sum():,}")
    print(f"  OVERALL rollup rows:    {cleaned['is_overall'].sum():,}")


if __name__ == "__main__":
    main()
