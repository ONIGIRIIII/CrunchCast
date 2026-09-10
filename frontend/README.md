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
  2025W), then a specific section within that term (or "Overall"). With
  "Overall" selected, shows that term's blended avg/std-dev/high/low/
  fail-rate/enrolled/distribution plus a comparison table of that term's
  actual instructors (each instructor's sections that term combined into
  one enrollment-weighted row - a professor teaching two sections shows up
  once, not twice) with a "Best pick this term" badge on the
  highest-average instructor (only shown when 2+ instructors taught that
  term) and a disclaimer that this is historical grade outcomes only, not a
  teaching-quality rating. With one specific section selected (e.g.
  "Section 102"), shows only that section's own numbers (not combined with
  any other section), its instructor(s), and its own grade distribution
  chart - no comparison table, no badge. Both views render a
  `GradeDistributionChart`: the term's blended distribution for Overall, or
  the selected section's own (smaller) distribution otherwise - never the
  same numbers shown twice. Sections are scoped strictly to the selected
  term, never an all-time list; a term→section reset on term change happens
  in the `selectTerm()` handler rather than a `useEffect`, to avoid the
  `react-hooks/set-state-in-effect` lint rule.
- `app/components/GradeDistributionChart.tsx` - a reusable 11-bin grade
  distribution bar chart (single hue - a bar chart's height already
  encodes magnitude, so color doesn't need to do that job too), with a
  hover tooltip showing the exact count and percentage per bin. Used by
  `CourseHistoryPanel.tsx` for both the term-level (Overall) and
  section-level distributions.
- `app/components/DifficultyBadge.tsx` / `ConfidenceNote.tsx` - small
  presentational pieces; `lib/scoreColor.ts` is the shared 0-100 color scale.
- `lib/api.ts` - typed fetch wrapper for `GET /courses`, `POST /predict`,
  and `GET /courses/{subject}/{course}/history` (including its per-term
  `sections` and `instructor_stats`/`best_instructor` fields); the only
  file that knows the API's shape.

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
  singular/plural "Instructor(s)" label switching correctly), the
  per-term Overall instructor comparison table (confirmed CPSC 110 2016W's
  highest-average instructor, Kiczales at 82.5% combining sections 102 and
  BCS into one row, is the one marked "Best pick this term," and that
  "CH"-coded challenge-for-credit sections never appear), and a
  specific-section selection (e.g. "Section 102") showing only that
  section's own 80.7% average and instructor with no comparison table or
  badge - distinct from Overall's combined 82.5% for the same instructor -
  the section's own grade distribution chart rendering alongside it
  (confirmed visually smaller/different from the term's blended
  distribution, not the same chart repeated), and an unknown-course request
  (falls back to "very low confidence" with a low-confidence warning
  banner).
