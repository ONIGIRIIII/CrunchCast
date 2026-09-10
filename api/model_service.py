"""Loads the trained model once and exposes it to the API layer.

Keeps FastAPI-specific code (main.py, schemas.py) separate from the
model/aggregation logic in model/predict.py and model/aggregate.py, which
have no FastAPI dependency and can be run/tested standalone.
"""

import sys
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "model"))
from aggregate import aggregate_term  # noqa: E402
from history import CourseHistoryProvider  # noqa: E402
from predict import CourseDifficultyPredictor  # noqa: E402


@lru_cache(maxsize=1)
def get_predictor() -> CourseDifficultyPredictor:
    """Loaded once per process and reused across requests."""
    return CourseDifficultyPredictor()


@lru_cache(maxsize=1)
def get_history_provider() -> CourseHistoryProvider:
    """Loaded once per process; separate from the predictor since it reads
    a different table (course_term_stats.parquet, display-only, not used
    for prediction)."""
    return CourseHistoryProvider()


def _course_sort_key(course: str):
    digits = "".join(ch for ch in course if ch.isdigit())
    return (int(digits) if digits else 0, course)


def get_catalog() -> dict[str, list[str]]:
    """Union of the predictor's catalog (courses with PAIR-era, <=2016W
    history - what the model has real training data for) and the history
    provider's catalog (courses with ANY term-history data, 1996-2025).

    These differ: a course introduced after 2016 (e.g. CPSC 330, first
    offered 2019W per the Tableau data) has real history-browser data but
    zero PAIR-era offerings, so it was missing from search entirely when
    this only used the predictor's catalog. The predictor can still score
    such a course (falling back to subject/global estimates - see
    predict.py), so it belongs in the search catalog too. See
    data/README.md for why these two data windows differ."""
    predictor_catalog = get_predictor().list_catalog()
    history_catalog = get_history_provider().list_catalog()

    merged: dict[str, set[str]] = {}
    for catalog in (predictor_catalog, history_catalog):
        for subject, courses in catalog.items():
            merged.setdefault(subject, set()).update(courses)

    return {
        subject: sorted(courses, key=_course_sort_key)
        for subject, courses in sorted(merged.items())
    }


def get_course_history(subject: str, course: str) -> list[dict]:
    return get_history_provider().get_history(subject, course)


def predict_term(course_requests, weights=None) -> dict:
    """course_requests: iterable of objects with .subject, .course, .session
    (schemas.CourseRequest instances). weights: schemas.Weights instance or
    None - same weights applied to every course in the request."""
    predictor = get_predictor()
    weights_dict = weights.model_dump() if weights is not None else None
    predictions = [
        predictor.predict_one(c.subject, c.course, c.session, weights=weights_dict)
        for c in course_requests
    ]
    return aggregate_term(predictions)
