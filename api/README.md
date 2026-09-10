# API

FastAPI service that wraps the trained model (`model/predict.py`,
`model/aggregate.py`) in a `/predict` endpoint.

## Run locally

From the repo root, with the venv set up and `model/train.py` already run
at least once (see `../model` artifacts):

```
.venv/Scripts/python -m uvicorn main:app --reload --port 8000
```

(run from inside `api/`, or add `--app-dir api` if running from the repo
root). Docs at `http://127.0.0.1:8000/docs`.

## Endpoints

- `GET /health` - liveness check.
- `GET /courses` - `{"subjects": {"CPSC": ["100", "110", ...], ...}}`, every
  subject/course pair we have ANY historical data for. Powers the
  frontend's course search autocomplete. This is the union of the
  predictor's own PAIR-era (<=2016W) catalog and the history browser's
  wider (1996-2025) catalog - a course introduced after 2016 (e.g.
  CPSC 330, first offered 2019W) has zero PAIR-era offerings and would be
  missing from search entirely if this only used the predictor's catalog,
  even though `/predict` can still score it (falling back to subject/global
  estimates) and `/history` has real data for it. See
  `model_service.py::get_catalog`.
- `POST /predict` - body: `{"courses": [{"subject": "CPSC", "course": "110", "session": "W"}, ...], "weights": {...}}`
  (1-5 courses, `session` optional, defaults to `"W"`; `weights` optional).
  Returns per-course difficulty plus a credit-weighted term-level score.
  `weights` is `{grade, failrisk, variance, classsize}` (each >= 0, need not
  sum to 1) - when present, every course/term response also includes a
  `personalized_score` / `term_personalized_score`, a weighted combination
  of four real historical signals (not a retrained model - see
  `model/predict.py`'s module docstring). Every course also always includes
  `explanation`: the same four signals (grade impact, fail risk, grading
  unpredictability, class size), each as a 0-100 score plus a plain-English
  detail string (e.g. "12% of students historically fail") - this is what
  the frontend's per-course bar chart renders, and it explains the
  objective `difficulty_score` too, not just a personalized one. See
  `schemas.py` for the full request/response shape.
- `GET /courses/{subject}/{course}/history` - real per-term stats (avg,
  std dev, high, low, fail rate, enrolled, `instructors`, `distribution`,
  `sections`, `instructor_stats`, `best_instructor`), most recent term
  first, spanning 1996 through whatever's most recently available
  (currently 2025W). **Not the same data window the predictor uses** - the
  model only ever trains/predicts on PAIR Reports data through 2016W; this
  endpoint additionally draws on two newer, non-corrupted sources
  (`tableau-dashboard` for 2017-2021, `tableau-dashboard-v2` for 2022+)
  purely for display. `std_dev` is `null` for 2022+ terms since that source
  doesn't report it - never estimated. `instructors` is every distinct name
  reported across that term's sections (empty list if none). `distribution`
  is the 11-bin grade breakdown (`{bin, count}` pairs) for that term,
  `null` when the term's stats are unavailable/suppressed. `sections` is
  that term's actual, individual sections (`section`, `instructors`, `avg`,
  `std_dev`, `fail_rate`, `enrolled`, `distribution`), un-combined - for
  picking one specific section and seeing just its own numbers,
  instructor(s), and its own 11-bin distribution (not the term's blended
  one). `instructor_stats` is the same term's sections combined up to instructor
  granularity (`instructor`, `sections`, `avg`, `std_dev`, `fail_rate`,
  `enrolled`) - each instructor's own sections that term merged
  (enrollment-weighted) into a single row, so a professor teaching two
  sections shows up once, not twice - for the "Overall" comparison view.
  `best_instructor` is the instructor with the highest combined average
  grade that term, or `null` when fewer than 2 instructors taught that
  term; "challenge for credit"
  exam-only sections are excluded entirely before any of this, never
  eligible to win. **Not a teaching-quality rating** - correlational grade
  history only, confounded by self-selection and exam difficulty; the
  schema docstring and UI copy say this explicitly. See `data/README.md`'s
  "Course-term history browser" and "Per-term instructor stats and best
  pick this term" sections.

## Config

- `API_CORS_ORIGINS`: comma-separated list of allowed frontend origins.
  Defaults to `*` (fine for local dev); set this to the deployed frontend
  URL in production (see the root README's deployment section).

## Notes

- The model is loaded once at process startup (FastAPI lifespan handler in
  `main.py`), not per-request.
- `model_service.py` is the only file that knows about `model/`'s internal
  layout; `main.py` and `schemas.py` only talk to it, so the model package
  could be swapped or versioned independently of the API layer.
- Tests: `pytest api/tests` (from the repo root, with the venv active).
