"""Train and evaluate the course-difficulty model.

Two things happen here, kept deliberately separate:

1. Honest evaluation: split chronologically (train through 2013W, test on
   2014-2016), fit a heuristic baseline and an XGBoost model on train only,
   and score both on the untouched test set. This is what
   evaluate.py reports on.
2. Deployable artifact: after evaluation, refit the same XGBoost config on
   ALL available data (1996-2016) so the shipped model uses every bit of
   history we have. This is standard practice, but it means the model that
   actually serves predictions was NOT the one evaluated above - the
   evaluation numbers describe a same-shaped model trained on less data, as
   a lower-bound estimate of quality. That distinction is spelled out in the
   evaluation report so it isn't misleading.

Run: python model/train.py
"""

import json
import sys
from pathlib import Path

import pandas as pd
import xgboost as xgb

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data" / "scripts"))
from feature_spec import (  # noqa: E402
    CATEGORICAL_FEATURE_COLS,
    COMPONENT_SCORE_COLS,
    FEATURE_COLS,
    LABEL_COL,
    RAW_EXPLANATION_COLS,
)

FEATURES_PATH = REPO_ROOT / "data" / "processed" / "features.parquet"
ARTIFACTS_DIR = REPO_ROOT / "model" / "artifacts"

# Chronological split points, expressed as session_order = year*2 + (session=='W').
# Train (for honest eval) ends after 2013W; the last ~15% of that (2012S-2013W)
# is held out further as an early-stopping validation set.
INNER_TRAIN_CUTOFF = 2011 * 2 + 1  # through 2011W
TEST_CUTOFF = 2013 * 2 + 1  # through 2013W -> everything after is the test set

# grow_policy="lossguide" + max_leaves mirrors LightGBM's leaf-wise growth
# (this project's original config, kept for continuity after the LightGBM ->
# XGBoost swap rather than re-tuning from scratch).
XGB_PARAMS = {
    "objective": "reg:squarederror",
    "eval_metric": "mae",
    "tree_method": "hist",
    "grow_policy": "lossguide",
    "max_leaves": 31,
    "learning_rate": 0.05,
    "min_child_weight": 20,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
}
MAX_ROUNDS = 2000
EARLY_STOPPING_ROUNDS = 50


def make_dmatrix(df: pd.DataFrame, label_col: str = LABEL_COL) -> xgb.DMatrix:
    return xgb.DMatrix(df[FEATURE_COLS], label=df[label_col], enable_categorical=True)


def fit_with_early_stopping(inner_train: pd.DataFrame, inner_valid: pd.DataFrame) -> int:
    """Finds a good boosting round count on a held-out inner slice, chronologically
    before the real test set, so the real test set is never used for tuning."""
    train_matrix = make_dmatrix(inner_train)
    valid_matrix = make_dmatrix(inner_valid)
    booster = xgb.train(
        XGB_PARAMS,
        train_matrix,
        num_boost_round=MAX_ROUNDS,
        evals=[(valid_matrix, "valid")],
        early_stopping_rounds=EARLY_STOPPING_ROUNDS,
        verbose_eval=False,
    )
    return booster.best_iteration


def baseline_predict(df: pd.DataFrame) -> pd.Series:
    """Heuristic, non-ML baseline: this course's own trailing history, falling
    back to subject history, falling back to the global running mean. No
    fitting involved - this is "the best guess a human could make just by
    looking up history," which the ML model needs to beat to be worth using.
    """
    pred = df["hist_course_mean_difficulty"]
    pred = pred.fillna(df["hist_subject_mean_difficulty"])
    pred = pred.fillna(df["global_running_mean_difficulty"])
    pred = pred.fillna(50.0)  # midpoint of the 0-100 score, for the handful of very first rows
    return pred


def compute_current_stats(features: pd.DataFrame):
    """Full-history (not time-restricted) lookup tables used only at live
    inference time (model/predict.py), to answer "what's our best current
    estimate of difficulty for a course a student might take next term."

    Unlike the hist_* training features, these deliberately use ALL
    available rows - there's no leakage concern here since we're not
    scoring any historical row, we're estimating a course's difficulty as
    of today, for a term beyond the end of our dataset.

    Also aggregates the four personalization components (COMPONENT_SCORE_COLS)
    the same way - these are never used as training features (see
    feature_spec.py), only as plain historical lookups for personalized
    scoring in model/predict.py. Same for RAW_EXPLANATION_COLS (avg,
    fail_rate, std_dev): human-readable numbers behind the "why" breakdown
    the API returns per course, e.g. "historically ~68% average grade" -
    without these, the component scores are just abstract 0-100 numbers.
    """
    component_aggs = {f"current_mean_{col}": (col, "mean") for col in COMPONENT_SCORE_COLS}
    raw_aggs = {f"current_mean_{col}": (col, "mean") for col in RAW_EXPLANATION_COLS}

    course_stats = (
        features.groupby(["subject", "course"], observed=True)
        .agg(
            current_mean_difficulty=(LABEL_COL, "mean"),
            current_offerings_count=(LABEL_COL, "size"),
            current_mean_enrolled=("enrolled", "mean"),
            course_level=("course_level", "last"),
            credits=("credits", "last"),
            **component_aggs,
            **raw_aggs,
        )
        .reset_index()
    )
    subject_stats = (
        features.groupby("subject", observed=True)
        .agg(
            current_mean_difficulty=(LABEL_COL, "mean"),
            current_offerings_count=(LABEL_COL, "size"),
            current_mean_enrolled=("enrolled", "mean"),
            **component_aggs,
            **raw_aggs,
        )
        .reset_index()
    )
    return course_stats, subject_stats


