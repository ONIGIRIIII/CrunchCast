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


class GradeBin(BaseModel):
    bin: str = Field(..., description="Grade range label, e.g. '<50', '90-100'")
    count: int = Field(..., description="Number of students who received a grade in this range")


class SectionStats(BaseModel):
    """Real stats for one individual section within a term (not combined
    with the rest of that term's sections), e.g. CPSC 110 2016W section 102
    taught by Gregor Kiczales. "Challenge for credit" exam-only sections
    (coded e.g. "1CH") are excluded entirely - see
    data/scripts/clean_section_stats.py - since they're not a real teaching
    section a student would be choosing between."""

    section: str = Field(..., description="Raw section code, e.g. '101', 'BCS', 'V01'")
    instructors: list[str] = Field(..., description="Instructor(s) who taught this specific section")
    avg: float
    std_dev: float | None = Field(None, description="Not reported by the source for 2022+ terms - null, never estimated")
    fail_rate: float = Field(..., description="0-100, percent of students who received a failing grade")
    enrolled: int
    distribution: list["GradeBin"] | None = Field(
        None, description="This section's own 11-bin grade distribution, for a distribution chart; null when unavailable"
    )


class InstructorTermStats(BaseModel):
    """Real stats for one instructor within a term, combined (enrollment-
    weighted) across every section they taught that term - e.g. CPSC 110
    2016W, Gregor Kiczales, combining sections 101 and BCS into one row.
    "Challenge for credit" exam-only sections (coded e.g. "1CH") are
    excluded entirely before this aggregation - see
    data/scripts/clean_section_stats.py - since they're not a real teaching
    section a student would be choosing between. A co-taught section's
    stats count fully toward each listed instructor (documented
    simplification: the data doesn't say who taught which part)."""

    instructor: str = Field(..., description="Instructor name")
    sections: list[str] = Field(..., description="Section codes taught by this instructor that term, combined into these stats")
    avg: float = Field(..., description="Enrollment-weighted average across this instructor's sections that term")
    std_dev: float | None = Field(
        None,
        description="Enrollment-weighted over sections that report one; null if none of this instructor's sections that term report it",
    )
    fail_rate: float = Field(..., description="0-100, enrollment-weighted percent of students who received a failing grade")
    enrolled: int = Field(..., description="Total enrolled across this instructor's sections that term")


class CourseTermStats(BaseModel):
    """Real stats for one specific term (year+session), not an average -
    from data/processed/course_term_stats.parquet, which spans 1996 through
    whatever's most recently available (currently 2025W). This is NOT the
    same data window the predictor uses (PAIR Reports, <=2016W only) - see
    data/README.md."""

    year: int
    session: Literal["S", "W"]
    session_label: str = Field(..., description="'Winter' or 'Summer'")
    available: bool = Field(..., description="False if this term's stats were privacy-suppressed/not reported")
    enrolled: int | None = None
    avg: float | None = None
    std_dev: float | None = Field(
        None, description="Not reported by the source for 2022+ terms - null, never estimated"
    )
    high: float | None = None
    low: float | None = None
    fail_rate: float | None = Field(None, description="0-100, percent of students who received a failing grade")
    instructors: list[str] = Field(
        ..., description="Every distinct instructor reported across that term's sections; empty if none reported"
    )
    distribution: list["GradeBin"] | None = Field(
        None, description="Grade-bin counts for this term, for a distribution chart; null when `available` is false"
    )
    sections: list[SectionStats] = Field(
        ..., description="Individual sections offered that term, for picking one specific section to see its own stats/instructor(s)"
    )
    instructor_stats: list[InstructorTermStats] = Field(
        ...,
        description="Per-instructor stats for that term, combined across each instructor's sections, for the 'Overall' comparison view",
    )
    best_instructor: str | None = Field(
        None,
        description=(
            "Instructor name with the highest combined average grade that term, only set when there are "
            "2+ instructors to compare. NOT a teaching-quality judgment - see data/README.md."
        ),
    )
    source: Literal["pair", "tableau_v1", "tableau_v2"] = Field(
        ..., description="Which underlying data source this term's row came from"
    )


class CourseHistoryResponse(BaseModel):
    subject: str
    course: str
    terms: list[CourseTermStats] = Field(..., description="Most recent term first")


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
