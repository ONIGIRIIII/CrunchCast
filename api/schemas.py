"""Pydantic request/response models for the /predict endpoint."""

from typing import Literal

from pydantic import BaseModel, Field

MAX_COURSES_PER_REQUEST = 8


class CourseRequest(BaseModel):
    subject: str = Field(..., examples=["CPSC"], description="UBC subject code, e.g. CPSC")
    course: str = Field(..., examples=["110"], description="Course number, e.g. 110")
    session: Literal["S", "W"] = Field(
        "W", description="Summer (S) or Winter (W) session; only affects historical lookup"
    )


class PredictRequest(BaseModel):
    courses: list[CourseRequest] = Field(..., min_length=1, max_length=MAX_COURSES_PER_REQUEST)


class CoursePrediction(BaseModel):
    subject: str
    course: str
    difficulty_score: float = Field(
        ..., description="0-100, higher = historically harder. A proxy for workload, not a direct measurement - see README."
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


class PredictResponse(BaseModel):
    term_difficulty_score: float = Field(..., description="Credit-weighted average across all requested courses")
    total_credits: int
    n_courses: int
    n_high_difficulty_courses: int
    hardest_course: HardestCourse
    low_confidence_courses: list[str] = Field(
        ..., description="Courses with little/no matching historical data; treat their scores skeptically"
    )
    courses: list[CoursePrediction]
