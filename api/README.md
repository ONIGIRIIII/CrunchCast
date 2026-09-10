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
  subject/course pair we have historical data for. Powers the frontend's
  course search autocomplete.
- `POST /predict` - body: `{"courses": [{"subject": "CPSC", "course": "110", "session": "W"}, ...], "weights": {...}}`
  (1-8 courses, `session` optional, defaults to `"W"`; `weights` optional).
  Returns per-course difficulty plus a credit-weighted term-level score.
  `weights` is `{grade, failrisk, variance, classsize}` (each >= 0, need not
  sum to 1) - when present, every course/term response also includes a
  `personalized_score` / `term_personalized_score`, a weighted combination
  of four real historical signals (not a retrained model - see
  `model/predict.py`'s module docstring). See `schemas.py` for the full
  request/response shape.

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
