"""Per-instructor historical grade stats within a course, e.g. "Gregor
Kiczales has taught CPSC 110 12 times since 2009, average grade 74.8%,
fail rate 11.2%" - the legitimate half of a RateMyProfessors-style
comparison, built entirely from grade data this project already has (no
RMP scraping - see the project plan for why that was declined).

DISPLAY-ONLY, like course_term_stats.parquet: never read by
build_features.py, train.py, or predict.py.

Real wrinkle: professor name FORMAT differs by source - PAIR is
"Last, First" (e.g. "Kiczales, Gregor"), both Tableau sources are
"First Last" (e.g. "Gregor Kiczales"). Naively grouping by the raw string
would split the same person into two "different" instructors depending on
which era's sections they taught in. Fixed by normalizing each name to a
token-set matching key (lowercase words, order-independent) purely for
GROUPING, while displaying the most-recently-seen raw name string as the
human-facing label. This won't catch middle names/initials or nicknames -
a documented limitation, consistent with the professor-name inconsistency
already noted elsewhere in data/README.md.

Co-taught sections (";"-separated professor field) attribute that
section's full stats to EACH listed instructor - a documented
simplification, not a bug: we can't disaggregate who taught which part of
a shared section.
"""

import re
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
SECTIONS_CLEAN_PATH = REPO_ROOT / "data" / "processed" / "sections_clean.parquet"
TABLEAU_V1_DIR = REPO_ROOT / "data" / "raw" / "tableau-dashboard" / "UBCV"
TABLEAU_V2_DIR = REPO_ROOT / "data" / "raw" / "tableau-dashboard-v2" / "UBCV"
OUT_PATH = REPO_ROOT / "data" / "processed" / "instructor_course_stats.parquet"

ROW_COLS = ["subject", "course", "year", "session_order", "professor", "avg", "std_dev", "fail_rate", "enrolled"]


def _numeric(df: pd.DataFrame, col: str) -> pd.Series:
    return pd.to_numeric(df[col], errors="coerce")


def _normalize_key(name: str) -> str:
    """'Kiczales, Gregor' and 'Gregor Kiczales' both -> 'gregor kiczales'
    (sorted tokens), so the same person groups together regardless of
    which source's name format they appear under."""
    tokens = re.split(r"[,\s]+", name.strip().lower())
    tokens = [t for t in tokens if t]
    return " ".join(sorted(tokens))


def _explode_instructors(df: pd.DataFrame, professor_col: str) -> pd.DataFrame:
    """One input row per section -> one output row per (section, instructor),
    for sections with 2+ ";"-separated names (co-taught)."""
    df = df.copy()
    df["professor_list"] = df[professor_col].fillna("").apply(
        lambda raw: [n.strip() for n in str(raw).split(";") if n.strip()]
    )
    df = df[df["professor_list"].apply(len) > 0]
    df = df.explode("professor_list").rename(columns={"professor_list": "professor"})
    df["instructor_key"] = df["professor"].apply(_normalize_key)
    return df


def load_pair_rows() -> pd.DataFrame:
    sections = pd.read_parquet(SECTIONS_CLEAN_PATH)
    non_overall = sections[~sections["is_overall"]].dropna(subset=["avg"])
    non_overall = non_overall.rename(columns={"professor": "professor_raw"})
    return _explode_instructors(non_overall, "professor_raw")[
        ["subject", "course", "year", "session_order", "professor", "instructor_key", "avg", "std_dev", "fail_rate", "enrolled"]
    ]


def load_tableau_v1_rows() -> pd.DataFrame:
    csv_paths = sorted(TABLEAU_V1_DIR.glob("*/*.csv"))
    if not csv_paths:
        raise FileNotFoundError(f"No CSVs under {TABLEAU_V1_DIR}. Run download_tableau_data.py first.")
    frames = [pd.read_csv(path, dtype=str) for path in csv_paths]
    df = pd.concat(frames, ignore_index=True)
    df = df[df["Section"] != "OVERALL"].copy()

    df["subject"] = df["Subject"].str.strip()
    df["course"] = df["Course"].astype(str).str.strip()
    df["year"] = df["Year"].astype(int)
    df["session_order"] = df["year"] * 2 + (df["Session"] == "W").astype(int)
    df["avg"] = _numeric(df, "Avg")
    df["std_dev"] = _numeric(df, "Std dev")
    df["enrolled"] = _numeric(df, "Enrolled")
    df["fail_rate"] = _numeric(df, "<50") / df["enrolled"]
    df = df.dropna(subset=["avg"])

    return _explode_instructors(df, "Professor")[
        ["subject", "course", "year", "session_order", "professor", "instructor_key", "avg", "std_dev", "fail_rate", "enrolled"]
    ]


