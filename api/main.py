"""FastAPI service for the UBC Course Workload Predictor.

Run from the api/ directory with the venv active:
    uvicorn main:app --reload

Or from the repo root:
    uvicorn main:app --reload --app-dir api
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Path, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from model_service import get_catalog, get_course_history, get_history_provider, get_predictor, predict_term
from rate_limit import RateLimiter, client_key, retry_after_seconds
from schemas import (
    COURSE_PATTERN,
    SUBJECT_PATTERN,
    CourseCatalogResponse,
    CourseHistoryResponse,
    PredictRequest,
    PredictResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_predictor()  # load the model + history table at startup, not on the first request
    get_history_provider()
    yield


app = FastAPI(
    title="UBC Course Workload Predictor API",
    description=(
        "Predicts a proxy 'difficulty score' per course, and a term-level "
        "score for a set of courses, based on historical UBC grade data "
        "(2016W and earlier). Difficulty here is inferred from grade "
        "outcomes, not a direct measurement of workload - see the repo "
        "README for details and limitations."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# Per-client request limit (see rate_limit.py). API_RATE_LIMIT_PER_MINUTE
# overrides the default; 0 disables it. /health is exempt so Render's health
# checks never count, and CORS preflights (OPTIONS) are exempt so a limited
# client still gets a readable 429 rather than a CORS failure.
RATE_LIMIT_EXEMPT_PATHS = {"/health"}
rate_limiter = RateLimiter(int(os.environ.get("API_RATE_LIMIT_PER_MINUTE", "120")), window=60.0)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in RATE_LIMIT_EXEMPT_PATHS:
        return await call_next(request)
    wait = rate_limiter.check(client_key(request))
    if wait > 0:
        seconds = retry_after_seconds(wait)
        return JSONResponse(
            status_code=429,
            content={"detail": f"Too many requests - try again in {seconds} seconds."},
            headers={"Retry-After": str(seconds)},
        )
    return await call_next(request)


# CORS for the frontend. API_CORS_ORIGINS is a comma-separated list of exact
# origins (default "*" for local development); API_CORS_ORIGIN_REGEX
# optionally allows a pattern too - production uses it for Vercel preview
# deployment URLs (see render.yaml). Added after the rate limiter so it wraps
# it: 429 responses carry CORS headers and the browser can read them.
cors_origins = [origin.strip() for origin in os.environ.get("API_CORS_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=os.environ.get("API_CORS_ORIGIN_REGEX") or None,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    """Readable 422s - the frontend shows `detail` directly, so collapse
    FastAPI's default list of error objects into one sentence."""
    problems = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error.get("loc", ()) if part not in ("body", "path", "query"))
        problems.append(f"{location}: {error.get('msg')}" if location else str(error.get("msg")))
    return JSONResponse(status_code=422, content={"detail": "Invalid request - " + "; ".join(problems)})


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/courses", response_model=CourseCatalogResponse)
def courses():
    """Subjects and course numbers we have ANY historical data for - the
    union of the predictor's PAIR-era (<=2016W) catalog and the history
    browser's wider (1996-2025) catalog, so a course introduced after 2016
    (e.g. CPSC 330) still shows up in search even though the predictor
    falls back to subject/global estimates for it. Not an authoritative
    course catalog - see data/README.md for what this data source is and
    isn't."""
    return {"subjects": get_catalog()}


@app.get("/courses/{subject}/{course}/history", response_model=CourseHistoryResponse)
def course_history(
    subject: str = Path(..., pattern=SUBJECT_PATTERN, description="UBC subject code, e.g. CPSC"),
    course: str = Path(..., pattern=COURSE_PATTERN, description="Course number, e.g. 110 or 317A"),
):
    """Real per-term stats for a course (avg, std dev, high, low, fail
    rate, enrolled), most recent term first, spanning 1996 through whatever
    is most recently available (currently 2025W). NOT the same data window
    the predictor uses (PAIR Reports, <=2016W only) - see data/README.md
    for why the predictor and this history browser cover different ranges.
    """
    terms = get_course_history(subject, course)
    return {"subject": subject.strip().upper(), "course": course.strip().upper(), "terms": terms}


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    try:
        return predict_term(request.courses, weights=request.weights)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
