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
- `app/components/CourseHistoryPanel.tsx` - per-course "View by term"
  toggle: lazy-fetches `GET /courses/{subject}/{course}/history` and lets
  you pick a specific term (1996 through the latest available, currently
  2025W) to see that term's real avg/std-dev/high/low/fail-rate/enrolled/
  instructors, as opposed to the all-time average the score itself is
  based on.
- `app/components/GradeDistributionChart.tsx` - the selected term's 11-bin
  grade distribution as a bar chart (single hue - a bar chart's height
  already encodes magnitude, so color doesn't need to do that job too),
  with a hover tooltip showing the exact count and percentage per bin.
- `app/components/DifficultyBadge.tsx` / `ConfidenceNote.tsx` - small
  presentational pieces; `lib/scoreColor.ts` is the shared 0-100 color scale.
- `lib/api.ts` - typed fetch wrapper for `GET /courses`, `POST /predict`,
  and `GET /courses/{subject}/{course}/history`; the only file that knows
  the API's shape.

## Notes

- Difficulty scores, the "confidence" note, and the explanation breakdown
  are all surfaced directly from the API so the UI can't drift out of sync
  with what the model actually knows; see the root README for what the
  score does and doesn't mean.
- The per-term history panel intentionally covers a WIDER window (1996-2025)
  than the prediction model (1996-2016W only) - see `data/README.md`'s
  "Course-term history browser" section for why that's safe (two additional
  non-corrupted sources, used only for display, never for the model).
- Verified manually in a real browser at each stage: adding/removing
  courses, the 5-course cap, search autocomplete, the personalization quiz
  and its weighted "crunch score," the per-course explanation bar charts,
  the term-picker (checked both a 2025W term with no reported std dev and
  a 2016W term with one, against the raw API response), the grade
  distribution chart's hover tooltip, instructor names (including the
  singular/plural "Instructor(s)" label switching correctly), and an
  unknown-course request (falls back to "very low confidence" with a
  low-confidence warning banner).
