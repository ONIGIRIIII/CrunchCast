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
avg, std_dev, high, low, fail_rate, instructors, below_50..90_100, source):
  - PAIR Reports (<=2016W): already cleaned in sections_clean.parquet: has
    a real OVERALL row, an explicit Fail count, and the 11 grade bins.
  - tableau-dashboard "v1" (2017S-2021W): has a real OVERALL row, std_dev,
    and the 11 grade bins, but no explicit Fail count - fail_rate is
    derived from the below_50 bin instead (documented re-derivation, not
    fabrication).
  - tableau-dashboard-v2 (2022S+): no OVERALL row (synthesized here by
    aggregating that term's sections) and no std_dev at all - reported as
    unavailable (None) for those terms rather than estimated.

`instructors` (all three sources): OVERALL rows never carry a professor
name (a term-level rollup can span several sections with different
instructors), so it's collected separately from that term's individual
section rows - every distinct, non-blank name (sections list multiple
instructors separated by ";"), in the order first seen. Empty list if none
were reported for that term.
"""

from pathlib import Path

import pandas as pd
from grade_bins import BIN_COLS

REPO_ROOT = Path(__file__).resolve().parents[2]
SECTIONS_CLEAN_PATH = REPO_ROOT / "data" / "processed" / "sections_clean.parquet"
TABLEAU_V1_DIR = REPO_ROOT / "data" / "raw" / "tableau-dashboard" / "UBCV"
TABLEAU_V2_DIR = REPO_ROOT / "data" / "raw" / "tableau-dashboard-v2" / "UBCV"
OUT_PATH = REPO_ROOT / "data" / "processed" / "course_term_stats.parquet"

TERM_KEY = ["year", "session", "subject", "course"]
OUTPUT_COLS = TERM_KEY + ["enrolled", "avg", "std_dev", "high", "low", "fail_rate", "instructors", "source"] + BIN_COLS


def _numeric(df: pd.DataFrame, col: str) -> pd.Series:
    return pd.to_numeric(df[col], errors="coerce")


def _collect_instructors(section_rows: pd.DataFrame, professor_col: str = "professor") -> pd.DataFrame:
    """section_rows: one row per SECTION (not OVERALL), with TERM_KEY columns
    plus professor_col (possibly ";"-separated for multiple instructors).
    Returns one row per term with a deduped, order-preserving instructors list."""
    def names_for_group(names: pd.Series) -> list:
        seen = []
        for raw in names.dropna():
            for name in str(raw).split(";"):
                name = name.strip()
                if name and name not in seen:
                    seen.append(name)
        return seen

    return (
        section_rows.groupby(TERM_KEY)[professor_col]
        .apply(names_for_group)
        .reset_index()
        .rename(columns={professor_col: "instructors"})
    )


def load_pair_overall() -> pd.DataFrame:
    """PAIR's OVERALL rows, already cleaned - reshape to OUTPUT_COLS, with
    instructors collected from that term's individual section rows."""
    sections = pd.read_parquet(SECTIONS_CLEAN_PATH)
    overall = sections[sections["is_overall"]].copy()
    overall["source"] = "pair"

    instructors = _collect_instructors(sections[~sections["is_overall"]])
    overall = overall.merge(instructors, on=TERM_KEY, how="left")
    overall["instructors"] = overall["instructors"].apply(lambda v: v if isinstance(v, list) else [])
    return overall[OUTPUT_COLS]


def load_tableau_v1() -> pd.DataFrame:
    """tableau-dashboard: real OVERALL rows, has std_dev and the 11 grade
    bins, fail_rate derived from the below_50 bin (no explicit Fail column
    in this schema). Instructors collected from that term's section rows."""
    csv_paths = sorted(TABLEAU_V1_DIR.glob("*/*.csv"))
    if not csv_paths:
        raise FileNotFoundError(f"No CSVs under {TABLEAU_V1_DIR}. Run download_tableau_data.py first.")
    frames = [pd.read_csv(path, dtype=str) for path in csv_paths]
    raw = pd.concat(frames, ignore_index=True)

    raw["year"] = raw["Year"].astype(int)
    raw["session"] = raw["Session"]
    raw["subject"] = raw["Subject"].str.strip()
    raw["course"] = raw["Course"].astype(str).str.strip()
    raw["professor"] = raw["Professor"]

    instructors = _collect_instructors(raw[raw["Section"] != "OVERALL"])

    df = raw[raw["Section"] == "OVERALL"].copy()
    df["enrolled"] = _numeric(df, "Enrolled")
    df["avg"] = _numeric(df, "Avg")
    df["std_dev"] = _numeric(df, "Std dev")
    df["high"] = _numeric(df, "High")
    df["low"] = _numeric(df, "Low")
    df["below_50"] = _numeric(df, "<50")
    for bin_col, raw_col in zip(BIN_COLS[1:], ["50-54", "55-59", "60-63", "64-67", "68-71", "72-75", "76-79", "80-84", "85-89", "90-100"]):
        df[bin_col] = _numeric(df, raw_col)
    df["fail_rate"] = df["below_50"] / df["enrolled"]
    df["source"] = "tableau_v1"

    df = df.merge(instructors, on=TERM_KEY, how="left")
    df["instructors"] = df["instructors"].apply(lambda v: v if isinstance(v, list) else [])
    return df[OUTPUT_COLS]


def load_tableau_v2() -> pd.DataFrame:
    """tableau-dashboard-v2: no OVERALL row and no std_dev at all. Synthesize
    a course-level rollup per term by aggregating across that term's
    sections (enrollment-weighted avg, max/min high/low, summed grade bins
    for fail_rate/distribution); std_dev is left as NaN (unavailable),
    never estimated. Instructors collected from the same section rows
    (there's no separate OVERALL row to exclude here)."""
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
    for bin_col, raw_col in zip(BIN_COLS[1:], ["50-54", "55-59", "60-63", "64-67", "68-71", "72-75", "76-79", "80-84", "85-89", "90-100"]):
        df[bin_col] = _numeric(df, raw_col)
    df["year"] = df["Year"].astype(int)
    df["session"] = df["Session"]
    df["subject"] = df["Subject"].str.strip()
    df["course"] = df["Course"].astype(str).str.strip()
    df["professor"] = df["Professor"]

    instructors = _collect_instructors(df)

    df = df.dropna(subset=["reported", "avg"])
    df = df[df["reported"] > 0]
    df["weighted_avg"] = df["avg"] * df["reported"]

    bin_aggs = {col: (col, "sum") for col in BIN_COLS}
    grouped = df.groupby(TERM_KEY, as_index=False).agg(
        enrolled=("reported", "sum"),
        weighted_avg_sum=("weighted_avg", "sum"),
        high=("high", "max"),
        low=("low", "min"),
        **bin_aggs,
    )
    grouped["avg"] = grouped["weighted_avg_sum"] / grouped["enrolled"]
    grouped["fail_rate"] = grouped["below_50"] / grouped["enrolled"]
    grouped["std_dev"] = pd.NA  # genuinely not reported in this era - not estimated
    grouped["source"] = "tableau_v2"

    grouped = grouped.merge(instructors, on=TERM_KEY, how="left")
    grouped["instructors"] = grouped["instructors"].apply(lambda v: v if isinstance(v, list) else [])
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
        has_instructors = group["instructors"].apply(len).gt(0).sum()
        print(f"  {source}: {len(group):,} rows, years {years}, std_dev available: {group['std_dev'].notna().sum():,}, with instructors: {has_instructors:,}")


if __name__ == "__main__":
    main()
