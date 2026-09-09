"""Combine several per-course difficulty predictions into one term-level
risk readout.

Deliberately simple: a credit-weighted average is the headline number, plus
a couple of extra signals (how many courses are individually hard, and
whether any prediction is low-confidence) that a course-picker UI can
surface without pretending to be more precise than the underlying model is.
"""

HIGH_DIFFICULTY_THRESHOLD = 70.0
LOW_CONFIDENCE_LEVELS = {"low", "very_low"}


def aggregate_term(course_predictions: list[dict]) -> dict:
    """course_predictions: list of dicts as returned by
    CourseDifficultyPredictor.predict_one() (must have difficulty_score,
    credits, confidence)."""
    if not course_predictions:
        raise ValueError("course_predictions must be non-empty")

    total_credits = sum(c["credits"] for c in course_predictions)
    if total_credits > 0:
        term_difficulty_score = sum(
            c["difficulty_score"] * c["credits"] for c in course_predictions
        ) / total_credits
    else:
        term_difficulty_score = sum(c["difficulty_score"] for c in course_predictions) / len(
            course_predictions
        )

    hardest_course = max(course_predictions, key=lambda c: c["difficulty_score"])
    n_high_difficulty = sum(
        1 for c in course_predictions if c["difficulty_score"] >= HIGH_DIFFICULTY_THRESHOLD
    )
    low_confidence_courses = [
        c["course"] for c in course_predictions if c["confidence"] in LOW_CONFIDENCE_LEVELS
    ]

    return {
        "term_difficulty_score": round(term_difficulty_score, 1),
        "total_credits": total_credits,
        "n_courses": len(course_predictions),
        "n_high_difficulty_courses": n_high_difficulty,
        "hardest_course": {
            "subject": hardest_course["subject"],
            "course": hardest_course["course"],
            "difficulty_score": hardest_course["difficulty_score"],
        },
        "low_confidence_courses": low_confidence_courses,
        "courses": course_predictions,
    }
