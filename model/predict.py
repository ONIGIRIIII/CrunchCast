"""Score a course a student might take, using the trained model plus the
full-history lookup tables built by train.py.

This is what the API (Stage 3) will call. Kept independent of FastAPI so it
can also be run/tested standalone.

Also supports personalized "crunch" scoring (Stage 6): predict_one()'s
optional `weights` argument combines four real historical signals (grade
impact, fail risk, grade variance, class size) using per-user weights from
a quiz. This is NOT a retrained model - there's no per-user ground truth to
train against - it's a plain weighted average of numbers the model's own
historical lookup tables already contain. See WEIGHT_TO_COMPONENT below and
data/README.md for the full reasoning.
"""

import json
import sys
from pathlib import Path
from typing import Optional

import pandas as pd
import xgboost as xgb

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data" / "scripts"))
from feature_spec import (  # noqa: E402
    CATEGORICAL_FEATURE_COLS,
    COMPONENT_SCORE_COLS,
    FEATURE_COLS,
    NUMERIC_FEATURE_COLS,
    RAW_EXPLANATION_COLS,
)
from metadata_provider import StaticCSVMetadataProvider  # noqa: E402

ARTIFACTS_DIR = REPO_ROOT / "model" / "artifacts"
METADATA_CSV_PATH = REPO_ROOT / "data" / "external" / "course_metadata.csv"

# Maps a personalization weight key (what the quiz produces) to the
# corresponding COMPONENT_SCORE_COLS column computed in build_features.py.
WEIGHT_TO_COMPONENT = {
    "grade": "grade_score",
    "failrisk": "failrisk_score",
    "variance": "variance_score",
    "classsize": "classsize_score",
}
DEFAULT_WEIGHTS = {key: 0.25 for key in WEIGHT_TO_COMPONENT}

# Human-readable labels + raw-number formatting for the "why" breakdown
# (see CourseDifficultyPredictor._explain). Each entry pairs a personalization
# weight key with the raw historical column it explains and a formatter that
# turns that raw number into a short, plain-English detail string.
EXPLANATION_SPECS = [
    {"key": "grade", "label": "Grade impact", "raw_col": "avg",
     "format": lambda v: f"{v:.0f}% average grade historically"},
    {"key": "failrisk", "label": "Fail risk", "raw_col": "fail_rate",
     "format": lambda v: f"{v * 100:.0f}% of students historically fail"},
    {"key": "variance", "label": "Grading unpredictability", "raw_col": "std_dev",
     "format": lambda v: f"grades typically spread ±{v:.0f} points"},
    {"key": "classsize", "label": "Class size", "raw_col": "enrolled",
     "format": lambda v: f"~{v:.0f} students historically"},
]


