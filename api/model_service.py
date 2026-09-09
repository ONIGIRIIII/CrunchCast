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
from predict import CourseDifficultyPredictor  # noqa: E402


@lru_cache(maxsize=1)
def get_predictor() -> CourseDifficultyPredictor:
    """Loaded once per process and reused across requests."""
    return CourseDifficultyPredictor()


def get_catalog() -> dict[str, list[str]]:
    return get_predictor().list_catalog()


def predict_term(course_requests) -> dict:
    """course_requests: iterable of objects with .subject, .course, .session
    (schemas.CourseRequest instances)."""
    predictor = get_predictor()
    predictions = [
        predictor.predict_one(c.subject, c.course, c.session) for c in course_requests
    ]
    return aggregate_term(predictions)
