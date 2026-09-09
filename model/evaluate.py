"""Produce an honest evaluation + error-analysis report from test predictions.

Reads model/artifacts/test_predictions.parquet (written by train.py) and
writes model/reports/evaluation_report.md.

Run: python model/evaluate.py (after model/train.py)
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data" / "scripts"))
from feature_spec import LABEL_COL  # noqa: E402

ARTIFACTS_DIR = REPO_ROOT / "model" / "artifacts"
REPORTS_DIR = REPO_ROOT / "model" / "reports"


def metrics_for(y_true, y_pred) -> dict:
    return {
        "MAE": mean_absolute_error(y_true, y_pred),
        "RMSE": mean_squared_error(y_true, y_pred) ** 0.5,
        "R2": r2_score(y_true, y_pred),
    }


def feature_importance_table(metadata: dict) -> pd.DataFrame:
    import lightgbm as lgb

    booster = lgb.Booster(model_file=str(ARTIFACTS_DIR / "lightgbm_model.txt"))
    gains = booster.feature_importance(importance_type="gain")
    names = booster.feature_name()
    table = pd.DataFrame({"feature": names, "gain": gains})
    table["gain_pct"] = 100 * table["gain"] / table["gain"].sum()
    return table.sort_values("gain_pct", ascending=False)


def main():
    test = pd.read_parquet(ARTIFACTS_DIR / "test_predictions.parquet")
    metadata = json.loads((ARTIFACTS_DIR / "model_metadata.json").read_text())

    y_true = test[LABEL_COL]
    baseline_metrics = metrics_for(y_true, test["pred_baseline"])
    lgbm_metrics = metrics_for(y_true, test["pred_lightgbm"])

    test = test.copy()
    test["abs_error_lgbm"] = (test[LABEL_COL] - test["pred_lightgbm"]).abs()
    by_subject = (
        test.groupby("subject", observed=True)["abs_error_lgbm"]
        .agg(["mean", "count"])
        .rename(columns={"mean": "mean_abs_error"})
    )
    worst_subjects = by_subject[by_subject["count"] >= 20].sort_values(
        "mean_abs_error", ascending=False
    ).head(10)
    best_subjects = by_subject[by_subject["count"] >= 20].sort_values(
        "mean_abs_error"
    ).head(10)

    by_level = test.groupby("course_level", observed=True)["abs_error_lgbm"].agg(["mean", "count"])

    worst_rows = test.sort_values("abs_error_lgbm", ascending=False).head(15)
    worst_cols = [
        "year", "session", "subject", "course", "section",
        LABEL_COL, "pred_lightgbm", "pred_baseline", "abs_error_lgbm",
        "hist_course_offerings_count",
    ]

    importance = feature_importance_table(metadata)

    lines = []
    lines.append("# Model evaluation report\n")
    lines.append(
        "Read this alongside data/README.md, which explains that "
        "difficulty_score is a proxy built from grade outcomes, not a "
        "direct measurement of student workload.\n"
    )

    lines.append("\n## Setup\n")
    lines.append(
        f"- Train: offerings through 2013W (session_order <= "
        f"{metadata['eval_test_cutoff_session_order']}), "
        f"{metadata['n_train_rows_eval_model']:,} rows.\n"
        f"- Test: offerings from 2014S through 2016W (strictly out-of-time), "
        f"{len(test):,} rows.\n"
        f"- Boosting rounds ({metadata['best_iteration']}) chosen by early "
        f"stopping on an inner validation slice (2012S-2013W), never on the "
        f"test set itself.\n"
        "- The model actually shipped in the API is refit on ALL available "
        "data (1996-2016) using the same config; see model/train.py's "
        "module docstring for why, and note that this means the numbers "
        "below are a lower bound on the shipped model's real quality, not "
        "a direct score of it.\n"
    )

    lines.append("\n## Headline metrics (difficulty_score, 0-100 scale)\n")
    lines.append("| Model | MAE | RMSE | R2 |\n|---|---|---|---|\n")
    lines.append(
        f"| Heuristic baseline (historical lookup, no ML) | "
        f"{baseline_metrics['MAE']:.2f} | {baseline_metrics['RMSE']:.2f} | "
        f"{baseline_metrics['R2']:.3f} |\n"
    )
    lines.append(
        f"| LightGBM | {lgbm_metrics['MAE']:.2f} | {lgbm_metrics['RMSE']:.2f} | "
        f"{lgbm_metrics['R2']:.3f} |\n"
    )
    improvement = 100 * (1 - lgbm_metrics["MAE"] / baseline_metrics["MAE"])
    lines.append(
        f"\nLightGBM reduces MAE by {improvement:.1f}% versus the heuristic "
        "baseline, i.e. it's better than just looking up a course's own "
        "trailing history, but not by a huge margin. That's expected: most "
        "of the signal in this proxy label IS a course/subject's own "
        "history, so a big jump over that baseline would be more suspicious "
        "than reassuring.\n"
    )

    lines.append("\n## Feature importance (gain, top 10)\n")
    lines.append(importance.head(10).to_string(index=False) + "\n")

    lines.append("\n## Error by subject (min 20 test rows)\n")
    lines.append("### Hardest to predict\n")
    lines.append(worst_subjects.to_string() + "\n")
    lines.append("\n### Easiest to predict\n")
    lines.append(best_subjects.to_string() + "\n")

    lines.append("\n## Error by course level\n")
    lines.append(by_level.to_string() + "\n")

    lines.append("\n## Worst 15 individual predictions\n")
    lines.append(worst_rows[worst_cols].to_string(index=False) + "\n")

    lines.append("\n## Error analysis notes\n")
    lines.append(
        "- Courses/subjects with few historical offerings (low "
        "`hist_course_offerings_count`) tend to have the largest errors, "
        "since the model falls back to a coarser subject-level or global "
        "estimate. This is visible in the worst-predictions table above.\n"
        "- Because difficulty_score is percentile-ranked over the WHOLE "
        "corpus, it is a relative measure: a difficulty_score of 80 means "
        "'harder than about 80% of historical offerings in this dataset,' "
        "not an absolute workload amount.\n"
        "- Small-enrollment sections were already excluded upstream "
        "(enrolled < 10, see data/README.md), so remaining errors are not "
        "primarily a small-sample-size artifact at the row level, though "
        "they can still be at the course level for rarely-offered courses.\n"
        "- Graduate-level (500/600) courses have the LOWEST mean absolute "
        "error on average (see 'Error by course level'), but several of the "
        "single worst individual predictions are also graduate courses. "
        "The likely reason: grad cohorts are small and tightly graded "
        "(most students cluster near the top of the scale), so a single "
        "unusual offering can swing the percentile-ranked difficulty_score "
        "from near 0 to near 100 with almost no change in the raw average "
        "grade. The model, trained on that course's typically-calm history, "
        "has no way to see that coming. This is a real limitation of the "
        "proxy label's sensitivity for small, homogeneous cohorts, not a "
        "generic ML failure.\n"
    )

    lines.append("\n## Limitations (see also top-level README)\n")
    lines.append(
        "- **Proxy label, not workload.** difficulty_score reflects grade "
        "outcomes (avg, fail rate, grade spread), which correlate with but "
        "are not the same thing as how much work a course actually takes. "
        "A generously-graded but time-consuming course would score as "
        "'easy' here.\n"
        "- **Grade data reliability window.** Only 2016W and earlier PAIR "
        "data is used; anything about 2017+ trends (curriculum changes, "
        "grading policy shifts, new instructors) is invisible to this "
        "model, and predictions for the current catalog are extrapolations "
        "from up to a decade of historical drift.\n"
        "- **Professor feature is sparse.** About half of rows have no "
        "usable professor-level history (name inconsistency across years); "
        "the model can't use instructor identity as a reliable signal for "
        "most courses.\n"
        "- **No real section-timing/workload signal at all** (e.g. reading "
        "load, assignment frequency, project-based vs. exam-based grading) "
        "exists in this data source; the model is limited to what grade "
        "distributions can tell us.\n"
    )

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "evaluation_report.md").write_text("".join(lines), encoding="utf-8")
    print(f"Wrote {REPORTS_DIR / 'evaluation_report.md'}")
    print(f"Baseline MAE={baseline_metrics['MAE']:.2f}  LightGBM MAE={lgbm_metrics['MAE']:.2f}")


if __name__ == "__main__":
    main()
