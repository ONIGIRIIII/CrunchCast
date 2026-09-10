"""Pydantic request/response models for the /predict endpoint."""

from typing import Literal

from pydantic import BaseModel, Field

MAX_COURSES_PER_REQUEST = 5


class CourseRequest(BaseModel):
    subject: str = Field(..., examples=["CPSC"], description="UBC subject code, e.g. CPSC")
    course: str = Field(..., examples=["110"], description="Course number, e.g. 110")
    session: Literal["S", "W"] = Field(
        "W", description="Summer (S) or Winter (W) session; only affects historical lookup"
    )


class Weights(BaseModel):
    """Relative importance of the four real historical signals, produced by
    the frontend's personalization quiz. Need not sum to 1 - normalized
    server-side (model/predict.py). All-zero falls back to equal weights."""

    grade: float = Field(0.25, ge=0, description="GPA/grade impact")
    failrisk: float = Field(0.25, ge=0, description="Risk of failing/retaking")
    variance: float = Field(0.25, ge=0, description="Grading unpredictability")
    classsize: float = Field(0.25, ge=0, description="Number of people taking the course")


class PredictRequest(BaseModel):
    courses: list[CourseRequest] = Field(..., min_length=1, max_length=MAX_COURSES_PER_REQUEST)
    weights: Weights | None = Field(
        None,
        description=(
            "Optional personalization weights, same set applied to every course in "
            "the request. Omit to get only the objective difficulty_score."
        ),
    )


class ExplanationComponent(BaseModel):
    """One of the four real historical signals behind a course's score."""

    key: Literal["grade", "failrisk", "variance", "classsize"]
    label: str = Field(..., description="Human-readable name, e.g. 'Fail risk'")
    score: float = Field(..., description="0-100 percentile rank of this signal alone, for a bar chart")
    detail: str = Field(..., description="Plain-English number behind the score, e.g. '12% of students historically fail'")


class CoursePrediction(BaseModel):
    subject: str
    course: str
    difficulty_score: float = Field(
        ..., description="0-100, higher = historically harder. A proxy for workload, not a direct measurement - see README."
    )
    explanation: list[ExplanationComponent] = Field(
        ..., description="The four real signals behind difficulty_score/personalized_score, for a per-course breakdown chart"
    )
    personalized_score: float | None = Field(
        None,
        description=(
            "0-100, weighted combination of grade/fail-risk/variance/class-size "
            "history using the request's `weights`. Only present when `weights` "
            "was supplied."
        ),
    )
    confidence: Literal["high", "medium", "low", "very_low"] = Field(
        ..., description="How much historical data backs this prediction"
    )
    historical_offerings_count: int
    credits: int


class HardestCourse(BaseModel):
    subject: str
    course: str
    difficulty_score: float


class CourseCatalogResponse(BaseModel):
    subjects: dict[str, list[str]] = Field(
        ..., description="Subject code -> sorted list of course numbers we have historical data for"
    )


class PredictResponse(BaseModel):
    term_difficulty_score: float = Field(..., description="Credit-weighted average across all requested courses")
    term_personalized_score: float | None = Field(
        None, description="Credit-weighted average of personalized_score; only present when `weights` was supplied"
    )
    total_credits: int
    n_courses: int
    n_high_difficulty_courses: int
    hardest_course: HardestCourse
    low_confidence_courses: list[str] = Field(
        ..., description="Courses with little/no matching historical data; treat their scores skeptically"
    )
    courses: list[CoursePrediction]
