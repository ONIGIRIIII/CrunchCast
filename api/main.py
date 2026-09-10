"""FastAPI service for the UBC Course Workload Predictor.

Run from the api/ directory with the venv active:
    uvicorn main:app --reload

Or from the repo root:
    uvicorn main:app --reload --app-dir api
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from model_service import (
    get_catalog,
    get_course_history,
    get_course_instructors,
    get_history_provider,
    get_instructor_stats_provider,
    get_predictor,
    predict_term,
)
from schemas import (
    CourseCatalogResponse,
    CourseHistoryResponse,
    CourseInstructorsResponse,
    PredictRequest,
    PredictResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_predictor()  # load the model + history/instructor tables at startup, not on the first request
    get_history_provider()
    get_instructor_stats_provider()
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

# CORS origins for the frontend, comma-separated. Defaults to allow-all for
# local development; set API_CORS_ORIGINS to the deployed frontend URL(s)
# in production (see README / deployment config).
cors_origins = os.environ.get("API_CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/courses", response_model=CourseCatalogResponse)
def courses():
    """Subjects and course numbers we have historical data for, for a
    browse-by-subject UI. Not an authoritative course catalog - see
    data/README.md for what this data source is and isn't."""
    return {"subjects": get_catalog()}


@app.get("/courses/{subject}/{course}/history", response_model=CourseHistoryResponse)
def course_history(subject: str, course: str):
    """Real per-term stats for a course (avg, std dev, high, low, fail
    rate, enrolled), most recent term first, spanning 1996 through whatever
    is most recently available (currently 2025W). NOT the same data window
    the predictor uses (PAIR Reports, <=2016W only) - see data/README.md
    for why the predictor and this history browser cover different ranges.
    """
    terms = get_course_history(subject, course)
    return {"subject": subject.strip().upper(), "course": course.strip().upper(), "terms": terms}


@app.get("/courses/{subject}/{course}/instructors", response_model=CourseInstructorsResponse)
def course_instructors(subject: str, course: str):
    """Per-instructor historical grade stats for a course, sorted by
    average grade descending. NOT a teaching-quality rating - correlational
    grade history only (self-selection, exam difficulty vs. teaching
    style, TA effects, and course changes over time all confound it). This
    is deliberately NOT RateMyProfessors data: RMP's Terms of Use prohibit
    automated scraping, and no legitimate pre-existing dataset was found -
    see data/README.md.
    """
    instructors = get_course_instructors(subject, course)
    return {"subject": subject.strip().upper(), "course": course.strip().upper(), "instructors": instructors}


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    try:
        return predict_term(request.courses, weights=request.weights)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