def main():
    features = pd.read_parquet(FEATURES_PATH)

    train = features[features["session_order"] <= TEST_CUTOFF]
    test = features[features["session_order"] > TEST_CUTOFF]
    inner_train = train[train["session_order"] <= INNER_TRAIN_CUTOFF]
    inner_valid = train[train["session_order"] > INNER_TRAIN_CUTOFF]
    print(f"inner_train={len(inner_train):,} inner_valid={len(inner_valid):,} "
          f"train={len(train):,} test={len(test):,}")

    best_iteration = fit_with_early_stopping(inner_train, inner_valid)
    print(f"best_iteration (from inner validation) = {best_iteration}")

    eval_train_matrix = make_dmatrix(train)
    eval_model = xgb.train(XGB_PARAMS, eval_train_matrix, num_boost_round=best_iteration)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    test = test.copy()
    test["pred_baseline"] = baseline_predict(test)
    test["pred_xgboost"] = eval_model.predict(make_dmatrix(test))
    test.to_parquet(ARTIFACTS_DIR / "test_predictions.parquet", index=False)

    # Deployable model: same config, refit on everything, so the API serves
    # predictions informed by the full 1996-2016 history, not just pre-2014 data.
    full_matrix = make_dmatrix(features)
    final_model = xgb.train(XGB_PARAMS, full_matrix, num_boost_round=best_iteration)
    final_model.save_model(str(ARTIFACTS_DIR / "xgboost_model.json"))

    course_stats, subject_stats = compute_current_stats(features)
    course_stats.to_parquet(ARTIFACTS_DIR / "current_course_stats.parquet", index=False)
    subject_stats.to_parquet(ARTIFACTS_DIR / "current_subject_stats.parquet", index=False)

    metadata = {
        "feature_cols": FEATURE_COLS,
        "categorical_feature_cols": CATEGORICAL_FEATURE_COLS,
        "label_col": LABEL_COL,
        "xgb_params": XGB_PARAMS,
        "best_iteration": best_iteration,
        "eval_test_cutoff_session_order": TEST_CUTOFF,
        "eval_inner_train_cutoff_session_order": INNER_TRAIN_CUTOFF,
        "n_train_rows_eval_model": len(train),
        "n_train_rows_final_model": len(features),
        "global_mean_difficulty": float(features[LABEL_COL].mean()),
        "global_mean_component": {col: float(features[col].mean()) for col in COMPONENT_SCORE_COLS},
        "global_mean_raw": {col: float(features[col].mean()) for col in RAW_EXPLANATION_COLS},
        "global_mean_enrolled": float(features["enrolled"].mean()),
        # XGBoost's categorical support (unlike LightGBM's) errors on a
        # category value it never saw during training, instead of handling
        # it gracefully. So at inference time we align incoming categorical
        # columns to exactly this training vocabulary (model/predict.py) -
        # an unseen subject/course_level becomes a missing value, which
        # XGBoost DOES handle natively, falling back on the historical
        # numeric features (subject/global means) instead of category identity.
        "categorical_categories": {
            col: features[col].cat.categories.tolist() for col in CATEGORICAL_FEATURE_COLS
        },
        "note": (
            "final_model (xgboost_model.json) is trained on ALL rows and is what "
            "the API serves. Evaluation metrics in model/reports/evaluation_report.md "
            "come from eval_model, trained only on pre-2014 data, so they are a "
            "lower-bound estimate of the shipped model's quality, not a live score "
            "for it (the shipped model can never be evaluated out-of-time, since "
            "there is no post-2016 reliable data)."
        ),
    }
    (ARTIFACTS_DIR / "model_metadata.json").write_text(json.dumps(metadata, indent=2))

    print(f"Saved eval-model test predictions, final model, and metadata to {ARTIFACTS_DIR}")


if __name__ == "__main__":
    main()
