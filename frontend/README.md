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

## Design system

The UI is a dark, blocky, monospace "terminal / markdown file" theme rather
than a rounded-corner SaaS dashboard - loosely inspired by
[rig.ai](https://rig.ai/)'s use of bright accent color against a near-black
background and grid-line section division instead of card boxes.

- **Tokens** live entirely in `app/globals.css` as CSS custom properties
  (`--background`, `--surface`, `--foreground`, `--border`, `--border-strong`,
  `--text-muted`, `--text-subtle`, `--hover-surface`), re-exposed to Tailwind
  v4 via an `@theme inline` block (so `bg-[var(--color-surface)]` etc. work
  as arbitrary-value utilities and stay reactive to the `[data-theme="light"]`
  override on `<html>`, toggled by the header's theme button via
  `lib/theme.ts`).
  - `--severity-hard` / `--severity-moderate` / `--severity-easy` - a
    muted-then-brightened red/amber/green scale (currently Tailwind's
    500-level hues) used **only** as text, thin borders, or small square
    indicators (`lib/scoreColor.ts`'s `bandFor`/`gaugeRingFor`) - never as a
    fill, background, or gradient.
  - `--chart-accent` - a single vivid orange-red (`#ed462d`, sampled from
    rig.ai's own accent) used for the two line/area charts
    (`TermScoreChart.tsx`, `GradeDistributionChart.tsx`) so the data line
    itself is the one thing that "pops" against the flat background.
  - `--accent` / `--on-accent` - not new hues, just `var(--foreground)` /
    `var(--background)` themselves, so every primary button and active-state
    row is an inverted monochrome block (light-on-dark in dark mode,
    dark-on-light in light mode) rather than a hardcoded brand color, and it
    flips automatically with the theme toggle.
- **No rounded corners and no shadows anywhere** - every corner is square
  (`rounded-*` is never used) and containers are separated by 1px lines, not
  `box-shadow`.
- **Grid lines instead of nested cards**: repeated/grouped content (the
  course list, the per-course breakdown list, stat grids) is one flat
  `divide-y`/`divide-x` block rather than each item being its own
  bordered+backgrounded "card." Adjacent bordered regions share a single
  line with **zero padding gap** between them so corners actually connect
  (e.g. the vertical line between the course-picker column and the results
  column touches the horizontal rule above and below it, forming clean
  T-junctions) - a region that would otherwise grow a second, immediately-
  adjacent border drops its own side instead of doubling up. Only genuinely
  standalone controls (the sidebar panel, modals, the search input +
  dropdown) keep a full 4-sided outline.
- **Section headings** (`Term Builder`, `Overview`, `Course Description`,
  `Saved Terms`) are oversized (`text-3xl`/`text-4xl`), bold, uppercase, and
  letter-spaced, each framed by the shared border convention above rather
  than a colored bar. `Overview` and `Course Description`, plus every
  individual course row inside the latter, are toggle buttons (a chevron on
  the right, rotating 180° when open) that collapse/expand their content -
  state lives in `TermResults.tsx` (`overviewOpen`, `courseDescOpen`, and a
  `Set` of collapsed course keys).
- **No per-course color coding.** An earlier version gave each course its
  own hue (a dot) or a monochrome glyph; both were dropped in favor of a
  plain `#1`/`#2`/... index prefix in muted grey ahead of the course name,
  since the course code itself is already the real identifier.
- Everything renders in one monospace face (Geist Mono, loaded in
  `app/layout.tsx`) - there is no separate sans-serif font anywhere.

## Structure

- `app/page.tsx` - page shell.
- `app/components/CourseBuilder.tsx` - top nav bar (logo, personalize toggle,
  theme toggle) plus the left "Saved Terms" sidebar (collapsible to an
  icon rail, saved collections with predict/delete actions) and the main
  content column; owns course add/remove state, personalization state, and
  calls the API.
- `app/components/CourseSearch.tsx` - search-as-you-type autocomplete over
  `GET /courses`, with manual subject/course/session fields as a fallback.
  `GET /courses` is the union of the predictor's PAIR-era catalog and the
  history browser's wider one (see `data/README.md`'s "Search catalog bug
  fix"), so a course introduced after 2016W (e.g. CPSC 330) is searchable
  here even though the predictor falls back to subject/global estimates
  for it.
- `app/components/PersonalizationQuiz.tsx` - 8-question quiz that turns
  answers into weights (`lib/weights.ts`), saved to `localStorage`.
- `app/components/TermResults.tsx` - the post-predict layout, as one
  two-column grid: a sticky **"Term Builder"** column on the left (the
  course search/Predict/Save controls under "Add Course", then the list of
  added courses under "Course Selection") beside a right column with two
  collapsible sections - **"Overview"** (a 3-up row: term risk readout +
  stat grid, the per-course score line chart, and the averaged signal bar
  chart) and **"Course Description"** (every added course's own signal
  gauges + `CourseHistoryPanel`, each course independently collapsible).
  Below the `lg` breakpoint the two columns stack and the left column stops
  sticking.
- `app/components/SignalBars.tsx` - horizontal bar chart of the four real
  signals (grade impact, fail risk, grading unpredictability, class size),
  averaged across the term - label + value above, a full-width hatch-track
  bar below it colored by that signal's own severity band, with a small
  triangle marker sitting just above the bar pointing at the value's exact
  position. Used only for "Overview"'s term-level average; per-course
  signals use `SignalGauges.tsx` instead (a row of small gauges, one per
  signal, each with its plain-English detail line as a caption).
- `app/components/RiskGauge.tsx` - semi-circular gauge for a 0-100 score,
  flat (non-rounded) stroke caps, colored by the same severity scale
  everywhere else (`gaugeRingFor` in `lib/scoreColor.ts`), with the same
  triangle value-marker as `SignalBars.tsx` sitting just outside the arc,
  built from vector math (not an SVG `rotate()`) so it points inward
  correctly at every angle. Reused at small size by `SignalGauges.tsx` for
  each per-course signal.
- `app/components/TermScoreChart.tsx` - "Overview"'s line/area chart of each
  course's own score across the term (real per-course scores, not a
  fabricated time series), in the shared `--chart-accent` orange, with
  y-axis tick labels and a dashed term-average reference line.
- `app/components/CourseTicker.tsx` - a horizontal course-summary strip;
  currently unmounted (not rendered by `CourseBuilder.tsx`/`TermResults.tsx`)
  but kept styled in step with the rest of the theme in case it's wired
  back in.
- `app/components/CourseHistoryPanel.tsx` - per-course "View by term"
  toggle: lazy-fetches `GET /courses/{subject}/{course}/history` and lets
  you pick a specific term (1996 through the latest available, currently
  2025W), then a specific section within that term (or "Overall"). With
  "Overall" selected, shows that term's blended avg/std-dev/high/low/
  fail-rate/enrolled/distribution plus a comparison table of that term's
  actual instructors (each instructor's sections that term combined into
  one enrollment-weighted row - a professor teaching two sections shows up
  once, not twice) with a `[BEST]` tag on the highest-average instructor
  (only shown when 2+ instructors taught that term) and a disclaimer that
  this is historical grade outcomes only, not a teaching-quality rating.
  With one specific section selected (e.g. "Section 102"), shows only that
  section's own numbers (not combined with any other section), its
  instructor(s), and its own grade distribution chart - no comparison
  table, no badge. Both views render a `GradeDistributionChart`: the term's
  blended distribution for Overall, or the selected section's own (smaller)
  distribution otherwise - never the same numbers shown twice. Sections are
  scoped strictly to the selected term, never an all-time list; a
  term→section reset on term change happens in the `selectTerm()` handler
  rather than a `useEffect`, to avoid the `react-hooks/set-state-in-effect`
  lint rule. Any field with no value (std dev, instructor(s)) renders a bare
  `"-"` consistently, rather than a mix of `"-"` and `"not reported"` across
  different fields.
- `app/components/GradeDistributionChart.tsx` - a reusable 11-bin grade
  distribution line/area chart, styled identically to `TermScoreChart.tsx`
  (same `--chart-accent` orange, y-axis tick labels, gridlines, hover dots),
  with a hover tooltip showing the exact count and percentage per bin. Used
  by `CourseHistoryPanel.tsx` for both the term-level (Overall) and
  section-level distributions.
- `app/components/DifficultyBadge.tsx` - renders as bracket text
  (`[HARD · 82]`) in the severity color, never a filled pill.
  `ConfidenceNote.tsx` is a plain muted caption. `lib/scoreColor.ts` is the
  shared 0-100 severity scale both pull from.
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
  BCS into one row, is the one marked with the `[BEST]` tag, and that
  "CH"-coded challenge-for-credit sections never appear), and a
  specific-section selection (e.g. "Section 102") showing only that
  section's own 80.7% average and instructor with no comparison table or
  badge - distinct from Overall's combined 82.5% for the same instructor -
  the section's own grade distribution chart rendering alongside it
  (confirmed visually smaller/different from the term's blended
  distribution, not the same chart repeated), search now correctly finding
  a course introduced after 2016W (CPSC 330, previously missing from the
  catalog entirely - predicted with an honest low-confidence banner, and
  its full 2019W-2025W term history shown correctly), a section whose raw
  "Professor" field was polluted with 50+ student/TA names (CPSC 110
  2018W section 101 - confirmed it now shows "-" for instructor instead of
  the wall of names, and that the Overall comparison table for that term
  correctly shows only its 3 real instructors instead of 50+ bogus ones),
  and an unknown-course request (falls back to "very low confidence" with a
  low-confidence warning banner).
- The dark/blocky/monospace redesign (see "Design system" above) was built
  and iteratively refined against the user's own live visual review in the
  running dev server, with `tsc --noEmit` run after every change rather than
  a fresh end-to-end browser pass - the user asked not to have the assistant
  drive the browser for this work, so treat this pass as type-checked and
  visually spot-checked by the user turn-by-turn, not independently
  re-verified end-to-end.
