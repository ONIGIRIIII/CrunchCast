"""Shared column-name constants for the feature table.

Imported by data/scripts/build_features.py (which produces the table) and by
model/train.py + model/predict.py (which consume it), so the two stages
never drift out of sync about column names.
"""

LABEL_COL = "difficulty_score"

# Columns the model is actually allowed to train on. Every one of these must
# be computable before a future offering happens (see build_features.py for
# how the historical/rolling ones are computed without leaking future data).
NUMERIC_FEATURE_COLS = [
    "hist_course_mean_difficulty",
    "hist_course_offerings_count",
    "hist_course_mean_enrolled",
    "hist_subject_mean_difficulty",
    "hist_subject_offerings_count",
    "hist_professor_mean_difficulty",
    "hist_professor_offerings_count",
    "global_running_mean_difficulty",
    "credits",
]
CATEGORICAL_FEATURE_COLS = ["subject", "course_level", "session"]
FEATURE_COLS = NUMERIC_FEATURE_COLS + CATEGORICAL_FEATURE_COLS

# Kept in the table for identification, evaluation, and error analysis, but
# deliberately NOT passed to the model as features (using a row's own
# outcome to predict that same row's outcome would be leakage).
IDENTIFIER_COLS = ["campus", "year", "session_order", "subject", "course", "section"]
REFERENCE_ONLY_COLS = ["avg", "std_dev", "fail_rate", "enrolled", "professor", "is_first_offering"]
