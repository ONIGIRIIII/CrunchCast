"""Train and evaluate the course-difficulty model.

Two things happen here, kept deliberately separate:

1. Honest evaluation: split chronologically (train through 2013W, test on
   2014-2016), fit a heuristic baseline and a LightGBM model on train only,
   and score both on the untouched test set. This is what
   evaluate.py reports on.
2. Deployable artifact: after evaluation, refit the same LightGBM config on
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

import lightgbm as lgb
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data" / "scripts"))
from feature_spec import CATEGORICAL_FEATURE_COLS, FEATURE_COLS, LABEL_COL  # noqa: E402

FEATURES_PATH = REPO_ROOT / "data" / "processed" / "features.parquet"
ARTIFACTS_DIR = REPO_ROOT / "model" / "artifacts"

# Chronological split points, expressed as session_order = year*2 + (session=='W').
# Train (for honest eval) ends after 2013W; the last ~15% of that (2012S-2013W)
# is held out further as an early-stopping validation set.
INNER_TRAIN_CUTOFF = 2011 * 2 + 1  # through 2011W
TEST_CUTOFF = 2013 * 2 + 1  # through 2013W -> everything after is the test set

LGB_PARAMS = {
    "objective": "regression",
    "metric": "mae",
    "num_leaves": 31,
    "learning_rate": 0.05,
    "min_child_samples": 20,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 1,
    "verbose": -1,
}
MAX_ROUNDS = 2000
EARLY_STOPPING_ROUNDS = 50


def make_dataset(df: pd.DataFrame, reference: lgb.Dataset = None) -> lgb.Dataset:
    return lgb.Dataset(
        df[FEATURE_COLS],
        label=df[LABEL_COL],
        categorical_feature=CATEGORICAL_FEATURE_COLS,
        reference=reference,
        free_raw_data=False,
    )


def fit_with_early_stopping(inner_train: pd.DataFrame, inner_valid: pd.DataFrame) -> int:
    """Finds a good boosting round count on a held-out inner slice, chronologically
    before the real test set, so the real test set is never used for tuning."""
    train_set = make_dataset(inner_train)
    valid_set = make_dataset(inner_valid, reference=train_set)
    booster = lgb.train(
        LGB_PARAMS,
        train_set,
        num_boost_round=MAX_ROUNDS,
        valid_sets=[valid_set],
        callbacks=[lgb.early_stopping(EARLY_STOPPING_ROUNDS, verbose=False)],
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
    """
    course_stats = (
        features.groupby(["subject", "course"], observed=True)
        .agg(
            current_mean_difficulty=(LABEL_COL, "mean"),
            current_offerings_count=(LABEL_COL, "size"),
            current_mean_enrolled=("enrolled", "mean"),
            course_level=("course_level", "last"),
            credits=("credits", "last"),
        )
        .reset_index()
    )
    subject_stats = (
        features.groupby("subject", observed=True)
        .agg(
            current_mean_difficulty=(LABEL_COL, "mean"),
            current_offerings_count=(LABEL_COL, "size"),
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

    eval_train_set = make_dataset(train)
    eval_model = lgb.train(LGB_PARAMS, eval_train_set, num_boost_round=best_iteration)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    test = test.copy()
    test["pred_baseline"] = baseline_predict(test)
    test["pred_lightgbm"] = eval_model.predict(test[FEATURE_COLS])
    test.to_parquet(ARTIFACTS_DIR / "test_predictions.parquet", index=False)

    # Deployable model: same config, refit on everything, so the API serves
    # predictions informed by the full 1996-2016 history, not just pre-2014 data.
    full_set = make_dataset(features)
    final_model = lgb.train(LGB_PARAMS, full_set, num_boost_round=best_iteration)
    final_model.save_model(str(ARTIFACTS_DIR / "lightgbm_model.txt"))

    course_stats, subject_stats = compute_current_stats(features)
    course_stats.to_parquet(ARTIFACTS_DIR / "current_course_stats.parquet", index=False)
    subject_stats.to_parquet(ARTIFACTS_DIR / "current_subject_stats.parquet", index=False)

    metadata = {
        "feature_cols": FEATURE_COLS,
        "categorical_feature_cols": CATEGORICAL_FEATURE_COLS,
        "label_col": LABEL_COL,
        "lgb_params": LGB_PARAMS,
        "best_iteration": best_iteration,
        "eval_test_cutoff_session_order": TEST_CUTOFF,
        "eval_inner_train_cutoff_session_order": INNER_TRAIN_CUTOFF,
        "n_train_rows_eval_model": len(train),
        "n_train_rows_final_model": len(features),
        "global_mean_difficulty": float(features[LABEL_COL].mean()),
        "note": (
            "final_model (lightgbm_model.txt) is trained on ALL rows and is what "
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
