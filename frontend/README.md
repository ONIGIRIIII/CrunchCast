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
- `app/components/CourseBuilder.tsx` - add/remove courses (max 5/term),
  owns personalization state, calls the API.
- `app/components/CourseSearch.tsx` - search-as-you-type autocomplete over
  `GET /courses`, with manual subject/course/session fields as a fallback.
- `app/components/PersonalizationQuiz.tsx` - 8-question quiz that turns
  answers into weights (`lib/weights.ts`), saved to `localStorage`.
- `app/components/TermResults.tsx` - term readout + per-course breakdown.
- `app/components/ExplanationChart.tsx` - per-course bar chart of the four
  real signals (grade impact, fail risk, grading unpredictability, class
  size) behind a score, each with a plain-English detail line.
- `app/components/DifficultyBadge.tsx` / `ConfidenceNote.tsx` - small
  presentational pieces; `lib/scoreColor.ts` is the shared 0-100 color scale.
- `lib/api.ts` - typed fetch wrapper for `GET /courses` / `POST /predict`;
  the only file that knows the API's shape.

## Notes

- Difficulty scores, the "confidence" note, and the explanation breakdown
  are all surfaced directly from the API so the UI can't drift out of sync
  with what the model actually knows; see the root README for what the
  score does and doesn't mean.
- Verified manually in a real browser at each stage: adding/removing
  courses, the 5-course cap, search autocomplete, the personalization quiz
  and its weighted "crunch score," the per-course explanation bar charts,
  and an unknown-course request (falls back to "very low confidence" with
  a low-confidence warning banner).
