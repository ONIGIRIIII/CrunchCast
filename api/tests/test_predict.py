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


def test_predict_unknown_course_still_responds():
    response = client.post("/predict", json={"courses": [{"subject": "ZZZZ", "course": "999"}]})
    assert response.status_code == 200
    assert response.json()["courses"][0]["confidence"] == "very_low"
