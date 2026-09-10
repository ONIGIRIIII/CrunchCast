"""Build the "view by term" history table: per-course, per-term stats
spanning 1996-2025 (whatever's latest), by combining three schema-different
sources into one tidy shape.

This is a DISPLAY-ONLY table (data/processed/course_term_stats.parquet),
completely separate from data/processed/features.parquet (the ML training
table). The prediction model never sees anything built here - see
data/README.md for why the model itself stays on PAIR Reports (<=2016W)
data only, while this table extends further using two additional
non-corrupted sources for the history browser.

Three sources, one output shape (year, session, subject, course, enrolled,
avg, std_dev, high, low, fail_rate, source):
  - PAIR Reports (<=2016W): already cleaned in sections_clean.parquet: has
    a real OVERALL row and an explicit Fail count.
  - tableau-dashboard "v1" (2017S-2021W): has a real OVERALL row and
    std_dev, but no explicit Fail count - fail_rate is derived from the
    "<50" grade-count bin instead (documented re-derivation, not
    fabrication: that bin literally is the count of students who received
    a failing grade in the reported distribution).
  - tableau-dashboard-v2 (2022S+): no OVERALL row (synthesized here by
    aggregating that term's sections) and no std_dev at all - reported as
    unavailable (None) for those terms rather than estimated.
"""

from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
SECTIONS_CLEAN_PATH = REPO_ROOT / "data" / "processed" / "sections_clean.parquet"
TABLEAU_V1_DIR = REPO_ROOT / "data" / "raw" / "tableau-dashboard" / "UBCV"
TABLEAU_V2_DIR = REPO_ROOT / "data" / "raw" / "tableau-dashboard-v2" / "UBCV"
OUT_PATH = REPO_ROOT / "data" / "processed" / "course_term_stats.parquet"

OUTPUT_COLS = ["year", "session", "subject", "course", "enrolled", "avg", "std_dev", "high", "low", "fail_rate", "source"]


def _numeric(df: pd.DataFrame, col: str) -> pd.Series:
    return pd.to_numeric(df[col], errors="coerce")


def load_pair_overall() -> pd.DataFrame:
    """PAIR's OVERALL rows, already cleaned - just reshape to OUTPUT_COLS."""
    sections = pd.read_parquet(SECTIONS_CLEAN_PATH)
    overall = sections[sections["is_overall"]].copy()
    overall["source"] = "pair"
    return overall[OUTPUT_COLS]


def load_tableau_v1() -> pd.DataFrame:
    """tableau-dashboard: real OVERALL rows, has std_dev, fail_rate derived
    from the <50 grade-count bin (no explicit Fail column in this schema)."""
    csv_paths = sorted(TABLEAU_V1_DIR.glob("*/*.csv"))
    if not csv_paths:
        raise FileNotFoundError(f"No CSVs under {TABLEAU_V1_DIR}. Run download_tableau_data.py first.")
    frames = [pd.read_csv(path, dtype=str) for path in csv_paths]
    df = pd.concat(frames, ignore_index=True)
    df = df[df["Section"] == "OVERALL"].copy()

    df["enrolled"] = _numeric(df, "Enrolled")
    df["avg"] = _numeric(df, "Avg")
    df["std_dev"] = _numeric(df, "Std dev")
    df["high"] = _numeric(df, "High")
    df["low"] = _numeric(df, "Low")
    df["fail_rate"] = _numeric(df, "<50") / df["enrolled"]
    df["year"] = df["Year"].astype(int)
    df["session"] = df["Session"]
    df["subject"] = df["Subject"].str.strip()
    df["course"] = df["Course"].astype(str).str.strip()
    df["source"] = "tableau_v1"
    return df[OUTPUT_COLS]


def load_tableau_v2() -> pd.DataFrame:
    """tableau-dashboard-v2: no OVERALL row and no std_dev at all. Synthesize
    a course-level rollup per term by aggregating across that term's
    sections (enrollment-weighted avg, max/min high/low, summed <50 bin for
    fail_rate); std_dev is left as NaN (unavailable), never estimated."""
    csv_paths = sorted(TABLEAU_V2_DIR.glob("*/*.csv"))
    if not csv_paths:
        raise FileNotFoundError(f"No CSVs under {TABLEAU_V2_DIR}. Run download_tableau_data.py first.")
    frames = [pd.read_csv(path, dtype=str) for path in csv_paths]
    df = pd.concat(frames, ignore_index=True)

    df["reported"] = _numeric(df, "Reported")
    df["avg"] = _numeric(df, "Avg")
    df["high"] = _numeric(df, "High")
    df["low"] = _numeric(df, "Low")
    df["below_50"] = _numeric(df, "<50")
    df["year"] = df["Year"].astype(int)
    df["session"] = df["Session"]
    df["subject"] = df["Subject"].str.strip()
    df["course"] = df["Course"].astype(str).str.strip()
    df = df.dropna(subset=["reported", "avg"])
    df = df[df["reported"] > 0]

    df["weighted_avg"] = df["avg"] * df["reported"]

    grouped = df.groupby(["year", "session", "subject", "course"], as_index=False).agg(
        enrolled=("reported", "sum"),
        weighted_avg_sum=("weighted_avg", "sum"),
        high=("high", "max"),
        low=("low", "min"),
        below_50_sum=("below_50", "sum"),
    )
    grouped["avg"] = grouped["weighted_avg_sum"] / grouped["enrolled"]
    grouped["fail_rate"] = grouped["below_50_sum"] / grouped["enrolled"]
    grouped["std_dev"] = pd.NA  # genuinely not reported in this era - not estimated
    grouped["source"] = "tableau_v2"
    return grouped[OUTPUT_COLS]


def main():
    pair = load_pair_overall()
    v1 = load_tableau_v1()
    v2 = load_tableau_v2()

    combined = pd.concat([pair, v1, v2], ignore_index=True)
    combined["session_order"] = combined["year"] * 2 + (combined["session"] == "W").astype(int)
    combined = combined.sort_values(["subject", "course", "session_order"]).reset_index(drop=True)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    combined.to_parquet(OUT_PATH, index=False)
    print(f"Wrote {len(combined):,} course-term rows to {OUT_PATH}")
    for source, group in combined.groupby("source"):
        years = f"{group['year'].min()}-{group['year'].max()}"
        print(f"  {source}: {len(group):,} rows, years {years}, std_dev available: {group['std_dev'].notna().sum():,}")


if __name__ == "__main__":
    main()
