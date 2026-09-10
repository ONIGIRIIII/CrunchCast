# Data pipeline

## Source and reliability window

Primary source: [DonneyF/ubc-pair-grade-data](https://github.com/DonneyF/ubc-pair-grade-data),
pinned to commit `18af317b9ded65047f8438b854317b4ff7fcb88d` for reproducibility
(see `scripts/download_pair_data.py`).

That repo aggregates three different upstream sources over time, with
different reliability and schemas. **The prediction model uses only the
first one** (PAIR Reports, <=2016W); the other two are used ONLY for the
separate "view by term" history browser, never for training or prediction:

| Source | Years covered (UBCV) | Used for the model? | Used for the history browser? |
|---|---|---|---|
| PAIR Reports | 1996S-2016W | **Yes** | Yes |
| `tableau-dashboard` ("v1") | 2017S-2021W (2014-2016 overlap with PAIR skipped) | No | Yes |
| `tableau-dashboard-v2` | 2022S-latest (currently 2025W) | No | Yes |

The upstream repo's own README states that PAIR Reports data for 2017W
onward was found to have been altered between June and December 2019, so it
is not trustworthy **for the model** - we take the conservative cutoff of
**year <= 2016** (i.e. 2016W and everything before it) for both Winter (W)
and Summer (S) sessions for anything that feeds `features.parquet`. This
gives the model 1996S through 2016W, 42 year-session terms.

The two Tableau-sourced folders are different, non-corrupted exports (not
the altered PAIR data) - see "Course-term history browser" below for how
they're used to extend the *display* window to the present without
touching what the model trains or predicts on.

Only UBC Vancouver (`Campus == "UBC"` / `"UBCV"` depending on source) exists
across all three, so this project is implicitly UBC Vancouver only.

## Pipeline

Run in order from the repo root, with the venv active:

```
python data/scripts/download_pair_data.py   # -> data/raw/pair-reports/ (gitignored, ~50MB)
python data/scripts/clean_grades.py         # -> data/processed/sections_clean.parquet
python data/scripts/build_features.py       # -> data/processed/features.parquet
python data/scripts/eda.py                  # -> data/eda/summary.md + plots

# History browser only (does not affect the model at all):
python data/scripts/download_tableau_data.py  # -> data/raw/tableau-dashboard{,-v2}/ (gitignored)
python data/scripts/clean_tableau_data.py     # -> data/processed/course_term_stats.parquet
python data/scripts/clean_section_stats.py    # -> data/processed/course_section_stats.parquet
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
rate, and grade standard deviation, z-scored and converted to a percentile
rank **within course_level** (100/200/.../600) - not across the whole
catalog. See `scripts/build_features.py::add_difficulty_label` for the
exact formula.

**Why within-level, not global:** we checked mean `difficulty_score` by
level on this dataset and it was ~70 for 100-level courses vs. ~18-20 for
500/600-level - the catalog is dominated by generously-graded grad and
professional-program offerings. Ranking a 100-level course against that
whole pool made almost every popular intro course (CPSC 110, MATH 100,
ENGL 110, ...) look "hard" by construction, which isn't the comparison a
student choosing between intro courses actually cares about. Ranking
within course_level means a score reflects how a course compares to its
real peers, and the MAE in `model/reports/evaluation_report.md` is
noticeably higher as a direct, honest consequence of removing that
easy-to-predict-but-not-useful signal.

**This is a proxy for difficulty inferred from grade outcomes, not a
measurement of workload.** A course could have heavy weekly workload but
generous grading (low difficulty_score by this definition), or light
workload but a harsh curve (high difficulty_score). This limitation is
also called out in the top-level README.

## Personalization signals

`difficulty_score` blends grade average, fail rate, and grade variance with
one fixed, equal weighting. Not every student weighs those the same way, so
`build_features.py` also computes four separate 0-100 percentile-rank
columns (also within course_level, same reasoning as above) -
`grade_score`, `failrisk_score`, `variance_score`, and `classsize_score`
(percentile rank of `enrolled`, under the documented assumption that a
bigger class reads as more "crunch" for many students) - one per real
signal, instead of blending them.

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

## Course-term history browser (separate from the model)

`data/processed/course_term_stats.parquet` powers `GET
/courses/{subject}/{course}/history` and the frontend's "View by term"
panel - real per-term numbers (average, std dev, high, low, fail rate,
enrolled, instructors, and the 11-bin grade distribution - see
`data/scripts/grade_bins.py`) for a specific year+session, not an
aggregate. It spans 1996 through whatever's most recently available
(currently 2025W), built by `data/scripts/clean_tableau_data.py` from
three sources with different schemas:

- **PAIR (<=2016W)**: reuses the `OVERALL` rows already in
  `sections_clean.parquet` - has a real `Fail` count.
- **`tableau-dashboard` v1 (2017S-2021W)**: has a real `OVERALL` row and
  `std_dev`, but no `Fail` column - `fail_rate` is derived from the `<50`
  grade-count bin instead (`<50 count / Enrolled`). This is a faithful
  re-derivation from real reported bin counts, not fabricated data, but
  may differ slightly from PAIR's own `Fail`-column definition.
- **`tableau-dashboard-v2` (2022S+)**: has **no `OVERALL` row at all** (we
  synthesize one per term by aggregating across that term's sections -
  enrollment-weighted average, max/min for high/low, summed `<50` bins for
  `fail_rate`) and **no `std_dev` statistic in the source at all**. Rather
  than estimate one from the grade-count bins, `std_dev` is reported as
  `null`/"not reported" for every 2022+ term - consistent with this
  project's "don't fabricate data, stub it clearly" principle (see the
  course metadata stub below).

**`instructors`**: none of the three sources' `OVERALL`/term-level rows
carry a professor name (a term can span several sections with different
instructors), so it's collected separately from that term's individual
section rows - every distinct, non-blank name (sections list multiple
instructors separated by `;`), in the order first seen. Empty list, shown
as "-" in the UI, if none were reported that term.

**Grade distribution**: PAIR's raw CSVs break grades below 50 down further
into five sub-bins (0-9, 10-19, ..., 40-49); their own `<50` column is
already the total of those five (verified against a real row: CPSC 110
2016W has 0-9..40-49 summing to 239, and `<50`=239, and `Fail`=239 - all
three agree), so `<50` is used directly rather than re-summing the finer
columns underneath it, which would double-count. See `grade_bins.py`.

**This table is never read by `build_features.py`, `train.py`, or
`predict.py`.** The prediction model only ever sees PAIR data through
2016W; extending the *history browser's* display window to 2025W carries
zero risk of newer, differently-sourced, or unvetted-for-modeling data
leaking into what the model trains or predicts on.

## Per-term instructor stats and "best pick this term" (also separate from the model)

`data/processed/course_section_stats.parquet`, built by
`data/scripts/clean_section_stats.py`, is the raw per-SECTION building
block: one row per (subject, course, year, session, section) - instructor(s),
avg, std dev, fail rate, enrolled. `model/history.py` reads it two ways for
each term:

- **`sections`** - the raw rows as-is, one per real section, for picking a
  specific section (e.g. "Section 102") and seeing exactly that section's
  own numbers and its instructor(s) - no combining.
- **`instructor_stats`/`best_instructor`** (`_instructor_stats_for_term`) -
  the same rows combined up to instructor granularity: every section a
  given instructor taught within that term is merged into one
  enrollment-weighted row, for the "Overall" comparison view.

Both are scoped strictly to that one term, unlike the now-removed all-time
instructor comparison this replaces (see below). Same three sources and
same "never read by the model" separation as the term-stats table above.

This replaced an earlier all-time, cross-term "compare instructors" table
(`instructor_course_stats.parquet`, `clean_instructor_stats.py`) built as
the legitimate half of a request to integrate RateMyProfessors (RMP)
ratings - RMP itself was declined since its Terms of Use explicitly
prohibit automated scraping and no legitimate, redistributable snapshot of
UBC RMP data exists. The all-time version was removed at the user's
request in favor of this term-scoped view: a student picking a term wants
to know who's teaching *that specific offering*, not a professor's career
average, and the "best pick" framing only makes sense when it's actually
comparing the real choices on offer that term.

The comparison view (Overall) was then further refined, again at the
user's request, from a per-SECTION comparison (a professor teaching two
sections would show up as two separate rows) to a per-INSTRUCTOR
comparison - a student cares how a professor has graded that term overall,
not which lecture/lab code they happened to be assigned. A follow-up
request then asked for the section-level picker back alongside it: pick
"Overall" to compare instructors (combined across their sections that
term), or pick one specific section to see just that section's own
numbers and instructor name(s) - not combined with anything else, since
those numbers are "already displaying the stats from that section."

**Combining across sections for the Overall comparison**: for each term, a
section's stats are attributed in full to every instructor listed on it
(";"-separated, co-taught sections attribute fully to each - documented
simplification, the data doesn't say who taught which part), then grouped
by instructor and enrollment-weighted together (`avg`, `fail_rate`;
`std_dev` only over the sections that report one, `null` if none do). E.g.
CPSC 110 2016W: Gregor Kiczales taught both section 102 and BCS that term
- the Overall comparison shows one row for him (`sections: ["102", "BCS"]`,
82.5% enrollment-weighted `avg`), not two - but selecting "Section 102"
directly shows that section's own 80.7% average instead.

**"Best pick this term"** is deliberately simple: the instructor with the
highest combined average grade that term, computed only when 2+
instructors taught that term (`None` otherwise - no badge on a
single-instructor term). This is **not a teaching-quality rating** -
self-selection into sections, exam difficulty, and TA support all confound
a raw average - and both the API schema docstring and the frontend UI copy
say so explicitly.

**"Challenge for credit" sections are excluded** before any of the above.
Section codes containing "CH" (e.g. `1CH`, `CH1`, `9CH`) are an exam-only
credit mechanism for students who already know the material, not a real
section a student chooses between - and their tiny, self-selected cohorts
score artificially high (92-93% on fewer than 20 students), which was
initially winning "best pick" for reasons that have nothing to do with a
normal section's teaching. Filtered out by
`clean_section_stats.py::_drop_challenge_sections` (20 rows filtered
across the full dataset).

Sections with no instructor listed at all can't be attributed to anyone
and are dropped from this per-instructor comparison (they still count
toward the term's own blended Overall stats, which come from
`course_term_stats.parquet` and are unaffected).

## Course metadata stub

`data/external/course_metadata.csv` is a small, hand-curated stub of course
credit weights for a handful of well-known courses, used only to weight the
term-level risk score. Everything not in that file falls back to a 3-credit
default (`metadata_provider.py::DEFAULT_CREDITS`). This is **not** a real
UBC course catalog; UBC's current catalog is behind a Workday login and
isn't scrapable, so this is intentionally stubbed with a documented
`MetadataProvider` interface so a real source can be swapped in later
without touching model or API code.
