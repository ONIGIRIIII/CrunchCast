import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_courses_catalog():
    response = client.get("/courses")
    assert response.status_code == 200
    subjects = response.json()["subjects"]
    assert "CPSC" in subjects
    assert "110" in subjects["CPSC"]


def test_predict_known_courses():
    response = client.post(
        "/predict",
        json={"courses": [{"subject": "CPSC", "course": "110"}, {"subject": "MATH", "course": "100"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["n_courses"] == 2
    assert len(body["courses"]) == 2
    for course in body["courses"]:
        assert 0.0 <= course["difficulty_score"] <= 100.0


def test_predict_rejects_empty_course_list():
    response = client.post("/predict", json={"courses": []})
    assert response.status_code == 422


def test_predict_response_includes_explanation():
    response = client.post("/predict", json={"courses": [{"subject": "CPSC", "course": "110"}]})
    explanation = response.json()["courses"][0]["explanation"]
    assert {e["key"] for e in explanation} == {"grade", "failrisk", "variance", "classsize"}
    for e in explanation:
        assert 0.0 <= e["score"] <= 100.0
        assert e["detail"]


def test_predict_rejects_more_than_five_courses():
    courses = [{"subject": "CPSC", "course": "110"}] * 6
    response = client.post("/predict", json={"courses": courses})
    assert response.status_code == 422


def test_predict_accepts_five_courses():
    courses = [
        {"subject": "CPSC", "course": "110"},
        {"subject": "MATH", "course": "100"},
        {"subject": "ENGL", "course": "110"},
        {"subject": "PHYS", "course": "101"},
        {"subject": "CHEM", "course": "121"},
    ]
    response = client.post("/predict", json={"courses": courses})
    assert response.status_code == 200
    assert response.json()["n_courses"] == 5


def test_predict_unknown_course_still_responds():
    response = client.post("/predict", json={"courses": [{"subject": "ZZZZ", "course": "999"}]})
    assert response.status_code == 200
    assert response.json()["courses"][0]["confidence"] == "very_low"


def test_predict_without_weights_omits_personalized_fields():
    response = client.post("/predict", json={"courses": [{"subject": "CPSC", "course": "110"}]})
    body = response.json()
    assert "term_personalized_score" not in body or body["term_personalized_score"] is None
    assert body["courses"][0].get("personalized_score") is None


def test_predict_with_weights_returns_personalized_fields():
    response = client.post(
        "/predict",
        json={
            "courses": [{"subject": "CPSC", "course": "110"}],
            "weights": {"grade": 0, "failrisk": 0, "variance": 0, "classsize": 1},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["term_personalized_score"] is not None
    assert body["courses"][0]["personalized_score"] is not None


def test_predict_different_weights_give_different_personalized_scores():
    def predict_with(weights):
        response = client.post(
            "/predict",
            json={"courses": [{"subject": "CPSC", "course": "110"}], "weights": weights},
        )
        return response.json()["courses"][0]["personalized_score"]

    only_classsize = predict_with({"grade": 0, "failrisk": 0, "variance": 0, "classsize": 1})
    only_failrisk = predict_with({"grade": 0, "failrisk": 1, "variance": 0, "classsize": 0})
    assert only_classsize != only_failrisk
