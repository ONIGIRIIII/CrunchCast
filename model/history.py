"""Raw per-term grade stats for a course, e.g. "CPSC 110 in 2015W: avg 73.25,
std dev 17.12, high 100, low 9, fail rate 13.5%, enrolled 1405" - plus, for
that same term, both the individual SECTIONS offered (with their own
instructor(s)/stats, for picking one specific section) and per-INSTRUCTOR
stats combined across every section they taught that term (for the
"Overall" comparison) - both derived from
data/processed/course_section_stats.parquet, built by
data/scripts/clean_section_stats.py.

Deliberately separate from predict.py: doesn't touch the model or the
aggregated "current stats" lookup tables, just serves real historical
numbers so a user can pick a specific term - and within it, a specific
SECTION (own stats + instructor name(s), no combining), or "Overall" to
compare that term's actual INSTRUCTORS against each other (each
instructor's sections that term combined into one row) - the way
ubcgrades.com does. Spans 1996 through whatever's most recently available
(currently 2025W), even though the PREDICTOR itself only ever uses PAIR
Reports data through 2016W. See data/README.md for why those two things
are allowed to cover different windows.

Combining across sections for the Overall comparison (rather than showing
each section on its own row): a student cares about "how has this
professor graded this term," not about how a course happens to be split
into lecture/lab codes. Sections are enrollment-weighted-combined per
instructor (std_dev only over sections that report one); a co-taught
section's stats count fully toward each listed instructor, same documented
simplification used everywhere else in this project.

"Best instructor" is deliberately simple (highest combined average grade
that term, only computed when there are 2+ instructors to compare) and is
not a teaching-quality judgment - see data/README.md.

Each section also carries its own 11-bin grade distribution (same shape as
the term-level one), so a specific section's own distribution chart can be
shown, not just the term's blended one.
"""

import sys
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data" / "scripts"))
from grade_bins import BIN_COLS, BIN_LABELS  # noqa: E402

COURSE_TERM_STATS_PATH = REPO_ROOT / "data" / "processed" / "course_term_stats.parquet"
COURSE_SECTION_STATS_PATH = REPO_ROOT / "data" / "processed" / "course_section_stats.parquet"


def _distribution_from_row(row) -> list[dict] | None:
    if pd.isna(row["avg"]):
        return None
    return [{"bin": BIN_LABELS[col], "count": int(row[col]) if pd.notna(row[col]) else 0} for col in BIN_COLS]


class CourseHistoryProvider:
    """Loads the course-term and course-section stats tables once; call
    get_history() per course."""

    def __init__(
        self,
        course_term_stats_path: Path = COURSE_TERM_STATS_PATH,
        course_section_stats_path: Path = COURSE_SECTION_STATS_PATH,
    ):
        stats = pd.read_parquet(course_term_stats_path)
        stats["session_label"] = stats["session"].map({"W": "Winter", "S": "Summer"})
        self._stats = stats.sort_values("session_order", ascending=False)
        self._sections = pd.read_parquet(course_section_stats_path)

    def list_catalog(self) -> dict[str, list[str]]:
        """All (subject, course) pairs with ANY term-history data
        (1996-2025), regardless of whether the predictor has PAIR-era
        (<=2016W) offerings for them. Merged with the predictor's own,
        narrower catalog in api/model_service.py::get_catalog() - see that
        function's docstring for why courses introduced after 2016 need
        this table to show up in search at all."""
        catalog: dict[str, list[str]] = {}
        for subject, group in self._stats.groupby("subject"):
            catalog[subject] = sorted(group["course"].unique().tolist())
        return catalog

    def _sections_for_term(self, subject: str, course: str, year: int, session: str) -> list[dict]:
        rows = self._sections[
            (self._sections["subject"] == subject)
            & (self._sections["course"] == course)
            & (self._sections["year"] == year)
            & (self._sections["session"] == session)
        ].sort_values("avg", ascending=False)

        return [
            {
                "section": row["section"],
                "instructors": list(row["instructors"]) if row["instructors"] is not None and len(row["instructors"]) else [],
                "avg": round(float(row["avg"]), 1),
                "std_dev": round(float(row["std_dev"]), 1) if pd.notna(row["std_dev"]) else None,
                "fail_rate": round(float(row["fail_rate"]) * 100, 1),
                "enrolled": int(row["enrolled"]),
                "distribution": _distribution_from_row(row),
            }
            for _, row in rows.iterrows()
        ]

    def _instructor_stats_for_term(self, subject: str, course: str, year: int, session: str) -> list[dict]:
        rows = self._sections[
            (self._sections["subject"] == subject)
            & (self._sections["course"] == course)
            & (self._sections["year"] == year)
            & (self._sections["session"] == session)
        ]

        # Explode co-taught sections so each listed instructor gets that
        # section's full stats attributed to them (documented simplification
        # - the data doesn't say who taught which part).
        exploded = []
        for _, row in rows.iterrows():
            names = row["instructors"]
            if names is None or len(names) == 0:
                continue  # can't attribute an unlisted-instructor section to anyone
            for name in names:
                exploded.append({
                    "instructor": name,
                    "section": row["section"],
                    "avg": float(row["avg"]),
                    "std_dev": float(row["std_dev"]) if pd.notna(row["std_dev"]) else None,
                    "fail_rate": float(row["fail_rate"]),
                    "enrolled": float(row["enrolled"]),
                })
        if not exploded:
            return []

        exploded_df = pd.DataFrame(exploded)
        results = []
        for instructor, group in exploded_df.groupby("instructor"):
            total_enrolled = group["enrolled"].sum()
            avg = (group["avg"] * group["enrolled"]).sum() / total_enrolled
            fail_rate = (group["fail_rate"] * group["enrolled"]).sum() / total_enrolled
            std_rows = group.dropna(subset=["std_dev"])
            std_dev = (
                (std_rows["std_dev"] * std_rows["enrolled"]).sum() / std_rows["enrolled"].sum()
                if len(std_rows) > 0
                else None
            )
            results.append({
                "instructor": instructor,
                "sections": sorted(group["section"].tolist()),
                "avg": round(float(avg), 1),
                "std_dev": round(float(std_dev), 1) if std_dev is not None else None,
                "fail_rate": round(float(fail_rate) * 100, 1),
                "enrolled": int(total_enrolled),
            })

        results.sort(key=lambda r: r["avg"], reverse=True)
        return results

    def get_history(self, subject: str, course: str) -> list[dict]:
        subject = subject.strip().upper()
        course = course.strip().upper()
        rows = self._stats[(self._stats["subject"] == subject) & (self._stats["course"] == course)]

        terms = []
        for _, row in rows.iterrows():
            has_data = pd.notna(row["avg"])
            distribution = _distribution_from_row(row)
            instructors = row["instructors"]
            sections = self._sections_for_term(subject, course, int(row["year"]), row["session"])
            instructor_stats = self._instructor_stats_for_term(subject, course, int(row["year"]), row["session"])
            best_instructor = instructor_stats[0]["instructor"] if len(instructor_stats) >= 2 else None

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
                "instructors": list(instructors) if instructors is not None and len(instructors) else [],
                "distribution": distribution,
                "sections": sections,
                "instructor_stats": instructor_stats,
                "best_instructor": best_instructor,
                "source": row["source"],
            })
        return terms


if __name__ == "__main__":
    provider = CourseHistoryProvider()
    for t in provider.get_history("CPSC", "110")[:2]:
        print(t)
