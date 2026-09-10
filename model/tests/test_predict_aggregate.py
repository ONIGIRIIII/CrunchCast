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


def test_explanation_has_four_components_with_scores_and_details(predictor):
    result = predictor.predict_one("CPSC", "110")
    explanation = result["explanation"]
    assert {e["key"] for e in explanation} == {"grade", "failrisk", "variance", "classsize"}
    for e in explanation:
        assert 0.0 <= e["score"] <= 100.0
        assert isinstance(e["label"], str) and e["label"]
        assert isinstance(e["detail"], str) and e["detail"]


def test_explanation_present_even_without_weights(predictor):
    result = predictor.predict_one("MATH", "100")
    assert "explanation" in result
    assert len(result["explanation"]) == 4


def test_explanation_falls_back_gracefully_for_unknown_course(predictor):
    result = predictor.predict_one("ZZZZ", "888")
    explanation = result["explanation"]
    assert len(explanation) == 4
    for e in explanation:
        assert 0.0 <= e["score"] <= 100.0


def test_list_catalog_includes_known_course(predictor):
    catalog = predictor.list_catalog()
    assert "CPSC" in catalog
    assert "110" in catalog["CPSC"]
    assert catalog == dict(sorted(catalog.items()))  # subjects alphabetical


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


def test_predict_one_without_weights_has_no_personalized_score(predictor):
    result = predictor.predict_one("CPSC", "110")
    assert "personalized_score" not in result


def test_personalized_score_responds_to_weights(predictor):
    """A course with a big enrollment but a fine grade/fail history should
    score higher when the user only cares about class size than when they
    only care about fail risk."""
    only_classsize = predictor.predict_one(
        "CPSC", "110", weights={"grade": 0, "failrisk": 0, "variance": 0, "classsize": 1}
    )
    only_failrisk = predictor.predict_one(
        "CPSC", "110", weights={"grade": 0, "failrisk": 1, "variance": 0, "classsize": 0}
    )
    assert "personalized_score" in only_classsize
    assert only_classsize["personalized_score"] != only_failrisk["personalized_score"]


def test_personalized_score_falls_back_to_equal_weights_when_all_zero(predictor):
    zero_weights = predictor.predict_one(
        "CPSC", "110", weights={"grade": 0, "failrisk": 0, "variance": 0, "classsize": 0}
    )
    equal_weights = predictor.predict_one(
        "CPSC", "110", weights={"grade": 0.25, "failrisk": 0.25, "variance": 0.25, "classsize": 0.25}
    )
    assert zero_weights["personalized_score"] == equal_weights["personalized_score"]


def test_aggregate_term_includes_personalized_score_when_present(predictor):
    weights = {"grade": 1, "failrisk": 0, "variance": 0, "classsize": 0}
    course = predictor.predict_one("CPSC", "110", weights=weights)
    result = aggregate_term([course])
    assert "term_personalized_score" in result
    assert result["term_personalized_score"] == course["personalized_score"]


def test_aggregate_term_omits_personalized_score_when_absent(predictor):
    course = predictor.predict_one("CPSC", "110")
    result = aggregate_term([course])
    assert "term_personalized_score" not in result
