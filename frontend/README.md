# Frontend

Next.js (App Router) + Tailwind course-picker UI for the UBC Course Workload
Predictor. Calls the FastAPI service in `../api` and renders a per-course
breakdown plus a term-level risk readout.

## Run locally

```
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, defaults to http://localhost:8000
npm run dev
```

The API (`../api`) must be running separately (`uvicorn main:app --reload`
from `api/`).

## Structure

- `app/page.tsx` - page shell.
- `app/components/CourseBuilder.tsx` - add/remove courses, calls the API.
- `app/components/TermResults.tsx` - term readout + per-course breakdown.
- `app/components/DifficultyBadge.tsx` / `ConfidenceNote.tsx` - small
  presentational pieces.
- `lib/api.ts` - typed fetch wrapper for `POST /predict`; the only file that
  knows the API's shape.

## Notes

- Difficulty scores and the "confidence" note are surfaced directly from the
  API so the UI can't drift out of sync with what the model actually knows;
  see the root README for what the score does and doesn't mean.
- Verified manually in a real browser: adding/removing courses, a full
  three-course prediction, and an unknown-course request (which correctly
  falls back to "very low confidence" and a low-confidence warning banner).
