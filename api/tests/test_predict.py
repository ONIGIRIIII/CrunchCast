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


def test_course_history_spans_pair_and_tableau_sources():
    response = client.get("/courses/CPSC/110/history")
    assert response.status_code == 200
    body = response.json()
    assert body["subject"] == "CPSC"
    assert body["course"] == "110"
    terms = body["terms"]
    assert len(terms) > 0
    # most recent term first
    assert terms[0]["year"] >= terms[-1]["year"]
    sources = {t["source"] for t in terms}
    assert "pair" in sources
    assert "tableau_v2" in sources  # confirms coverage extends into the 2022+ era
    # std_dev must be honestly null for tableau_v2 terms, never fabricated
    for t in terms:
        if t["source"] == "tableau_v2":
            assert t["std_dev"] is None


def test_course_history_includes_instructors_and_distribution():
    response = client.get("/courses/CPSC/110/history")
    terms = response.json()["terms"]
    # at least one recent term should have real instructor names
    assert any(len(t["instructors"]) > 0 for t in terms)
    for t in terms:
        assert isinstance(t["instructors"], list)
        if t["available"]:
            assert t["distribution"] is not None
            assert len(t["distribution"]) == 11
            bins = {b["bin"] for b in t["distribution"]}
            assert "<50" in bins and "90-100" in bins
            for b in t["distribution"]:
                assert b["count"] >= 0
        else:
            assert t["distribution"] is None


def test_course_history_unknown_course_returns_empty_list():
    response = client.get("/courses/ZZZZ/999/history")
    assert response.status_code == 200
    assert response.json()["terms"] == []


def test_course_history_includes_instructor_stats_scoped_to_that_term():
    """Instructor stats should be scoped to the specific term, not an
    all-time list, and combined across each instructor's own sections that
    term (e.g. CPSC 110 2016W: Gregor Kiczales taught sections 102 and BCS,
    both should be folded into one row for him, not shown separately)."""
    response = client.get("/courses/CPSC/110/history")
    terms = response.json()["terms"]
    term_2016w = next(t for t in terms if t["year"] == 2016 and t["session"] == "W")
    instructor_stats = term_2016w["instructor_stats"]
    assert len(instructor_stats) > 1  # 2016W had multiple instructors
    names = [s["instructor"] for s in instructor_stats]
    assert len(names) == len(set(names))  # no instructor appears twice
    for s in instructor_stats:
        assert isinstance(s["sections"], list) and len(s["sections"]) > 0
        # "challenge for credit" exam-only sections must never appear as a real choice
        assert not any("CH" in code.upper() for code in s["sections"])
        assert 0.0 <= s["avg"] <= 100.0

    kiczales = next(s for s in instructor_stats if s["instructor"] == "Kiczales, Gregor")
    assert set(kiczales["sections"]) == {"102", "BCS"}


def test_course_history_best_instructor_is_the_highest_average():
    response = client.get("/courses/CPSC/110/history")
    terms = response.json()["terms"]
    term_2016w = next(t for t in terms if t["year"] == 2016 and t["session"] == "W")
    instructor_stats = term_2016w["instructor_stats"]
    assert term_2016w["best_instructor"] == max(instructor_stats, key=lambda s: s["avg"])["instructor"]


def test_course_history_no_best_instructor_with_fewer_than_two_instructors():
    response = client.get("/courses/CPSC/110/history")
    terms = response.json()["terms"]
    for t in terms:
        if len(t["instructor_stats"]) < 2:
            assert t["best_instructor"] is None


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
