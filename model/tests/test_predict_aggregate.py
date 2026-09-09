import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aggregate import aggregate_term  # noqa: E402
from predict import CourseDifficultyPredictor  # noqa: E402


@pytest.fixture(scope="module")
def predictor():
    return CourseDifficultyPredictor()


def test_known_course_predicts_in_range(predictor):
    result = predictor.predict_one("CPSC", "110")
    assert 0.0 <= result["difficulty_score"] <= 100.0
    assert result["confidence"] == "high"
    assert result["historical_offerings_count"] > 0


def test_unknown_course_falls_back_gracefully(predictor):
    result = predictor.predict_one("ZZZZ", "999")
    assert 0.0 <= result["difficulty_score"] <= 100.0
    assert result["confidence"] == "very_low"
    assert result["historical_offerings_count"] == 0


def test_aggregate_term_is_credit_weighted(predictor):
    easy = predictor.predict_one("ZZZZ", "111")  # unknown -> falls back near global mean
    courses = [easy, easy]
    result = aggregate_term(courses)
    assert result["n_courses"] == 2
    assert result["total_credits"] == easy["credits"] * 2
    assert result["term_difficulty_score"] == pytest.approx(easy["difficulty_score"], abs=0.2)


def test_aggregate_term_rejects_empty_list():
    with pytest.raises(ValueError):
        aggregate_term([])
