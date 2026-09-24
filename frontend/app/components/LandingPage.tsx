"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ApiError, predictTerm, type CourseInput, type Weights } from "@/lib/api";
import { loadWeights } from "@/lib/weights";
import { saveDraftTerm } from "@/lib/draftTerm";
import { loadTheme, saveTheme, type Theme } from "@/lib/theme";
import CourseSearch from "./CourseSearch";
import MeshBackground from "./MeshBackground";

// WebGL/rAF/ResizeObserver don't exist during Next's SSR pass, so the 3D
// graph is loaded client-only - see CourseGraph.tsx's own top-of-file note.
const CourseGraph = dynamic(() => import("./CourseGraph"), { ssr: false });

// This page partially breaks from the dashboard's square-corner "terminal"
// design system (see frontend/README.md's "Design system" section) - it's
// the marketing surface, not the data tool, so it gets rounded cards/
// shadows and generous whitespace instead of grid lines. It keeps the same
// Geist Mono typeface as the dashboard though (`.landing` in globals.css),
// and still pulls every color from the shared CSS custom properties there
// (so light/dark mode both work for free), reusing `--chart-accent` as its
// one "pop" color rather than inventing a new hue - so the two surfaces
// read as the same product up close.
//
// Every number and claim below is sourced from the root README (results
// table, "Known limitations", architecture) - nothing here is invented
// marketing copy.

// The model/value is what should pop (colored orange in the ticker); the
// phrase after it is deliberately lowercase/plain so it reads as a caption,
// not a second thing competing for attention.
const STATS: { value: string; label: string }[] = [
  { value: "29 years", label: "of real UBC grade data" },
  { value: "12,334", label: "courses scored" },
  { value: "4", label: "real signals behind every score" },
  { value: "XGBoost", label: "shipped model" },
];

// Hero-only cap - the dashboard's own term builder (reached after Predict)
// isn't limited by this, it's just to keep the compact "Try:"/added-course
// row here from growing unreasonably long before the user ever sees the
// real term builder.
const MAX_COURSES = 10;

// One-click starters for the picker card - the same five common first-year
// courses CourseGraph.tsx shows as placeholders, so clicking one here and
// seeing its node "come alive" (real orange, solid edge) in the graph on
// the right feels like one connected action, not two unrelated widgets.
const QUICK_ADD_COURSES: { subject: string; course: string }[] = [
  { subject: "CPSC", course: "110" },
  { subject: "MATH", course: "100" },
  { subject: "ENGL", course: "110" },
  { subject: "CHEM", course: "121" },
  { subject: "PSYC", course: "101" },
];

const SIGNALS: { icon: IconComponent; label: string; detail: string }[] = [
  {
    icon: IconBarChart,
    label: "Grade impact",
    detail: "How the average grade compares to other courses at the same level.",
  },
  {
    icon: IconAlertTriangle,
    label: "Fail risk",
    detail: "Historical fail rate - how often students don't pass outright.",
  },
  {
    icon: IconActivity,
    label: "Grading unpredictability",
    detail: "How much grades swing section-to-section and term-to-term.",
  },
  {
    icon: IconUsers,
    label: "Class size",
    detail: "Larger sections tend to grade - and curve - differently than small ones.",
  },
];

const METHOD_STEPS: { step: string; icon: IconComponent; title: string; detail: string }[] = [
  {
    step: "01",
    icon: IconLayers,
    title: "Data",
    detail:
      "Trained only on UBC PAIR Reports through 2016W - the upstream source documents that 2017W+ data was altered, so it's excluded entirely. A separate, display-only pipeline extends the \"view by term\" history browser through 2025W, but build_features.py, train.py, and predict.py never read it.",
  },
  {
    step: "02",
    icon: IconCpu,
    title: "Model",
    detail:
      "XGBoost with a chronological train/test split (train ≤ 2013W, test 2014W-2016W) to avoid leakage. Beats a plain historical-lookup baseline by 2.3% MAE - a modest, honest improvement, since most of the real signal in this proxy label is a course's own trailing history.",
  },
  {
    step: "03",
    icon: IconSliders,
    title: "Personalization",
    detail:
      "Not a second model. Your quiz answers become weights over the same four precomputed signals, combined with plain arithmetic at request time - a transparent re-weighting of real numbers, not new machine learning dressed up to look personalized.",
  },
];

