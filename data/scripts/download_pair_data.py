"""Download the UBC PAIR grade-distribution CSVs we can actually trust.

Source: https://github.com/DonneyF/ubc-pair-grade-data

Per that repo's own README, grade data from the PAIR Reports era is only
reliable for 2016W and earlier (2017W+ was found to have been altered), and
only UBC Vancouver campus data exists in that era. We pin to a specific
upstream commit so this script is reproducible, and only fetch the
pair-reports/UBC/<year><S|W>/ folders for year <= LAST_RELIABLE_YEAR.

Uses a sparse git checkout so we don't have to pull the whole upstream repo
(which also contains newer, unreliable Tableau-sourced data we don't want).
"""

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

REPO_URL = "https://github.com/DonneyF/ubc-pair-grade-data.git"
PINNED_SHA = "18af317b9ded65047f8438b854317b4ff7fcb88d"
LAST_RELIABLE_YEAR = 2016

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "data" / "raw" / "pair-reports" / "UBC"

SESSION_DIR_RE = re.compile(r"^(\d{4})([SW])$")


def run_git(args, cwd):
    subprocess.run(["git", *args], cwd=cwd, check=True)


def sparse_clone_pinned_commit(dest: Path) -> Path:
    """Sparse-checkout only pair-reports/UBC at the pinned commit into dest."""
    dest.mkdir(parents=True, exist_ok=True)
    run_git(["init", "-q"], cwd=dest)
    run_git(["remote", "add", "origin", REPO_URL], cwd=dest)
    run_git(["sparse-checkout", "init", "--cone"], cwd=dest)
    run_git(["sparse-checkout", "set", "pair-reports/UBC"], cwd=dest)
    run_git(["fetch", "--depth", "1", "origin", PINNED_SHA], cwd=dest)
    run_git(["checkout", "FETCH_HEAD"], cwd=dest)
    return dest / "pair-reports" / "UBC"


def reliable_session_dirs(all_sessions_dir: Path):
    for entry in sorted(all_sessions_dir.iterdir()):
        match = SESSION_DIR_RE.match(entry.name)
        if not match:
            continue
        year = int(match.group(1))
        if year <= LAST_RELIABLE_YEAR:
            yield entry


def main():
    if RAW_DIR.exists() and any(RAW_DIR.iterdir()):
        print(f"Raw data already present at {RAW_DIR}, skipping download.")
        print("Delete data/raw/ if you want to re-download.")
        return

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        print(f"Sparse-cloning {REPO_URL} @ {PINNED_SHA[:12]} ...")
        cloned_ubc_dir = sparse_clone_pinned_commit(tmp_path)

        RAW_DIR.mkdir(parents=True, exist_ok=True)
        copied = 0
        for session_dir in reliable_session_dirs(cloned_ubc_dir):
            dest = RAW_DIR / session_dir.name
            shutil.copytree(session_dir, dest)
            copied += 1
        print(f"Copied {copied} year-session folders (<= {LAST_RELIABLE_YEAR}) to {RAW_DIR}")


if __name__ == "__main__":
    main()