def load_tableau_v2_rows() -> pd.DataFrame:
    csv_paths = sorted(TABLEAU_V2_DIR.glob("*/*.csv"))
    if not csv_paths:
        raise FileNotFoundError(f"No CSVs under {TABLEAU_V2_DIR}. Run download_tableau_data.py first.")
    frames = [pd.read_csv(path, dtype=str) for path in csv_paths]
    df = pd.concat(frames, ignore_index=True)

    df["subject"] = df["Subject"].str.strip()
    df["course"] = df["Course"].astype(str).str.strip()
    df["year"] = df["Year"].astype(int)
    df["session_order"] = df["year"] * 2 + (df["Session"] == "W").astype(int)
    df["avg"] = _numeric(df, "Avg")
    df["std_dev"] = float("nan")  # not reported in this era - never estimated
    df["enrolled"] = _numeric(df, "Reported")
    df["fail_rate"] = _numeric(df, "<50") / df["enrolled"]
    df = df.dropna(subset=["avg"])

    return _explode_instructors(df, "Professor")[
        ["subject", "course", "year", "session_order", "professor", "instructor_key", "avg", "std_dev", "fail_rate", "enrolled"]
    ]


def main():
    rows = pd.concat([load_pair_rows(), load_tableau_v1_rows(), load_tableau_v2_rows()], ignore_index=True)
    rows = rows[rows["enrolled"] > 0]
    rows = rows.sort_values("session_order")

    rows["weighted_avg"] = rows["avg"] * rows["enrolled"]
    rows["weighted_fail"] = rows["fail_rate"] * rows["enrolled"]
    has_std = rows["std_dev"].notna()
    rows["weighted_std"] = rows["std_dev"].where(has_std) * rows["enrolled"].where(has_std)
    rows["enrolled_with_std"] = rows["enrolled"].where(has_std)

    # most-recently-taught raw name string per (subject, course, instructor_key), for display
    display_names = (
        rows.groupby(["subject", "course", "instructor_key"])
        .tail(1)[["subject", "course", "instructor_key", "professor"]]
        .rename(columns={"professor": "instructor_display"})
    )

    grouped = rows.groupby(["subject", "course", "instructor_key"], as_index=False).agg(
        enrolled_total=("enrolled", "sum"),
        weighted_avg_sum=("weighted_avg", "sum"),
        weighted_fail_sum=("weighted_fail", "sum"),
        weighted_std_sum=("weighted_std", "sum"),
        enrolled_with_std_total=("enrolled_with_std", "sum"),
        n_offerings=("session_order", "size"),
        first_year=("year", "min"),
        last_year=("year", "max"),
    )
    grouped["avg"] = grouped["weighted_avg_sum"] / grouped["enrolled_total"]
    grouped["fail_rate"] = grouped["weighted_fail_sum"] / grouped["enrolled_total"]
    has_std_data = grouped["enrolled_with_std_total"].fillna(0) > 0
    grouped["std_dev"] = float("nan")
    grouped.loc[has_std_data, "std_dev"] = (
        grouped.loc[has_std_data, "weighted_std_sum"] / grouped.loc[has_std_data, "enrolled_with_std_total"]
    )

    result = grouped.merge(display_names, on=["subject", "course", "instructor_key"], how="left")
    result = result[[
        "subject", "course", "instructor_key", "instructor_display",
        "avg", "std_dev", "fail_rate", "enrolled_total", "n_offerings", "first_year", "last_year",
    ]]
    result = result.sort_values(["subject", "course", "avg"], ascending=[True, True, False]).reset_index(drop=True)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result.to_parquet(OUT_PATH, index=False)
    print(f"Wrote {len(result):,} instructor-course rows to {OUT_PATH}")
    print(f"  distinct (subject, course) pairs: {result[['subject','course']].drop_duplicates().shape[0]:,}")


if __name__ == "__main__":
    main()
