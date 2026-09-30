"""Abuse protection: the per-client rate limiter and request validation."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from rate_limit import RateLimiter  # noqa: E402

client = TestClient(main.app)


# ---- RateLimiter itself ----------------------------------------------------

def test_rate_limiter_allows_up_to_limit_then_blocks():
    limiter = RateLimiter(limit=3, window=60)
    assert [limiter.check("a", now=t) for t in (0, 1, 2)] == [0, 0, 0]
    # 4th request inside the window is refused, retry once the oldest ages out
    assert limiter.check("a", now=3) == 57


def test_rate_limiter_window_slides():
    limiter = RateLimiter(limit=2, window=10)
    limiter.check("a", now=0)
    limiter.check("a", now=5)
    assert limiter.check("a", now=9) > 0
    # the request at t=0 has left the window by t=10
    assert limiter.check("a", now=10) == 0


def test_rate_limiter_tracks_clients_separately():
    limiter = RateLimiter(limit=1, window=60)
    assert limiter.check("a", now=0) == 0
    assert limiter.check("a", now=1) > 0
    assert limiter.check("b", now=1) == 0


def test_rate_limiter_rejected_requests_dont_extend_the_block():
    limiter = RateLimiter(limit=1, window=10)
    limiter.check("a", now=0)
    for t in range(1, 10):
        assert limiter.check("a", now=t) > 0
    assert limiter.check("a", now=10) == 0


def test_rate_limiter_zero_limit_disables_it():
    limiter = RateLimiter(limit=0, window=60)
    assert all(limiter.check("a", now=t) == 0 for t in range(100))


# ---- Middleware ------------------------------------------------------------

def test_api_returns_429_once_a_client_is_over_the_limit(monkeypatch):
    monkeypatch.setattr(main, "rate_limiter", RateLimiter(limit=2, window=60))
    assert client.get("/courses").status_code == 200
    assert client.get("/courses").status_code == 200
    limited = client.get("/courses", headers={"Origin": "http://localhost:3000"})
    assert limited.status_code == 429
    assert int(limited.headers["Retry-After"]) >= 1
    assert "Too many requests" in limited.json()["detail"]
    # CORS wraps the limiter, so a browser can actually read the 429 body
    # and show the "try again" message instead of a generic network error.
    assert limited.headers.get("access-control-allow-origin") == "*"


def test_health_is_never_rate_limited(monkeypatch):
    monkeypatch.setattr(main, "rate_limiter", RateLimiter(limit=1, window=60))
    for _ in range(5):
        assert client.get("/health").status_code == 200


def test_rate_limit_is_per_forwarded_client(monkeypatch):
    monkeypatch.setattr(main, "rate_limiter", RateLimiter(limit=1, window=60))
    assert client.get("/courses", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200
    assert client.get("/courses", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 429
    assert client.get("/courses", headers={"X-Forwarded-For": "2.2.2.2"}).status_code == 200


# ---- Validation ------------------------------------------------------------

def test_predict_rejects_malformed_course_codes():
    for bad in ({"subject": "C", "course": "110"}, {"subject": "CPSC", "course": "1"}, {"subject": "CP$C", "course": "110"}):
        response = client.post("/predict", json={"courses": [bad]})
        assert response.status_code == 422
        assert isinstance(response.json()["detail"], str)


def test_predict_rejects_too_many_courses():
    courses = [{"subject": "CPSC", "course": str(100 + i)} for i in range(26)]
    response = client.post("/predict", json={"courses": courses})
    assert response.status_code == 422


def test_predict_accepts_lowercase_and_suffixed_codes():
    response = client.post("/predict", json={"courses": [{"subject": "cpsc", "course": "110"}, {"subject": "MATH", "course": "100A"}]})
    assert response.status_code == 200


def test_predict_rejects_out_of_range_weights():
    response = client.post(
        "/predict",
        json={"courses": [{"subject": "CPSC", "course": "110"}], "weights": {"grade": 1e9, "failrisk": 0, "variance": 0, "classsize": 0}},
    )
    assert response.status_code == 422


def test_history_rejects_malformed_path():
    assert client.get("/courses/C/110/history").status_code == 422
    assert client.get("/courses/CPSC/xyz/history").status_code == 422
