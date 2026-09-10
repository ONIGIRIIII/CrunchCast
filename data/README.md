# Data pipeline

## Source and reliability window

Primary source: [DonneyF/ubc-pair-grade-data](https://github.com/DonneyF/ubc-pair-grade-data),
pinned to commit `18af317b9ded65047f8438b854317b4ff7fcb88d` for reproducibility
(see `scripts/download_pair_data.py`).

That repo aggregates three different upstream sources over time, with
different reliability and schemas. We only use the first one, and only part
of it:

| Source | Years covered | Used here? |
|---|---|---|
| PAIR Reports | ... up to 2019 dashboard | Yes, but only **2016W and earlier** |
| Tableau Dashboard | 2019-2022 | No |
| Tableau Dashboard v2 | 2022-present | No |

The upstream repo's own README states that PAIR Reports data for 2017W
onward was found to have been altered between June and December 2019, so it
is not trustworthy. We take the conservative cutoff of **year <= 2016**
(i.e. 2016W and everything before it) for both Winter (W) and Summer (S)
sessions. This gives us 1996S through 2016W, 42 year-session terms.

Only UBC Vancouver (`Campus == "UBC"`) exists in this era, so this project
is implicitly UBC Vancouver only.

## Pipeline

Run in order from the repo root, with the venv active:

```
python data/scripts/download_pair_data.py   # -> data/raw/ (gitignored, ~50MB)
python data/scripts/clean_grades.py         # -> data/processed/sections_clean.parquet
python data/scripts/build_features.py       # -> data/processed/features.parquet
python data/scripts/eda.py                  # -> data/eda/summary.md + plots
```

`data/processed/` and `data/eda/` are committed to the repo (they're small)
so the model/API/frontend stages don't require re-downloading or
re-cleaning anything to run.

## Raw schema (per PAIR Reports CSV)

```
Campus,Year,Session,Subject,Course,Detail,Section,Title,Professor,Enrolled,
Avg,Std dev,High,Low,Pass,Fail,Withdrew,Audit,Other,
0-9,10-19,20-29,30-39,40-49,<50,50-54,55-59,60-63,64-67,68-71,72-75,76-79,
80-84,85-89,90-100
```

One row per (year, session, subject, course, section). There is also an
`OVERALL` row per (year, session, subject, course) that rolls up all
sections into one course-level row for that term.

## Known quirks and how we handle them

- **Tiny/suppressed sections.** Sections with very few enrolled students
  (labs, tutorials, some "BCS" credit-standing sections) often have blank
  `Avg`/`Std dev` even in the PAIR era. We drop rows with a missing `avg`
  and additionally require `enrolled >= 10` before using a row for the
  difficulty label, since grade stats on tiny groups are noisy and
  sometimes not really a "course experience" (e.g. a 4-person lab).
- **Duplicate rows differing only by `Professor`.** The upstream README
  flags rows that are duplicated except one has a populated `Professor` and
  the other doesn't. We do not attempt their manual per-row fix; we simply
  keep the version with a non-blank `Professor` when both exist. This is a
  documented simplification, not a perfect fix.
- **`OVERALL` rows.** We keep them in `sections_clean.parquet` (flagged
  `is_overall=True`) but exclude them from the feature table, which is
  built from individual sections only, since a student registers for a
  section, not a course-level rollup.
- **Professor name inconsistency.** Names aren't normalized across years
  (e.g. minor formatting differences, TAs sometimes listed), so the
  professor-level historical feature has a high NaN rate (about 52% of
  rows) whenever a "professor" string doesn't recur exactly. This is a
  real limitation, documented rather than hidden; the model has course- and
  subject-level fallbacks for exactly this reason.

## `difficulty_score`: the proxy label

There is no real "workload" label. We build `difficulty_score` (0-100,
higher = harder) as a composite of that section's own average grade, fail
rate, and grade standard deviation, z-scored across the full corpus and
converted to a percentile rank. See `scripts/build_features.py` for the
exact formula.

**This is a proxy for difficulty inferred from grade outcomes, not a
measurement of workload.** A course could have heavy weekly workload but
generous grading (low difficulty_score by this definition), or light
workload but a harsh curve (high difficulty_score). This limitation is
also called out in the top-level README.

## Personalization signals

`difficulty_score` blends grade average, fail rate, and grade variance with
one fixed, equal weighting. Not every student weighs those the same way, so
`build_features.py` also computes four separate 0-100 percentile-rank
columns - `grade_score`, `failrisk_score`, `variance_score`, and
`classsize_score` (percentile rank of `enrolled`, under the documented
assumption that a bigger class reads as more "crunch" for many students) -
one per real signal, instead of blending them.

**These are never used as model training features.** They're only
aggregated into the full-history lookup tables in
`model/train.py::compute_current_stats`, which `model/predict.py` already
uses for the objective score's historical fallback. At request time, a
user's quiz answers become weights over these four numbers, combined with
plain arithmetic - not a retrained model. There's no per-user ground truth
to train a model against (nobody has rated their personal "crunch"
experience across the historical dataset), so this is a transparent
re-weighting of real historical numbers rather than new machine learning.
See `model/predict.py`'s module docstring and `WEIGHT_TO_COMPONENT` for the
implementation.

## Leakage rule for features

The label for a given offering is built from that same offering's own
outcomes, so **the model must never see a row's own avg/fail_rate/std_dev as
input**. All model features (`hist_course_mean_difficulty`,
`hist_subject_mean_difficulty`, `hist_professor_mean_difficulty`,
`global_running_mean_difficulty`, offering counts) are computed using only
offerings strictly earlier in `session_order` for the relevant group. See
`data/scripts/build_features.py::_prior_mean_and_count`.

## Course metadata stub

`data/external/course_metadata.csv` is a small, hand-curated stub of course
credit weights for a handful of well-known courses, used only to weight the
term-level risk score. Everything not in that file falls back to a 3-credit
default (`metadata_provider.py::DEFAULT_CREDITS`). This is **not** a real
UBC course catalog; UBC's current catalog is behind a Workday login and
isn't scrapable, so this is intentionally stubbed with a documented
`MetadataProvider` interface so a real source can be swapped in later
without touching model or API code.