const LIMITATIONS: string[] = [
  "Proxy, not ground truth - it measures historical grade outcomes, not workload, time commitment, or teaching quality.",
  "The predictor's data stops at 2016W - a course's staff and curriculum have had a decade to change since.",
  "The history browser (1996-2025) intentionally uses a wider data window than the predictor - never silently blurred together.",
  "Professor names aren't normalized - the model's professor-history feature has a ~52% NaN rate when a name string doesn't recur exactly.",
  "Small offering counts mean low confidence - the API reports a confidence level per course, surfaced directly in the app.",
  "UBC Vancouver only - all three underlying data sources only reliably cover the Vancouver campus.",
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is this a workload predictor?",
    a: "No - explicitly not. difficulty_score is a percentile-ranked composite of a course's historical average grade, fail rate, and grade variance. A course can have a brutal weekly workload but generous grading (low score), or a light workload with a harsh curve (high score).",
  },
  {
    q: "How far back does the data go?",
    a: "The prediction model trains only on UBC PAIR Reports through 2016W. The separate \"view by term\" history browser goes further, covering 1996 through whatever's most recently available (currently 2025W) - but that wider window is display-only and never touches the model.",
  },
  {
    q: "How accurate is the model, really?",
    a: "XGBoost gets a test MAE of 16.00 versus a 16.38 MAE historical-lookup baseline - a modest 2.3% improvement. That's expected: most of the real signal in this proxy label is a course's own trailing history, so a much bigger jump would be more suspicious than reassuring.",
  },
  {
    q: "Do I need an account?",
    a: "No sign-up, ever. Build a term, get your scores, and - if you want - save the collection in your browser's local storage for next time.",
  },
  {
    q: "Why does a course show a low-confidence warning?",
    a: "Some courses have very few historical offerings, or were introduced after 2016W, so the predictor falls back to subject/global estimates instead of the course's own history. Every prediction reports a confidence level, and the app surfaces a warning banner instead of presenting every score with equal certainty.",
  },
  {
    q: "Is this affiliated with UBC?",
    a: "No. This is an independent portfolio project built on publicly available UBC PAIR Reports and Tableau dashboard data - not an official UBC tool, and not a teaching-quality rating.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Deferred to an effect (not read during initial render) so server and
    // client agree on the first render before hydration - same convention
    // Dashboard uses for weights/collections/theme.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeights(loadWeights());
    setTheme(loadTheme());
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveTheme(next);
  }

  useEffect(() => {
    // Nav only picks up its glass treatment once the page has scrolled past
    // the hero's own top padding - stays invisible over the hero itself,
    // where it's meant to float with no chrome at all.
    const onScroll = () => setNavScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Small-monitor scale: the page was laid out/spaced for a big monitor,
  // so below a big-monitor width it renders `pageScale`d down instead of
  // just "smaller" (see the `scaleContentRef` div below). This used CSS
  // `zoom` at first, which is non-standard and turned out to behave
  // inconsistently on macOS (both Safari and Arc) - a section's own
  // background would visibly detach from its content, exposing the
  // sitewide ambient background underneath through the gap. `transform:
  // scale` is fully standard/consistent everywhere, at the cost of needing
  // to do the height bookkeeping ourselves below, since transform (unlike
  // zoom) doesn't shrink the element's contribution to document height.
  const [pageScale, setPageScale] = useState(1);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1536px)");
    const update = () => setPageScale(mq.matches ? 0.75 : 1);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Natural (unscaled) height of the scaled content, read via
  // ResizeObserver - `offsetHeight`/`contentRect` reflect layout size,
  // which `transform` never changes, so this stays accurate regardless of
  // `pageScale`. Used to give the clipping wrapper below an explicit
  // `height: naturalHeight * pageScale`, so the page's actual scrollable
  // height matches what's visually rendered instead of leaving dead space
  // below the shrunk content.
  const scaleContentRef = useRef<HTMLDivElement>(null);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = scaleContentRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setNaturalHeight(entries[0].contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const addedKeys = useMemo(() => new Set(courses.map((c) => `${c.subject}-${c.course}`)), [courses]);

  function addCourseIfNew(subject: string, course: string) {
    if (!subject || !course) return;
    if (addedKeys.has(`${subject}-${course}`)) return;
    if (courses.length >= MAX_COURSES) return;
    setCourses((prev) => [...prev, { subject, course, session: "W" }]);
    // No manual "materializing" trigger needed here anymore - CourseGraph
    // owns its own spawn-in animation (a node's spawnScale eases 0 -> 1)
    // driven directly by the `courses` prop it's passed below.
  }

  function removeCourse(index: number) {
    setCourses((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePredict() {
    if (courses.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await predictTerm(courses, weights);
      saveDraftTerm({ courses, result });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong reaching the API.");
      setLoading(false);
    }
  }

  return (
    <div className="landing min-h-screen">
      {/* ---- Sitewide ambient background ---------------------------------
          The dot-network + accent glow that used to live only behind the
          hero now sits fixed behind the entire page (nav through footer),
          pinned to the viewport rather than scrolling with content. The
          hero section below draws its own solid background on top of it
          (it gets the 3D course graph instead), and every section after
          the hero uses a translucent background so this shows through the
          gaps between cards.

          Deliberately a sibling of `.landing-scale` below, not a child of
          it - it needs to stay pinned at true viewport size/position (a
          full-bleed backdrop) regardless of the small-monitor 75% scale
          applied to the actual content, otherwise it'd shrink into a
          smaller box and leave bare edges instead of covering the page. */}
      <div className="fixed inset-0 -z-20 overflow-hidden bg-[var(--color-background)]">
        <MeshBackground className="absolute inset-0" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 950px 260px at 50% 0%, color-mix(in srgb, var(--color-chart-accent) 22%, transparent), transparent 70%)",
          }}
        />
      </div>

      {/* ---- Nav --------------------------------------------------------
          No logo, no button, no bar over the hero - just the three link
          names floating over the page. Fixed (not sticky-in-flow) so it
          overlays the hero instead of taking up layout space; every anchor
          target below has its own pt/scroll-mt sized to this row's actual
          height (~68px: py-6 + a text-sm line) to clear it. Past the hero,
          the row itself grows a "liquid glass" pill (blur + translucency +
          rim light) driven by `navScrolled`, both so the links stay
          legible over whatever section is scrolling underneath and so
          scrolling reads as picking the nav up off the page.

          Also deliberately a sibling of the scaled content, same reasoning
          as the background above: `position: fixed` tracks the nearest
          transformed ancestor instead of the real viewport, so nesting it
          inside the `transform: scale` wrapper below would make it scroll
          away with the page instead of staying pinned. Left unscaled - it's
          a small floating pill, not part of what read as cramped. */}
      <header className="fixed top-0 inset-x-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-center px-4 sm:px-6 lg:px-10 py-6">
          <nav
            className={`flex items-center flex-wrap justify-center gap-x-8 gap-y-2 rounded-full border transition-all duration-300 ease-out ${
              navScrolled
                ? "px-6 py-2.5 border-[var(--color-border-strong)]/50 bg-[var(--color-surface)]/60 shadow-lg shadow-black/10 backdrop-blur-xl backdrop-saturate-150"
                : "px-0 py-0 border-transparent"
            }`}
          >
            <a href="#how-it-works" className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-foreground)] transition-colors">
              How it works
            </a>
            <a href="#methodology" className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-foreground)] transition-colors">
              Methodology
            </a>
            <a href="#faq" className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-foreground)] transition-colors">
              FAQ
            </a>
          </nav>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className={`ml-4 shrink-0 rounded-full border w-8 h-8 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-foreground)] transition-all duration-300 ease-out ${
              navScrolled
                ? "border-[var(--color-border-strong)]/50 bg-[var(--color-surface)]/60 shadow-lg shadow-black/10 backdrop-blur-xl backdrop-saturate-150"
                : "border-transparent hover:border-[var(--color-border-strong)]/50"
            }`}
          >
            {theme === "dark" ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ---- Scaled content ------------------------------------------------
          Clips to `naturalHeight * pageScale` (see the effect above) so the
          page's actual scrollable height matches what's visually rendered -
          `transform` doesn't shrink `scaleContentRef`'s contribution to
          layout height the way `zoom` did, so without this the page would
          scroll well past the visible (shrunk) content into blank space. */}
      <div
        className="overflow-hidden"
        style={pageScale !== 1 && naturalHeight != null ? { height: naturalHeight * pageScale } : undefined}
      >
        <div
          ref={scaleContentRef}
          className="flex flex-col"
          style={pageScale !== 1 ? { transform: `scale(${pageScale})`, transformOrigin: "top center" } : undefined}
        >
      <main className="flex-1 flex flex-col">
        {/* ---- Hero ------------------------------------------------------
            Full viewport height/width again (100svh, not 100vh - avoids the
            iOS/Android address-bar resize jump) - the minimal look comes
            from the content itself being scaled down and centered (smaller
            headline, smaller graph, see below) rather than from inset
            margins on the section, which made it feel like a bounded panel
            rather than a hero. The fixed header overlays the top of it, so
            content gets pt-[68px] (the header's own height, see its
            comment) to clear it. Two columns at lg+: copy/picker on the
            left, an interactive 3D course graph on the right (hidden below
            lg - dragging to orbit it would otherwise fight touch-scroll on
            phones/small tablets). Opaque background so the sitewide mesh
            layer behind the whole page doesn't show through here - this
            section gets its own dedicated visual instead. */}
        <section className="relative isolate overflow-hidden min-h-[100svh] flex flex-col bg-[var(--color-background)]">
          {/* The sitewide glow above sits behind this section's own opaque
              background and never shows through it - repeat it locally,
              behind the hero's content but above its solid bg, so the top
              of the hero itself gets the orange hue too. */}
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 950px 260px at 50% 0%, color-mix(in srgb, var(--color-chart-accent) 22%, transparent), transparent 70%)",
            }}
            aria-hidden="true"
          />
          <div className="flex-1 w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-10 pt-[68px] pb-6 sm:pb-8">
          <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-stretch gap-12 lg:gap-24 xl:gap-32">
            <div className="w-full lg:w-[50%] flex flex-col items-start text-left">
              {/* CrunchCast is the actual hero here - the brand name, not
                  the tagline, gets the big display treatment and the <h1>,
                  with the tagline below demoted to a small supporting line. */}
              <h1
                className="landing-rise-in text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-none"
                style={{ animationDelay: "40ms" }}
              >
                Crunch<span style={{ color: "var(--color-chart-accent)" }}>Cast</span>
              </h1>

              <p
                className="landing-rise-in mt-6 whitespace-nowrap text-sm sm:text-base lg:text-lg font-bold tracking-tight text-[var(--color-text-muted)] leading-snug"
                style={{ animationDelay: "60ms" }}
              >
                Know how a course <span style={{ color: "var(--color-chart-accent)" }}>actually grades</span> before
                you register.
              </p>

              <p
                className="landing-rise-in mt-3 max-w-lg text-sm text-[var(--color-text-subtle)] leading-relaxed"
                style={{ animationDelay: "80ms" }}
              >
                CrunchCast scores every UBC course&apos;s historical difficulty from decades of
                real grade data - fail rates, grade spread, class size, the works. Not a workload
                guess.
              </p>

              <div
                id="picker"
                className="landing-rise-in scroll-mt-[84px] w-full max-w-xl mt-8"
                style={{ animationDelay: "180ms" }}
              >
                <p
                  className="landing-mono text-[11px] font-bold uppercase tracking-wider mb-3 text-left"
                  style={{ color: "var(--color-chart-accent)" }}
                >
                  Build your term
                </p>
                {/* relative + the added-courses block below being absolutely
                    positioned is deliberate: the outer hero wrapper
                    vertically centers the whole left column as a group, so
                    if this box grew in normal flow every time a course was
                    added, that recentering would shift "CrunchCast" upward
                    on every add. Taking the chip list out of flow means the
                    box's own layout height never changes - it just grows
                    downward visually (matching border/background, so it
                    still reads as one panel) without moving anything
                    above it. */}
                <div className="relative border border-[var(--color-border-strong)] bg-[var(--color-surface)]/90 backdrop-blur-sm shadow-2xl shadow-black/20 p-5 sm:p-6 pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <div className="flex-1 min-w-0">
                    <CourseSearch onSelectCourse={addCourseIfNew} addedKeys={addedKeys} />
                  </div>
                  <button
                    onClick={handlePredict}
                    disabled={courses.length === 0 || loading}
                    className="shrink-0 flex items-center justify-center gap-2 rounded-lg bg-accent text-on-accent px-6 py-2.5 text-sm font-bold disabled:opacity-40 hover:opacity-85 transition-opacity"
                  >
                    {loading ? (
                      "Predicting..."
                    ) : (
                      <>
                        Predict
                        <IconArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <span className="landing-mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">
                    Try:
                  </span>
                  {QUICK_ADD_COURSES.map(({ subject, course }) => {
                    const added = addedKeys.has(`${subject}-${course}`);
                    const atCap = courses.length >= MAX_COURSES;
                    return (
                      <button
                        key={`${subject}-${course}`}
                        type="button"
                        onClick={() => addCourseIfNew(subject, course)}
                        disabled={added || atCap}
                        title={!added && atCap ? `Max ${MAX_COURSES} courses` : undefined}
                        className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-foreground)] disabled:opacity-30 disabled:hover:border-[var(--color-border)] transition-colors"
                      >
                        {subject} {course}
                      </button>
                    );
                  })}
                </div>

                {/* Always rendered (not conditional on courses.length) so
                    the card never opens looking cut off - shows a small
                    muted placeholder line until a course is added, then
                    switches to real, removable chips sized/styled to match
                    the "Try:" buttons above (not the bigger bold chips this
                    used to be). Removal is the whole reason this needs to
                    exist at all - there's no other way to undo a wrong pick
                    before Predict - and keeping each entry this compact is
                    what keeps the row(s) short enough to stay clear of the
                    ticker below even with several courses added - see the
                    -inset-x-px/max-h notes below, both still apply. */}
                <div className="absolute -inset-x-px top-full max-h-16 overflow-y-auto flex flex-wrap content-start items-center gap-2 border-x border-b border-[var(--color-border-strong)] bg-[var(--color-surface)]/90 backdrop-blur-sm shadow-2xl shadow-black/20 px-5 sm:px-6 pt-2 pb-3">
                  {courses.length > 0 ? (
                    courses.map((c, index) => (
                      <button
                        key={`${c.subject}-${c.course}`}
                        type="button"
                        onClick={() => removeCourse(index)}
                        aria-label={`Remove ${c.subject} ${c.course}`}
                        title={`Remove ${c.subject} ${c.course}`}
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:border-severity-hard hover:text-severity-hard transition-colors"
                      >
                        {c.subject} {c.course}
                        <span aria-hidden="true">&times;</span>
                      </button>
                    ))
                  ) : (
                    <span className="landing-mono text-xs text-[var(--color-text-subtle)]">
                      Max {MAX_COURSES} courses
                    </span>
                  )}
                </div>

                {error && (
                  <p className="rounded-lg border-l-2 border-severity-hard bg-severity-hard/5 pl-3 pr-3 py-1.5 mt-4 text-sm text-left text-[var(--color-foreground)]">
                    ! {error}
                  </p>
                )}
                </div>
              </div>
            </div>

            {/* Interactive 3D graph - a center "Term" node plus one node per
                added course, drag to orbit (zoom is disabled, see
                CourseGraph.tsx). Desktop/tablet-landscape only. */}
            <div className="hidden lg:flex flex-col items-center w-full lg:w-[50%] -mt-10">
              {/* Height (plus the -mt-10 on this column's wrapper above) is
                  tuned so this box roughly lines up with the picker card
                  next to it, not left at the default h-[440px]/[520px] -
                  the picker's own height varies (the added-courses overlay
                  only appears once a course is picked), so this is a
                  reasonable middle ground, not a pixel-exact match in every
                  state. */}
              <div className="relative w-full h-[410px] xl:h-[490px]">
                <CourseGraph courses={courses} />
              </div>
              <p className="landing-mono mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-chart-accent)]" aria-hidden="true" />
                Drag to interact
              </p>
            </div>
          </div>

          {/* Stat strip, directly under the row above (the picker card and
              the graph/"Drag to interact" caption) rather than pinned to
              the hero's own far bottom edge - both this and the row sit
              inside the same centered flex-1 wrapper, so the pair reads as
              one group. The model's own honest numbers, straight from the
              README's results table - not restated as marketing
              superlatives. A thin, single-line "/"-separated ticker (two
              identical copies of STATS laid side by side, animated across
              exactly one copy-width so the loop point is invisible - see
              .landing-marquee-track in globals.css) rather than a static
              grid. The second copy is aria-hidden so screen readers only
              hear the values once. */}
          <div className="w-full max-w-7xl mx-auto mt-5 sm:mt-6 border-t border-[var(--color-border)] pt-4 sm:pt-5 overflow-hidden">
            <div className="landing-marquee-track flex items-center whitespace-nowrap">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex items-center shrink-0" aria-hidden={copy === 1}>
                  {STATS.map(({ value, label }) => (
                    <span
                      key={label}
                      className="landing-mono text-xs sm:text-sm text-[var(--color-text-subtle)] flex items-center"
                    >
                      <span className="px-4 sm:px-6">
                        <span className="font-bold" style={{ color: "var(--color-chart-accent)" }}>
                          {value}
                        </span>{" "}
                        {label}
                      </span>
                      <span className="text-[var(--color-border-strong)]" aria-hidden="true">
                        /
                      </span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          </div>

          <a
            href="#how-it-works"
            className="landing-mono absolute inset-x-0 bottom-16 flex flex-col items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)] transition-colors"
          >
            Scroll
            <IconChevronDown className="landing-scroll-cue w-3.5 h-3.5" />
          </a>
        </section>

        {/* ---- How it works: four signals --------------------------------- */}
        <section id="how-it-works" className="scroll-mt-[68px] bg-[var(--color-background)]/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-20 sm:py-28 border-b border-[var(--color-border)]">
            <SectionHeading
              eyebrow="How it works"
              title="Four real signals. Not a black box."
              subtitle="Every score breaks down into the same four historical measurements, each with its own plain-English detail line - so you know exactly why a course scored the way it did, not just the number itself."
              centered
            />
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {SIGNALS.map(({ icon: Icon, label, detail }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 flex flex-col gap-4 hover:border-[var(--color-border-strong)] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent text-on-accent">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1.5">{label}</p>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- What it measures (and doesn't) ------------------------------ */}
        <section id="what-it-measures" className="scroll-mt-[68px] bg-[var(--color-background)]/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-20 sm:py-28 border-b border-[var(--color-border)]">
            <SectionHeading
              eyebrow="The honest part"
              title="A difficulty score. Not a workload score."
              subtitle={
                <>
                  This is explicitly not a workload measurement. A course can have a heavy weekly
                  workload but generous grading (low <code className="landing-mono text-[13px]">difficulty_score</code>),
                  or a light workload but a harsh curve (high{" "}
                  <code className="landing-mono text-[13px]">difficulty_score</code>).
                </>
              }
              centered
            />
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-wider text-severity-easy mb-4">
                  difficulty_score IS
                </p>
                <ul className="flex flex-col gap-3.5">
                  {[
                    "A percentile-ranked composite of a course offering's historical average grade, fail rate, and grade variance.",
                    "Ranked within its own course level (100/200/.../600), not across the whole catalog.",
                    "Backed by real historical grade outcomes, with a confidence level attached to every prediction.",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-[var(--color-text-muted)]">
                      <IconCheck className="w-4 h-4 mt-0.5 shrink-0 text-severity-easy" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-wider text-severity-hard mb-4">
                  difficulty_score is NOT
                </p>
                <ul className="flex flex-col gap-3.5">
                  {[
                    "A workload, time-commitment, or effort measurement of any kind.",
                    "A teaching-quality rating - self-selection and exam difficulty confound every historical number here.",
                    "A forecast of this specific offering - the predictor's data stops at 2016W.",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-[var(--color-text-muted)]">
                      <IconX className="w-4 h-4 mt-0.5 shrink-0 text-severity-hard" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Under the hood: data / model / personalization -------------- */}
        <section id="methodology" className="scroll-mt-[68px] bg-[var(--color-background)]/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-20 sm:py-28 border-b border-[var(--color-border)]">
            <SectionHeading
              eyebrow="Under the hood"
              title="Built like a real model, not a lookup table in disguise."
              subtitle="Three steps, each documented in the repo rather than left as a black box."
              centered
            />
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
              {METHOD_STEPS.map(({ step, icon: Icon, title, detail }) => (
                <div key={step} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 sm:p-7 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="landing-mono text-xs font-bold text-[var(--color-text-subtle)]">{step}</span>
                    <Icon className="w-5 h-5 text-[var(--color-text-subtle)]" />
                  </div>
                  <p className="font-bold text-base">{title}</p>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Known limitations ------------------------------------------- */}
        <section className="bg-[var(--color-background)]/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-20 sm:py-28 border-b border-[var(--color-border)]">
            <SectionHeading
              eyebrow="Known limitations"
              title="Read this before you trust a score."
              subtitle="Candid documentation of what the model does and doesn't measure matters as much as the app working - every one of these is called out again in the app itself, not just here."
              centered
            />
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {LIMITATIONS.map((line) => (
                <div
                  key={line}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-5 py-4 flex items-start gap-3"
                >
                  <IconInfo className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-text-subtle)]" />
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{line}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- FAQ ---------------------------------------------------------- */}
        <section id="faq" className="scroll-mt-[68px] bg-[var(--color-background)]/70">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-20 sm:py-28">
            <SectionHeading eyebrow="FAQ" title="Questions worth asking before you trust a score." centered />
            <div className="mt-10 flex flex-col divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] overflow-hidden">
              {FAQ.map(({ q, a }, index) => {
                const open = openFaq === index;
                return (
                  <div key={q} className="px-5 sm:px-6">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : index)}
                      aria-expanded={open}
                      className="w-full flex items-center justify-between gap-4 py-5 cursor-pointer select-none text-left"
                    >
                      <span className="font-bold text-sm sm:text-base">{q}</span>
                      <IconChevronDown
                        className={`w-4 h-4 shrink-0 text-[var(--color-text-subtle)] transition-transform duration-300 ease-out ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {/* grid-rows 0fr/1fr trick - animates to the content's real
                        height without measuring it in JS, since height/auto
                        can't be transitioned directly. */}
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed pb-5 -mt-1">{a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </main>

      {/* ---- Footer ----------------------------------------------------- */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/90">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-12 flex flex-col sm:flex-row sm:items-start justify-between gap-8">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              {/* Same nested-semicircle mark as the dashboard's own nav icon
                  - kept in sync rather than this page's older bar-chart
                  glyph, so the two surfaces share one brand mark. */}
              <svg width="22" height="22" viewBox="-2 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
                <path
                  d="M14.74 4.48A8 8 0 1 0 14.74 19.52"
                  stroke="var(--color-foreground)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M13.2 8.71A3.5 3.5 0 1 0 13.2 15.29"
                  stroke="var(--color-chart-accent)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="font-black tracking-tight text-sm">CrunchCast</span>
            </div>
            <p className="text-sm text-[var(--color-text-subtle)] leading-relaxed">
              A historical-data difficulty score for UBC courses, built on decades of real grade
              data. Not a workload measurement. Not an official UBC tool.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-subtle)]">Built by</p>
            <p className="font-bold text-sm mb-3">Harshpreet Singh</p>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-subtle)] mb-2.5">Links</p>
            <nav className="flex items-center gap-4">
              <a
                href="https://github.com/ONIGIRIIII/CrunchCast"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                title="GitHub"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-chart-accent)] transition-colors"
              >
                <IconGithub className="w-5 h-5" />
              </a>
              <a
                href="mailto:singhharshpreet675@gmail.com"
                aria-label="Email"
                title="Email"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-chart-accent)] transition-colors"
              >
                <IconEmail className="w-5 h-5" />
              </a>
              <a
                href="https://www.linkedin.com/in/harshpreet-singh-2331762a4/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                title="LinkedIn"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-chart-accent)] transition-colors"
              >
                <IconLinkedIn className="w-5 h-5" />
              </a>
            </nav>
          </div>
        </div>
      </footer>
        </div>
      </div>
    </div>
  );
}

// ---- Local presentational helpers -----------------------------------------

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  centered?: boolean;
}) {
  return (
    <div className={`max-w-2xl ${centered ? "mx-auto text-center" : ""} flex flex-col gap-4`}>
      <p
        className="landing-mono text-xs font-bold uppercase tracking-widest"
        style={{ color: "var(--color-chart-accent)" }}
      >
        {eyebrow}
      </p>
      <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">{title}</h2>
      {subtitle && <p className="text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed">{subtitle}</p>}
    </div>
  );
}

// ---- Inline icon set ---------------------------------------------------
// Minimal hand-drawn SVGs (no icon library dependency, matching the
// stroke-based convention the header logomark already used) - each takes
// only a `className` for sizing/color so callers stay terse above.

type IconComponent = (props: { className?: string }) => ReactElement;

function IconGithub({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 22 12c0-5.52-4.48-10-10-10z" />
    </svg>
  );
}

function IconEmail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.94 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM3.5 8.5h3v12h-3v-12zM9.5 8.5h2.9v1.64h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59v6.83h-3v-6.06c0-1.45-.03-3.31-2.02-3.31-2.02 0-2.33 1.58-2.33 3.2v6.17h-3v-12z" />
    </svg>
  );
}

function IconBarChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 20V11M12 20V4M20 20V15" />
    </svg>
  );
}

function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.6 3.9 2.4 19a1.6 1.6 0 0 0 1.4 2.4h16.4a1.6 1.6 0 0 0 1.4-2.4L13.4 3.9a1.6 1.6 0 0 0-2.8 0Z" />
      <path d="M12 9.5v4.2" />
      <path d="M12 17.2h.01" />
    </svg>
  );
}

function IconActivity({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12h4l2.5-7 4 14 2.5-7H22" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3.3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M15.5 3.6a3.3 3.3 0 0 1 0 6.4" />
      <path d="M17 14.2c2.3.6 4 2.8 4 5.8" />
    </svg>
  );
}

function IconLayers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 2 8l10 6 10-6-10-6Z" />
      <path d="M2 14l10 6 10-6" />
    </svg>
  );
}

function IconCpu({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </svg>
  );
}

function IconSliders({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h13M21 18h0" />
      <circle cx="15" cy="6" r="2" fill="var(--color-surface-raised)" />
      <circle cx="7" cy="12" r="2" fill="var(--color-surface-raised)" />
      <circle cx="17" cy="18" r="2" fill="var(--color-surface-raised)" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12.5 9 17 20 6" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.8h.01" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
