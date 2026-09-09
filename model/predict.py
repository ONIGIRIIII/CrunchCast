"""Score a course a student might take, using the trained model plus the
full-history lookup tables built by train.py.

This is what the API (Stage 3) will call. Kept independent of FastAPI so it
can also be run/tested standalone.
"""

import json
import sys
from pathlib import Path
from typing import Optional

import lightgbm as lgb
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data" / "scripts"))
from feature_spec import CATEGORICAL_FEATURE_COLS, FEATURE_COLS, NUMERIC_FEATURE_COLS  # noqa: E402
from metadata_provider import StaticCSVMetadataProvider  # noqa: E402

ARTIFACTS_DIR = REPO_ROOT / "model" / "artifacts"
METADATA_CSV_PATH = REPO_ROOT / "data" / "external" / "course_metadata.csv"


class CourseDifficultyPredictor:
    """Loads all artifacts once; call predict_one() per course request."""

    def __init__(self, artifacts_dir: Path = ARTIFACTS_DIR):
        self.booster = lgb.Booster(model_file=str(artifacts_dir / "lightgbm_model.txt"))
        self.model_metadata = json.loads((artifacts_dir / "model_metadata.json").read_text())
        self.course_stats = pd.read_parquet(artifacts_dir / "current_course_stats.parquet")
        self.subject_stats = pd.read_parquet(artifacts_dir / "current_subject_stats.parquet")
        self.global_mean_difficulty = self.model_metadata["global_mean_difficulty"]
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
        and otherwise left missing; LightGBM handles missing features
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

    def predict_one(self, subject: str, course: str, session: str = "W") -> dict:
        row = self.build_feature_row(subject, course, session)
        feature_frame = pd.DataFrame([row])[FEATURE_COLS]
        for col in NUMERIC_FEATURE_COLS:
            feature_frame[col] = pd.to_numeric(feature_frame[col], errors="coerce")
        for col in CATEGORICAL_FEATURE_COLS:
            feature_frame[col] = feature_frame[col].astype("category")
        difficulty_score = float(self.booster.predict(feature_frame)[0])
        difficulty_score = max(0.0, min(100.0, difficulty_score))

        if row["_known_course"]:
            confidence = "high" if row["hist_course_offerings_count"] >= 5 else "medium"
        elif row["_known_subject"]:
            confidence = "low"
        else:
            confidence = "very_low"

        return {
            "subject": subject.strip().upper(),
            "course": course.strip().upper(),
            "difficulty_score": round(difficulty_score, 1),
            "confidence": confidence,
            "historical_offerings_count": row["hist_course_offerings_count"],
            "credits": row["credits"],
        }


if __name__ == "__main__":
    predictor = CourseDifficultyPredictor()
    for subj, num in [("CPSC", "110"), ("MATH", "100"), ("ENGL", "110"), ("ZZZZ", "999")]:
        print(predictor.predict_one(subj, num))
