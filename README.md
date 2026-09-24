# UBC Course Workload Predictor

An end-to-end data science project: historical UBC grade data feeds a supervised
model that scores a course's "difficulty" as a proxy for workload, served through
a FastAPI backend and a Next.js frontend where a student picks courses for a term
and sees a per-course breakdown, a term-level risk score, and a real historical
grade browser going back to 1996.

Built as a portfolio project for a data science / AI role. Code quality, honest
evaluation, and candid documentation of what the model does and doesn't measure
matter as much as the app working.

## The problem and the honest answer

There is no public "how hard is this course" label for UBC courses, so this
project builds a **proxy**: `difficulty_score` (0-100) is a percentile-ranked
composite of a course offering's own historical average grade, fail rate, and
grade variance, computed **within its course level** (100/200/.../600) rather
than across the whole catalog.

That "within course level" detail matters and was not the first design. Ranking
difficulty globally made almost every intro course (CPSC 110, MATH 100, ENGL 110)
look "hard," because the catalog is dominated by generously-graded graduate and
professional-program offerings (mean difficulty was ~70 for 100-level courses
vs. ~18-20 for 500/600-level under a global ranking). Re-ranking within course
level fixed that at the cost of a harder, more honest prediction task: it
removed an easy-to-predict-but-not-useful signal (a course's level), which
raised the model's error rate versus the earlier global-ranking version - a
deliberate, documented tradeoff, not a regression. See
`model/reports/evaluation_report.md` for the full error breakdown.

**This is explicitly not a workload measurement.** A course can have a heavy
weekly workload but generous grading (low `difficulty_score`), or a light
workload but a harsh curve (high `difficulty_score`). Every surface in the app
(API descriptions, UI copy) says this directly rather than implying otherwise.

## Results

| Model | MAE | RMSE | R2 |
|---|---|---|---|
| Heuristic baseline (historical lookup, no ML) | 16.38 | 21.35 | 0.448 |
| XGBoost (shipped) | 16.00 | 20.47 | 0.492 |

XGBoost beats a plain historical-lookup baseline by a modest 2.3% MAE
improvement - expected, since most of the real signal in this proxy label is a
course's own trailing history, so a much bigger jump would be more suspicious
than reassuring. Full feature importances, per-subject error breakdown, and the
worst individual predictions are in `model/reports/evaluation_report.md`.

## Architecture

```
data/    Raw grade data -> cleaned tables -> engineered features
model/   XGBoost training, evaluation, inference, term-history lookups
api/     FastAPI service wrapping the model and the history/instructor data
frontend/  Next.js app: course picker, prediction UI, term-history browser
```

Each of `data/`, `api/`, and `frontend/` has its own README with full detail
(data sources and known quirks, API endpoints, component breakdown). This file
is the map; those are the territory.

### Data: two windows, kept strictly separate

The model is trained **only** on UBC's PAIR Reports data through 2016W (the
upstream source documents that PAIR data from 2017W onward was altered, so it's
excluded entirely from anything the model touches). A separate "view by term"
history browser extends coverage through whatever's most recently available
(currently 2025W) using two additional, already-vetted sources from the same
GitHub repo (`tableau-dashboard`, `tableau-dashboard-v2`) - but this is a
**display-only** pipeline (`course_term_stats.parquet`, `course_section_stats.parquet`)
that `build_features.py`, `train.py`, and `predict.py` never read. The predictor's
data window and the history browser's data window are deliberately different and
that's documented everywhere it matters (see `data/README.md`).

No live scraping was ever added to this project. UBC's live course catalog
(Workday) and ubcgrades.com were both considered and ruled out as data sources
for exactly this reason; RateMyProfessors was investigated and declined for the
same reason (its Terms of Use prohibit automated scraping, and no legitimate
redistributable dataset exists) - see `data/README.md` for the full reasoning
trail on all three.

### Model: XGBoost, not a black box

- Chronological train/test split (train <=2013W, test 2014W-2016W) to avoid
  leakage; the shipped model is refit on all available data with the same
  config once that split validates it.
- Every prediction ships with an `explanation`: the same four real signals
  behind the score (grade impact, fail risk, grading unpredictability, class
  size), each as its own 0-100 score plus a plain-English detail line - not just
  a single opaque number.
