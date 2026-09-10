"""Raw per-term grade stats for a course, e.g. "CPSC 110 in 2015W: avg 73.25,
std dev 17.12, high 100, low 9, fail rate 13.5%, enrolled 1405."

Deliberately separate from predict.py: doesn't touch the model or the
aggregated "current stats" lookup tables, just serves real historical
numbers from data/processed/course_term_stats.parquet (built by
data/scripts/clean_tableau_data.py) so a user can pick a specific term and
see the actual figures, the way ubcgrades.com does - spanning 1996 through
whatever's most recently available (currently 2025W), even though the
PREDICTOR itself only ever uses PAIR Reports data through 2016W. See
data/README.md for why those two things are allowed to cover different
windows.
"""

from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
COURSE_TERM_STATS_PATH = REPO_ROOT / "data" / "processed" / "course_term_stats.parquet"


class CourseHistoryProvider:
    """Loads the course-term stats table once; call get_history() per course."""

    def __init__(self, course_term_stats_path: Path = COURSE_TERM_STATS_PATH):
        stats = pd.read_parquet(course_term_stats_path)
        stats["session_label"] = stats["session"].map({"W": "Winter", "S": "Summer"})
        self._stats = stats.sort_values("session_order", ascending=False)

    def get_history(self, subject: str, course: str) -> list[dict]:
        subject = subject.strip().upper()
        course = course.strip().upper()
        rows = self._stats[(self._stats["subject"] == subject) & (self._stats["course"] == course)]

        terms = []
        for _, row in rows.iterrows():
            has_data = pd.notna(row["avg"])
            terms.append({
                "year": int(row["year"]),
                "session": row["session"],
                "session_label": row["session_label"],
                "available": bool(has_data),
                "enrolled": int(row["enrolled"]) if pd.notna(row["enrolled"]) else None,
                "avg": round(float(row["avg"]), 1) if has_data else None,
                "std_dev": round(float(row["std_dev"]), 1) if pd.notna(row["std_dev"]) else None,
                "high": float(row["high"]) if pd.notna(row["high"]) else None,
                "low": float(row["low"]) if pd.notna(row["low"]) else None,
                "fail_rate": round(float(row["fail_rate"]) * 100, 1) if pd.notna(row["fail_rate"]) else None,
                "source": row["source"],
            })
        return terms


if __name__ == "__main__":
    provider = CourseHistoryProvider()
    for t in provider.get_history("CPSC", "110")[:5]:
        print(t)