class CourseDifficultyPredictor:
    """Loads all artifacts once; call predict_one() per course request."""

    def __init__(self, artifacts_dir: Path = ARTIFACTS_DIR):
        self.booster = xgb.Booster()
        self.booster.load_model(str(artifacts_dir / "xgboost_model.json"))
        self.model_metadata = json.loads((artifacts_dir / "model_metadata.json").read_text())
        self.course_stats = pd.read_parquet(artifacts_dir / "current_course_stats.parquet")
        self.subject_stats = pd.read_parquet(artifacts_dir / "current_subject_stats.parquet")
        self.global_mean_difficulty = self.model_metadata["global_mean_difficulty"]
        self.global_mean_component = self.model_metadata["global_mean_component"]
        self.global_mean_raw = self.model_metadata["global_mean_raw"]
        self.global_mean_enrolled = self.model_metadata["global_mean_enrolled"]
        self.categorical_categories = self.model_metadata["categorical_categories"]
        self.course_metadata = StaticCSVMetadataProvider(METADATA_CSV_PATH)

    def _course_row(self, subject: str, course: str) -> Optional[pd.Series]:
        match = self.course_stats[
            (self.course_stats["subject"] == subject) & (self.course_stats["course"] == course)
        ]
        return match.iloc[0] if len(match) else None

    def _subject_row(self, subject: str) -> Optional[pd.Series]:
        match = self.subject_stats[self.subject_stats["subject"] == subject]
        return match.iloc[0] if len(match) else None

    def build_feature_row(self, subject: str, course: str, session: str = "W") -> dict:
        """Assembles one row of FEATURE_COLS for a course a student is
        considering, using the best available historical estimate (course
        history, falling back to subject history, falling back to global).

        `professor` and enrollment for the SPECIFIC upcoming offering are
        unknown ahead of time, so hist_professor_* and hist_course_mean_enrolled
        are populated from history where available (course/subject level)
        and otherwise left missing; XGBoost handles missing features
        natively rather than us guessing a value.
        """
        subject = subject.strip().upper()
        course = course.strip().upper()

        course_row = self._course_row(subject, course)
        subject_row = self._subject_row(subject)

        if course_row is not None:
            hist_course_mean_difficulty = course_row["current_mean_difficulty"]
            hist_course_offerings_count = int(course_row["current_offerings_count"])
            hist_course_mean_enrolled = course_row["current_mean_enrolled"]
            course_level = course_row["course_level"]
            credits = int(course_row["credits"])
            known_course = True
        else:
            hist_course_mean_difficulty = None
            hist_course_offerings_count = 0
            hist_course_mean_enrolled = None
            course_level = str((int(course[:3]) // 100 * 100) if course[:3].isdigit() else 0)
            credits = self.course_metadata.get_credits(subject, course)
            known_course = False

        if subject_row is not None:
            hist_subject_mean_difficulty = subject_row["current_mean_difficulty"]
            hist_subject_offerings_count = int(subject_row["current_offerings_count"])
        else:
            hist_subject_mean_difficulty = None
            hist_subject_offerings_count = 0

        return {
            "subject": subject,
            "course": course,
            "course_level": course_level,
            "session": session,
            "credits": credits,
            "hist_course_mean_difficulty": hist_course_mean_difficulty,
            "hist_course_offerings_count": hist_course_offerings_count,
            "hist_course_mean_enrolled": hist_course_mean_enrolled,
            "hist_subject_mean_difficulty": hist_subject_mean_difficulty,
            "hist_subject_offerings_count": hist_subject_offerings_count,
            "hist_professor_mean_difficulty": None,  # unknown instructor for a future offering
            "hist_professor_offerings_count": 0,
            "global_running_mean_difficulty": self.global_mean_difficulty,
            "_known_course": known_course,
            "_known_subject": subject_row is not None,
            "_course_row": course_row,
            "_subject_row": subject_row,
        }

    def list_catalog(self) -> dict[str, list[str]]:
        """All (subject, course) pairs we have historical data for, grouped
        by subject and sorted by course number. Used to populate a
        browse-by-subject UI rather than requiring free-text entry."""

        def course_sort_key(course: str):
            digits = "".join(ch for ch in course if ch.isdigit())
            return (int(digits) if digits else 0, course)

        catalog: dict[str, list[str]] = {}
        for subject, group in self.course_stats.groupby("subject"):
            catalog[subject] = sorted(group["course"].tolist(), key=course_sort_key)
        return dict(sorted(catalog.items()))

    def _component_value(self, row: dict, weight_key: str) -> float:
        """Course -> subject -> global fallback chain for ONE personalization
        component, mirroring the same fallback pattern build_feature_row
        already uses for the objective score's historical features."""
        component_col = WEIGHT_TO_COMPONENT[weight_key]
        stat_col = f"current_mean_{component_col}"
        if row["_course_row"] is not None:
            return float(row["_course_row"][stat_col])
        if row["_subject_row"] is not None:
            return float(row["_subject_row"][stat_col])
        return float(self.global_mean_component[component_col])

    def _raw_value(self, row: dict, raw_col: str) -> float:
        """Same course -> subject -> global fallback chain as
        _component_value, but for the human-readable raw number (average
        grade, fail rate, std dev, enrolled) instead of its percentile rank."""
        stat_col = f"current_mean_{raw_col}"
        if row["_course_row"] is not None:
            return float(row["_course_row"][stat_col])
        if row["_subject_row"] is not None:
            return float(row["_subject_row"][stat_col])
        if raw_col == "enrolled":
            return float(self.global_mean_enrolled)
        return float(self.global_mean_raw[raw_col])

    def _explain(self, row: dict) -> list[dict]:
        """The four real signals behind both difficulty_score and
        personalized_score, each with its 0-100 percentile (for a bar chart)
        and a plain-English detail string (for the number behind the bar).
        Always computed, independent of whether personalization weights were
        supplied - this explains the OBJECTIVE score just as much as a
        personalized one."""
        explanation = []
        for spec in EXPLANATION_SPECS:
            raw_value = self._raw_value(row, spec["raw_col"])
            explanation.append({
                "key": spec["key"],
                "label": spec["label"],
                "score": round(self._component_value(row, spec["key"]), 1),
                "detail": spec["format"](raw_value),
            })
        return explanation

    def _personalized_score(self, row: dict, weights: dict) -> float:
        """Weighted combination of the four real historical components -
        no model involved, just arithmetic over numbers we already computed
        (see data/README.md and the Stage 6 planning notes for why this is
        deliberately NOT a per-user retrained model)."""
        total_weight = sum(max(0.0, w) for w in weights.values())
        if total_weight <= 0:
            weights = DEFAULT_WEIGHTS
            total_weight = 1.0
        score = sum(
            max(0.0, weights.get(key, 0.0)) * self._component_value(row, key)
            for key in WEIGHT_TO_COMPONENT
        )
        return max(0.0, min(100.0, score / total_weight))

    def predict_one(self, subject: str, course: str, session: str = "W", weights: Optional[dict] = None) -> dict:
        row = self.build_feature_row(subject, course, session)
        feature_frame = pd.DataFrame([row])[FEATURE_COLS]
        for col in NUMERIC_FEATURE_COLS:
            feature_frame[col] = pd.to_numeric(feature_frame[col], errors="coerce")
        for col in CATEGORICAL_FEATURE_COLS:
            # Align to the exact training-time category vocabulary: a value
            # never seen in training (e.g. a made-up subject) becomes NaN
            # here rather than erroring, and XGBoost treats NaN as a normal
            # missing value, falling back on the historical numeric features.
            # (Explicitly null out unseen values first so pandas doesn't warn
            # about constructing a Categorical with out-of-vocabulary entries.)
            valid_categories = self.categorical_categories[col]
            known_only = feature_frame[col].where(feature_frame[col].isin(valid_categories))
            feature_frame[col] = pd.Categorical(known_only, categories=valid_categories)
        dmatrix = xgb.DMatrix(feature_frame, enable_categorical=True)
        difficulty_score = float(self.booster.predict(dmatrix)[0])
        difficulty_score = max(0.0, min(100.0, difficulty_score))

        if row["_known_course"]:
            confidence = "high" if row["hist_course_offerings_count"] >= 5 else "medium"
        elif row["_known_subject"]:
            confidence = "low"
        else:
            confidence = "very_low"

        result = {
            "subject": subject.strip().upper(),
            "course": course.strip().upper(),
            "difficulty_score": round(difficulty_score, 1),
            "confidence": confidence,
            "historical_offerings_count": row["hist_course_offerings_count"],
            "credits": row["credits"],
            "explanation": self._explain(row),
        }
        if weights is not None:
            result["personalized_score"] = round(self._personalized_score(row, weights), 1)
        return result


if __name__ == "__main__":
    predictor = CourseDifficultyPredictor()
    for subj, num in [("CPSC", "110"), ("MATH", "100"), ("ENGL", "110"), ("ZZZZ", "999")]:
        print(predictor.predict_one(subj, num))
    print("\nPersonalized (only cares about class size):")
    print(predictor.predict_one("CPSC", "110", weights={"grade": 0, "failrisk": 0, "variance": 0, "classsize": 1}))
    print("Personalized (only cares about fail risk):")
    print(predictor.predict_one("CPSC", "110", weights={"grade": 0, "failrisk": 1, "variance": 0, "classsize": 0}))