- **Personalization is not a second model.** A student's quiz answers become
  weights over the four precomputed historical signals, combined with plain
  arithmetic at request time. There's no per-user ground truth to train against
  (nobody has rated their personal "crunch" experience across this historical
  dataset), so this is a transparent re-weighting of real numbers, not new
  machine learning dressed up to look personalized.

### API

FastAPI, four endpoints: `/health`, `/courses` (catalog), `/predict` (objective
+ optional personalized scores, with the full explanation breakdown), and
`/courses/{subject}/{course}/history` (real per-term stats spanning 1996-2025,
including per-section and per-instructor-combined comparisons for a given term
and each one's own grade distribution). Full request/response shapes in
`api/README.md`.

### Frontend

Next.js + Tailwind, styled as a dark, blocky, monospace "terminal" UI (no
rounded corners, no drop shadows - sections are divided by shared grid lines
instead of nested card boxes). Search-as-you-type course picker (no cap on
courses/term), optional personalization quiz, per-course explanation bar
charts, and a "View by term" panel per course: pick any term back to 1996,
then either "Overall" (that term's blended stats, grade distribution, and a
comparison of that term's actual instructors with a "[BEST]" tag - explicitly
labeled as historical grade outcomes, not a teaching-quality rating) or one
specific section (its own un-combined stats, instructor, and grade
distribution). Full component breakdown and design-system notes in
`frontend/README.md`.

## Setup

Requires Python 3.12+ and Node 20+.

```bash
# One-time: create the venv and install backend deps
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt   # Windows; use .venv/bin/pip on macOS/Linux

# Data pipeline (see data/README.md for the full command list and what each writes)
./.venv/Scripts/python data/scripts/download_pair_data.py
./.venv/Scripts/python data/scripts/clean_grades.py
./.venv/Scripts/python data/scripts/build_features.py
./.venv/Scripts/python data/scripts/download_tableau_data.py
./.venv/Scripts/python data/scripts/clean_tableau_data.py
./.venv/Scripts/python data/scripts/clean_section_stats.py

# Train the model (writes model/artifacts/ and model/reports/evaluation_report.md)
./.venv/Scripts/python model/train.py
./.venv/Scripts/python model/evaluate.py

# Run the API (from api/, port 8000)
cd api && ../.venv/Scripts/python -m uvicorn main:app --reload --port 8000

# Run the frontend (from frontend/, port 3000)
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, defaults to http://localhost:8000
npm run dev
```

`data/processed/` and `model/artifacts/` are committed (small enough), so a
clone can run the API and frontend without redoing the pipeline - the commands
above are for regenerating them from scratch.

## Testing

```bash
./.venv/Scripts/python -m pytest model/tests api/tests -q
```

Every feature in this project was verified two ways before being called done:
the automated suite above, and a live check in a real browser (not just type
checking or a passing test suite) - `frontend/README.md` lists what was
manually verified at each stage.

## Known limitations (read before trusting a score)

- **Proxy, not ground truth.** `difficulty_score` measures historical grade
  outcomes, not workload, time commitment, or teaching quality. See "The
  problem and the honest answer" above.
- **The predictor's data stops at 2016W.** A course's teaching staff,
  curriculum, and grading have all had a decade to change; the prediction is a
  historical baseline, not a forecast of this specific offering.
- **The history browser (1996-2025) and the predictor (through 2016W only) use
  different data windows on purpose** - explained above and in every relevant
  README, never silently blurred together in the UI.
- **`std_dev` is honestly `null`, not estimated,** for 2022+ history-browser
  terms, since that source doesn't report it.
- **Professor names aren't normalized.** The model's professor-level history
  feature has a high NaN rate (~52% of rows) whenever a name string doesn't
  recur exactly, and instructor names in the history browser are shown as
  reported by each source, unmerged; documented in `data/README.md` rather
  than silently wrong.
- **"Best pick this term" is a raw average, not a teaching-quality judgment.**
  Self-selection into sections, exam difficulty, and TA support all confound
  it - the UI says this explicitly next to the badge.
- **Small offering counts mean low confidence.** The API reports a
  `confidence` level per course, and the frontend surfaces a warning banner
  for low-confidence predictions rather than presenting every score with equal
  certainty.
- **UBC Vancouver only.** All three underlying data sources only reliably
  cover the Vancouver campus.
