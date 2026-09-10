"""Download the two newer, non-corrupted grade-data sources that extend
course-term history coverage from 2016W (the PAIR Reports cutoff) up to the
latest available term (currently 2025W).

Source: https://github.com/DonneyF/ubc-pair-grade-data (same pinned commit
as download_pair_data.py, for reproducibility).

IMPORTANT: this data is used ONLY for the "view by term" history browser
(model/history.py, GET /courses/{subject}/{course}/history) - never for
model training. The prediction model stays on PAIR Reports data (<=2016W)
only; see data/README.md for why.

Two sources, used for non-overlapping windows (v1's OVERALL rows + std_dev
are richer than v2's, so v1 is preferred where both exist):
  - tableau-dashboard ("v1"): 2017S-2021W. Has real OVERALL rollup rows and
    std_dev, but no explicit Fail count (only grade-count bins).
  - tableau-dashboard-v2: 2022S onward. No OVERALL rows (synthesized in
    clean_tableau_data.py) and no std_dev at all - reported as unavailable
    for those terms rather than estimated. Also no explicit Fail count.
"""

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

REPO_URL = "https://github.com/DonneyF/ubc-pair-grade-data.git"
PINNED_SHA = "18af317b9ded65047f8438b854317b4ff7fcb88d"

REPO_ROOT = Path(__file__).resolve().parents[2]

SOURCES = [
    {
        "name": "tableau-dashboard",
        "sparse_path": "tableau-dashboard/UBCV",
        "min_year": 2017,  # 2014-2016 overlaps PAIR; PAIR is preferred for that window
        "max_year": 2021,
    },
    {
        "name": "tableau-dashboard-v2",
        "sparse_path": "tableau-dashboard-v2/UBCV",
        "min_year": 2022,  # 2021 overlaps tableau-dashboard v1, which is richer (has std_dev)
        "max_year": None,  # no upper bound - take whatever is latest
    },
]

SESSION_DIR_RE = re.compile(r"^(\d{4})([SW])$")


def run_git(args, cwd):
    subprocess.run(["git", *args], cwd=cwd, check=True)


def sparse_clone_pinned_commit(dest: Path, sparse_path: str) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    run_git(["init", "-q"], cwd=dest)
    run_git(["remote", "add", "origin", REPO_URL], cwd=dest)
    run_git(["sparse-checkout", "init", "--cone"], cwd=dest)
    run_git(["sparse-checkout", "set", sparse_path], cwd=dest)
    run_git(["fetch", "--depth", "1", "origin", PINNED_SHA], cwd=dest)
    run_git(["checkout", "FETCH_HEAD"], cwd=dest)
    return dest / sparse_path


def matching_session_dirs(all_sessions_dir: Path, min_year: int, max_year):
    for entry in sorted(all_sessions_dir.iterdir()):
        match = SESSION_DIR_RE.match(entry.name)
        if not match:
            continue
        year = int(match.group(1))
        if year < min_year:
            continue
        if max_year is not None and year > max_year:
            continue
        yield entry


def main():
    for source in SOURCES:
        raw_dir = REPO_ROOT / "data" / "raw" / source["name"] / "UBCV"
        if raw_dir.exists() and any(raw_dir.iterdir()):
            print(f"{raw_dir} already present, skipping download.")
            print(f"Delete it if you want to re-download {source['name']}.")
            continue

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            print(f"Sparse-cloning {source['sparse_path']} @ {PINNED_SHA[:12]} ...")
            cloned_dir = sparse_clone_pinned_commit(tmp_path, source["sparse_path"])

            raw_dir.mkdir(parents=True, exist_ok=True)
            copied = 0
            for session_dir in matching_session_dirs(cloned_dir, source["min_year"], source["max_year"]):
                shutil.copytree(session_dir, raw_dir / session_dir.name)
                copied += 1
            print(f"Copied {copied} year-session folders for {source['name']} to {raw_dir}")


if __name__ == "__main__":
    main()
