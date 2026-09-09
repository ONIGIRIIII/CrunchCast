"""Short, honest EDA over the cleaned section data and the feature table.

Writes a plain-text summary and a few plots to data/eda/. This is meant to
be skimmed in a couple of minutes, not a full notebook.
"""

from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
SECTIONS_PATH = REPO_ROOT / "data" / "processed" / "sections_clean.parquet"
FEATURES_PATH = REPO_ROOT / "data" / "processed" / "features.parquet"
OUT_DIR = REPO_ROOT / "data" / "eda"


def write_summary(sections: pd.DataFrame, features: pd.DataFrame, out_path: Path):
    gradeable = sections[(~sections["is_overall"]) & sections["avg"].notna()]
    lines = []
    lines.append("# EDA summary\n")
    lines.append(f"Raw cleaned rows (sections + OVERALL): {len(sections):,}\n")
    lines.append(f"Gradeable section rows (has avg, not OVERALL): {len(gradeable):,}\n")
    lines.append(f"Feature-table rows (also enrolled >= 10): {len(features):,}\n")
    lines.append(f"Year range: {sections['year'].min()}-{sections['year'].max()}\n")

    lines.append("\n## Rows per year-session\n")
    per_session = sections[~sections["is_overall"]].groupby(["year", "session"]).size()
    lines.append(per_session.to_string() + "\n")

    lines.append("\n## Missingness (gradeable-eligible section rows, before enrolled>=10 filter)\n")
    non_overall = sections[~sections["is_overall"]]
    miss = non_overall[["avg", "std_dev", "fail_rate"]].isna().mean()
    lines.append(miss.to_string() + "\n")
    lines.append(
        "\nMost missing avg/std_dev rows are tiny sections (labs/tutorials/BCS with <10\n"
        "enrolled) that PAIR privacy-suppresses or that never had letter grades issued.\n"
    )

    lines.append("\n## avg / fail_rate / std_dev summary (gradeable rows)\n")
    lines.append(gradeable[["avg", "fail_rate", "std_dev", "enrolled"]].describe().to_string() + "\n")

    lines.append("\n## Top 15 hardest subjects by mean difficulty_score (>=30 offerings)\n")
    subj = features.groupby("subject")["difficulty_score"].agg(["mean", "count"])
    subj = subj[subj["count"] >= 30].sort_values("mean", ascending=False).head(15)
    lines.append(subj.to_string() + "\n")

    lines.append("\n## Top 15 easiest subjects by mean difficulty_score (>=30 offerings)\n")
    subj_easy = features.groupby("subject")["difficulty_score"].agg(["mean", "count"])
    subj_easy = subj_easy[subj_easy["count"] >= 30].sort_values("mean").head(15)
    lines.append(subj_easy.to_string() + "\n")

    lines.append("\n## Feature missingness in the final feature table\n")
    hist_cols = [c for c in features.columns if c.startswith("hist_") or c.startswith("global_")]
    lines.append(features[hist_cols].isna().mean().to_string() + "\n")

    out_path.write_text("".join(lines), encoding="utf-8")
    print(f"Wrote {out_path}")


def make_plots(gradeable: pd.DataFrame, features: pd.DataFrame, out_dir: Path):
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    axes[0].hist(gradeable["avg"], bins=40)
    axes[0].set_title("Section average grade")
    axes[1].hist(gradeable["fail_rate"], bins=40)
    axes[1].set_title("Section fail rate")
    axes[2].hist(gradeable["std_dev"], bins=40)
    axes[2].set_title("Section grade std dev")
    fig.tight_layout()
    fig.savefig(out_dir / "outcome_distributions.png", dpi=120)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 4))
    ax.hist(features["difficulty_score"], bins=40)
    ax.set_title("difficulty_score (label) distribution")
    fig.tight_layout()
    fig.savefig(out_dir / "difficulty_score_distribution.png", dpi=120)
    plt.close(fig)

    yearly = features.groupby("year")["difficulty_score"].mean()
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(yearly.index, yearly.values, marker="o")
    ax.set_title("Mean difficulty_score by year")
    ax.set_xlabel("year")
    fig.tight_layout()
    fig.savefig(out_dir / "difficulty_by_year.png", dpi=120)
    plt.close(fig)

    print(f"Wrote plots to {out_dir}")


def main():
    sections = pd.read_parquet(SECTIONS_PATH)
    features = pd.read_parquet(FEATURES_PATH)
    gradeable = sections[(~sections["is_overall"]) & sections["avg"].notna()]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_summary(sections, features, OUT_DIR / "summary.md")
    make_plots(gradeable, features, OUT_DIR)


if __name__ == "__main__":
    main()
