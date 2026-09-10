"""Per-SECTION grade stats for a specific term, e.g. "CPSC 110 in 2016W,
section 102: taught by Gregor Kiczales, avg 80.71%" - kept at full
(subject, course, year, session, section) granularity, unlike
course_term_stats.parquet (one blended row per term) or
instructor_course_stats.parquet (one row per instructor across all terms,
now removed - see below).

This is the raw building block only. `model/history.py` reads this table
and combines it up to per-instructor granularity for that term (an
instructor teaching two sections in the same term gets one enrollment-
weighted row, not two) before it reaches the API - see that module's
docstring and data/README.md's "Per-term instructor stats" section for why.

Includes the same 11-bin grade distribution as course_term_stats.parquet
(see grade_bins.py) so a specific section's own distribution chart can be
shown, not just the term's blended one.

Scoped to the professors who taught THAT term, not an all-time list. This
replaces the earlier all-time "Compare instructors" feature per user
feedback (it showed every instructor who'd ever taught the course, not
just that term's).

DISPLAY-ONLY, like the other course_term_stats-adjacent tables: never read
by build_features.py, train.py, or predict.py.

**Known data-quality issue, fixed here**: for a small but real share of
rows (mostly `tableau-dashboard`, ~9.5% of its rows), the raw "Professor"
field itself contains far more than a real teaching team - e.g. CPSC 110
2018W section 101's raw field lists 50+ full names that are clearly
students or TAs, not instructors (verified against the raw CSV; this is
an upstream data quality issue, not a bug in how we parse it). Legitimate
large team-taught courses do exist in this data (e.g. APSC 100's PAIR-era
sections list up to 9 real co-instructors, and some PAIR medical/pharmacy
courses list up to ~14), so a low cap would wrongly blank those out. See
MAX_INSTRUCTORS_PER_SECTION below.
"""

from pathlib import Path

import pandas as pd
from grade_bins import BIN_COLS

REPO_ROOT = Path(__file__).resolve().parents[2]
SECTIONS_CLEAN_PATH = REPO_ROOT / "data" / "processed" / "sections_clean.parquet"
TABLEAU_V1_DIR = REPO_ROOT / "data" / "raw" / "tableau-dashboard" / "UBCV"
TABLEAU_V2_DIR = REPO_ROOT / "data" / "raw" / "tableau-dashboard-v2" / "UBCV"
OUT_PATH = REPO_ROOT / "data" / "processed" / "course_section_stats.parquet"

OUTPUT_COLS = ["year", "session", "subject", "course", "section", "instructors", "avg", "std_dev", "fail_rate", "enrolled", "source"] + BIN_COLS
RAW_BIN_COLS = ["<50", "50-54", "55-59", "60-63", "64-67", "68-71", "72-75", "76-79", "80-84", "85-89", "90-100"]

# Real teaching teams observed in the cleanest source (PAIR) top out around
# 14 (some medical/pharmacy courses). Anything above this is treated as
# unreliable ("Professor" field polluted with student/TA names or similar)
# rather than displayed - see the module docstring.
MAX_INSTRUCTORS_PER_SECTION = 15


def _numeric(df: pd.DataFrame, col: str) -> pd.Series:
    return pd.to_numeric(df[col], errors="coerce")


def _split_instructors(raw) -> list:
    if pd.isna(raw):
        return []
    names = [n.strip() for n in str(raw).split(";") if n.strip()]
    if len(names) > MAX_INSTRUCTORS_PER_SECTION:
        return []  # unreliable - see MAX_INSTRUCTORS_PER_SECTION above
    return names


def _drop_challenge_sections(df: pd.DataFrame) -> pd.DataFrame:
    """"Challenge for credit" sections (coded e.g. "1CH", "CH1", "9CH") are
    an exam-only credit mechanism, not a real teaching section a student
    registers into - tiny, self-selected, already-prepared cohorts that
    would badly skew a "which section should I pick" comparison. Excluded
    entirely rather than just deprioritized."""
    return df[~df["section"].str.contains("CH", case=False, na=False)]


def load_pair_sections() -> pd.DataFrame:
    sections = pd.read_parquet(SECTIONS_CLEAN_PATH)
    df = sections[~sections["is_overall"]].dropna(subset=["avg"]).copy()
    df["instructors"] = df["professor"].apply(_split_instructors)
    df["source"] = "pair"
    return df[OUTPUT_COLS]


def load_tableau_v1_sections() -> pd.DataFrame:
    csv_paths = sorted(TABLEAU_V1_DIR.glob("*/*.csv"))
    if not csv_paths:
        raise FileNotFoundError(f"No CSVs under {TABLEAU_V1_DIR}. Run download_tableau_data.py first.")
    frames = [pd.read_csv(path, dtype=str) for path in csv_paths]
    df = pd.concat(frames, ignore_index=True)
    df = df[df["Section"] != "OVERALL"].copy()

    df["year"] = df["Year"].astype(int)
    df["session"] = df["Session"]
    df["subject"] = df["Subject"].str.strip()
    df["course"] = df["Course"].astype(str).str.strip()
    df["section"] = df["Section"].astype(str).str.strip()
    df["avg"] = _numeric(df, "Avg")
    df["std_dev"] = _numeric(df, "Std dev")
    df["enrolled"] = _numeric(df, "Enrolled")
    for bin_col, raw_col in zip(BIN_COLS, RAW_BIN_COLS):
        df[bin_col] = _numeric(df, raw_col)
    df["fail_rate"] = df["below_50"] / df["enrolled"]
    df["instructors"] = df["Professor"].apply(_split_instructors)
    df["source"] = "tableau_v1"
    df = df.dropna(subset=["avg"])
    return df[OUTPUT_COLS]


def load_tableau_v2_sections() -> pd.DataFrame:
    csv_paths = sorted(TABLEAU_V2_DIR.glob("*/*.csv"))
    if not csv_paths:
        raise FileNotFoundError(f"No CSVs under {TABLEAU_V2_DIR}. Run download_tableau_data.py first.")
    frames = [pd.read_csv(path, dtype=str) for path in csv_paths]
    df = pd.concat(frames, ignore_index=True)  # every row is already a real section - v2 has no OVERALL

    df["year"] = df["Year"].astype(int)
    df["session"] = df["Session"]
    df["subject"] = df["Subject"].str.strip()
    df["course"] = df["Course"].astype(str).str.strip()
    df["section"] = df["Section"].astype(str).str.strip()
    df["avg"] = _numeric(df, "Avg")
    df["std_dev"] = float("nan")  # not reported in this era - never estimated
    df["enrolled"] = _numeric(df, "Reported")
    for bin_col, raw_col in zip(BIN_COLS, RAW_BIN_COLS):
        df[bin_col] = _numeric(df, raw_col)
    df["fail_rate"] = df["below_50"] / df["enrolled"]
    df["instructors"] = df["Professor"].apply(_split_instructors)
    df["source"] = "tableau_v2"
    df = df.dropna(subset=["avg"])
    return df[OUTPUT_COLS]


def main():
    combined = pd.concat(
        [load_pair_sections(), load_tableau_v1_sections(), load_tableau_v2_sections()], ignore_index=True
    )
    combined = combined[combined["enrolled"] > 0]
    combined = _drop_challenge_sections(combined)
    combined["session_order"] = combined["year"] * 2 + (combined["session"] == "W").astype(int)
    combined = combined.sort_values(["subject", "course", "session_order", "section"]).reset_index(drop=True)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    combined.to_parquet(OUT_PATH, index=False)
    print(f"Wrote {len(combined):,} section-term rows to {OUT_PATH}")


if __name__ == "__main__":
    main()
