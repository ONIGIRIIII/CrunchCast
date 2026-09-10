"""Build the model-ready feature table from cleaned section data.

Produces one row per (year, session, subject, course, section) offering,
with:
  - difficulty_score: the proxy-for-workload label, a composite of that
    offering's own average grade, fail rate, and grade standard deviation.
  - historical/rolling features computed using ONLY offerings that happened
    strictly before the current one (by session_order), so the feature
    table can be used to simulate "predict before the term happens."

Read data/README.md for why difficulty_score is a proxy for workload, not
workload itself, and why 2017W+ data is excluded upstream in download step.
"""

from pathlib import Path

import pandas as pd

from feature_spec import CATEGORICAL_FEATURE_COLS, LABEL_COL, NUMERIC_FEATURE_COLS
from metadata_provider import StaticCSVMetadataProvider

REPO_ROOT = Path(__file__).resolve().parents[2]
SECTIONS_PATH = REPO_ROOT / "data" / "processed" / "sections_clean.parquet"
METADATA_PATH = REPO_ROOT / "data" / "external" / "course_metadata.csv"
OUT_PATH = REPO_ROOT / "data" / "processed" / "features.parquet"

MIN_ENROLLED_FOR_LABEL = 10  # below this, PAIR privacy suppression makes avg/std unreliable/absent


def load_gradeable_sections() -> pd.DataFrame:
    """Section-level rows (not OVERALL) with enough students to have a real
    grade distribution, sorted chronologically."""
    df = pd.read_parquet(SECTIONS_PATH)
    df = df[~df["is_overall"]]
    df = df.dropna(subset=["avg", "std_dev", "fail_rate"])
    df = df[df["enrolled"] >= MIN_ENROLLED_FOR_LABEL]
    return df.sort_values("session_order").reset_index(drop=True)


def add_difficulty_label(df: pd.DataFrame) -> pd.DataFrame:
    """Composite difficulty score in [0, 100], higher = harder.

    Built from full-corpus z-scores of (100 - avg), fail_rate, and std_dev.
    Note: this uses whole-dataset statistics to define the label's scale,
    which is fine (the label just needs a stable, interpretable scale) -
    the leakage rule we actually have to respect is on the FEATURES, which
    only ever look at strictly earlier offerings. See add_historical_features.
    """
    df = df.copy()
    avg_z = (df["avg"] - df["avg"].mean()) / df["avg"].std()
    fail_z = (df["fail_rate"] - df["fail_rate"].mean()) / df["fail_rate"].std()
    std_z = (df["std_dev"] - df["std_dev"].mean()) / df["std_dev"].std()
    composite = (-avg_z + fail_z + std_z) / 3
    df[LABEL_COL] = composite.rank(pct=True) * 100
    return df


def add_component_scores(df: pd.DataFrame) -> pd.DataFrame:
    """The four individual signals difficulty_score blends together, kept as
    separate 0-100 percentile-rank columns so a personalized "crunch" score
    can weight them differently per user (see model/predict.py). Same
    full-corpus percentile-rank recipe as difficulty_score, applied to one
    raw column each instead of a z-scored composite.

    classsize_score treats a BIGGER class as a higher score - documented
    assumption (large/anonymous classes read as more "crunch" for many
    students), not a fact; a user who disagrees can weight it near zero.
    """
    df = df.copy()
    df["grade_score"] = (-df["avg"]).rank(pct=True) * 100
    df["failrisk_score"] = df["fail_rate"].rank(pct=True) * 100
    df["variance_score"] = df["std_dev"].rank(pct=True) * 100
    df["classsize_score"] = df["enrolled"].rank(pct=True) * 100
    return df


def _prior_mean_and_count(df: pd.DataFrame, group_cols, value_col: str):
    """For each row, the mean and count of value_col among strictly earlier
    rows (by the df's current order) in the same group. Vectorized via
    cumulative sum/count rather than a slow expanding().apply(lambda)."""
    grouped = df.groupby(group_cols)[value_col]
    cum_sum = grouped.cumsum()
    cum_count = grouped.cumcount()  # count of prior rows in group (0-indexed)
    prior_sum = cum_sum - df[value_col]
    prior_mean = prior_sum / cum_count.replace(0, pd.NA)
    return prior_mean, cum_count


def add_historical_features(df: pd.DataFrame) -> pd.DataFrame:
    """All "hist_*" and "global_running_*" columns: computed strictly from
    offerings earlier in session_order, never the current or future rows."""
    df = df.copy()  # already sorted by session_order by load_gradeable_sections

    df["hist_course_mean_difficulty"], df["hist_course_offerings_count"] = (
        _prior_mean_and_count(df, ["subject", "course"], LABEL_COL)
    )
    df["hist_course_mean_enrolled"], _ = _prior_mean_and_count(df, ["subject", "course"], "enrolled")
    df["hist_subject_mean_difficulty"], df["hist_subject_offerings_count"] = (
        _prior_mean_and_count(df, ["subject"], LABEL_COL)
    )

    has_prof = df["professor"] != ""
    prof_mean, prof_count = _prior_mean_and_count(df.loc[has_prof], ["professor"], LABEL_COL)
    df["hist_professor_mean_difficulty"] = pd.NA
    df["hist_professor_offerings_count"] = 0
    df.loc[has_prof, "hist_professor_mean_difficulty"] = prof_mean
    df.loc[has_prof, "hist_professor_offerings_count"] = prof_count

    cum_sum_all = df[LABEL_COL].cumsum()
    prior_count_all = pd.Series(range(len(df)), index=df.index)
    df["global_running_mean_difficulty"] = (cum_sum_all - df[LABEL_COL]) / prior_count_all.replace(0, pd.NA)

    df["is_first_offering"] = df["hist_course_offerings_count"] == 0
    return df


def add_static_features(df: pd.DataFrame, metadata: StaticCSVMetadataProvider) -> pd.DataFrame:
    df = df.copy()
    leading_digits = df["course"].str.extract(r"^(\d+)")[0]
    course_num = pd.to_numeric(leading_digits, errors="coerce").fillna(0).astype(int)
    df["course_level"] = (course_num // 100 * 100).astype(str)  # "100", "200", ... "0" if unparsable
    df["credits"] = [metadata.get_credits(s, c) for s, c in zip(df["subject"], df["course"])]
    return df


def main():
    sections = load_gradeable_sections()
    sections = add_difficulty_label(sections)
    sections = add_component_scores(sections)
    sections = add_historical_features(sections)
    metadata = StaticCSVMetadataProvider(METADATA_PATH)
    sections = add_static_features(sections, metadata)

    for col in NUMERIC_FEATURE_COLS:
        sections[col] = pd.to_numeric(sections[col], errors="coerce")
    for col in CATEGORICAL_FEATURE_COLS:
        sections[col] = sections[col].astype("category")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    sections.to_parquet(OUT_PATH, index=False)
    print(f"Wrote {len(sections):,} rows to {OUT_PATH}")
    print(f"  first-offering rows (no course history): {sections['is_first_offering'].sum():,}")
    print(f"  year range: {sections['year'].min()}-{sections['year'].max()}")


if __name__ == "__main__":
    main()
