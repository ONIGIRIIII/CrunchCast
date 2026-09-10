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

Scoped to the professors who taught THAT term, not an all-time list. This
replaces the earlier all-time "Compare instructors" feature per user
feedback (it showed every instructor who'd ever taught the course, not
just that term's).

DISPLAY-ONLY, like the other course_term_stats-adjacent tables: never read
by build_features.py, train.py, or predict.py.
"""

from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
SECTIONS_CLEAN_PATH = REPO_ROOT / "data" / "processed" / "sections_clean.parquet"
TABLEAU_V1_DIR = REPO_ROOT / "data" / "raw" / "tableau-dashboard" / "UBCV"
TABLEAU_V2_DIR = REPO_ROOT / "data" / "raw" / "tableau-dashboard-v2" / "UBCV"
OUT_PATH = REPO_ROOT / "data" / "processed" / "course_section_stats.parquet"

OUTPUT_COLS = ["year", "session", "subject", "course", "section", "instructors", "avg", "std_dev", "fail_rate", "enrolled", "source"]


def _numeric(df: pd.DataFrame, col: str) -> pd.Series:
    return pd.to_numeric(df[col], errors="coerce")


def _split_instructors(raw) -> list:
    if pd.isna(raw):
        return []
    return [n.strip() for n in str(raw).split(";") if n.strip()]


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
    df["fail_rate"] = _numeric(df, "<50") / df["enrolled"]
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
    df["fail_rate"] = _numeric(df, "<50") / df["enrolled"]
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
