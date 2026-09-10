"""Per-instructor historical grade stats within a course - the legitimate
half of a RateMyProfessors-style comparison, built entirely from grade data
this project already has (see the project plan for why scraping RMP itself
was declined: its Terms of Use explicitly prohibit automated access, unlike
the openly-hosted grade data this project uses elsewhere).

Deliberately separate from predict.py, same as history.py: doesn't touch
the model, reads data/processed/instructor_course_stats.parquet (built by
data/scripts/clean_instructor_stats.py), which is never read by
build_features.py/train.py/predict.py either.

This is NOT a teaching-quality judgment. It's correlational grade history -
self-selection, exam difficulty vs. teaching style, TA effects, and course
changes over time all confound it. The API/frontend copy says this
explicitly rather than implying "best."
"""

from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
INSTRUCTOR_STATS_PATH = REPO_ROOT / "data" / "processed" / "instructor_course_stats.parquet"


class InstructorStatsProvider:
    """Loads the instructor-course stats table once; call get_instructors()
    per course."""

    def __init__(self, instructor_stats_path: Path = INSTRUCTOR_STATS_PATH):
        self._stats = pd.read_parquet(instructor_stats_path)

    def get_instructors(self, subject: str, course: str) -> list[dict]:
        subject = subject.strip().upper()
        course = course.strip().upper()
        rows = self._stats[(self._stats["subject"] == subject) & (self._stats["course"] == course)]
        rows = rows.sort_values("avg", ascending=False)

        instructors = []
        for _, row in rows.iterrows():
            instructors.append({
                "instructor": row["instructor_display"],
                "avg": round(float(row["avg"]), 1),
                "std_dev": round(float(row["std_dev"]), 1) if pd.notna(row["std_dev"]) else None,
                "fail_rate": round(float(row["fail_rate"]) * 100, 1),
                "enrolled_total": int(row["enrolled_total"]),
                "n_offerings": int(row["n_offerings"]),
                "first_year": int(row["first_year"]),
                "last_year": int(row["last_year"]),
            })
        return instructors


if __name__ == "__main__":
    provider = InstructorStatsProvider()
    for i in provider.get_instructors("CPSC", "110")[:5]:
        print(i)
