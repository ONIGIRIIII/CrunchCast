"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ApiError, predictTerm, type CourseInput, type Weights } from "@/lib/api";
import { loadWeights } from "@/lib/weights";
import { saveDraftTerm } from "@/lib/draftTerm";
import { loadTheme, saveTheme, type Theme } from "@/lib/theme";
import CourseSearch from "./CourseSearch";
import SignalCards from "./SignalCards";
import ExampleCourses from "./ExampleCourses";
import MethodCards from "./MethodCards";
import Reveal from "./Reveal";

// WebGL/rAF/ResizeObserver don't exist during Next's SSR pass, so the 3D
// graph is loaded client-only - see CourseGraph.tsx's own top-of-file note.
const CourseGraph = dynamic(() => import("./CourseGraph"), { ssr: false });

// This page partially breaks from the dashboard's "terminal" design system
// (see frontend/README.md's "Design system" section) - it's the marketing
// surface, not the data tool, so it gets bordered cards, shadows and
// generous whitespace instead of grid lines. Corners stay square like the
// dashboard's, though - except the floating nav (link pill, theme/menu
// buttons, mobile dropdown) and borderless dot markers. It keeps the same
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

// "The honest part" - what difficulty_score is built from and what it
// can't tell you (README: "What it measures", "Known limitations").
const SCORE_IS: { heading: string; tone: "is" | "isnt"; text: string }[] = [
  {
    heading: "What it is",
    tone: "is",
    text: "Past average grade, fail rate and grade spread, ranked against courses at the same level, with a confidence level on every score.",
  },
  {
    heading: "What it isn't",
    tone: "isnt",
    text: "A measure of workload, a rating of the teaching, or a forecast for this year's section. The data ends at 2016W.",
  },
];

// README "Known limitations", one card each.
const LIMITATIONS: { title: string; text: string }[] = [
  {
    title: "It's a stand-in for difficulty",
    text: "The score is built from past grade outcomes. It doesn't measure workload, time spent, or how good the teaching is.",
  },
  {
    title: "The data is a decade old",
    text: "The predictor stops at 2016W. A course's instructors and content may have changed a lot since then.",
  },
  {
    title: "Two time ranges, kept apart",
    text: "The history browser covers 1996 to 2025, but the predictor only goes up to 2016W. The two are never mixed.",
  },
  {
    title: "Instructor names aren't cleaned up",
    text: "A name only matches if it's spelled exactly the same every term, so the model's instructor-history feature is missing for about 52% of rows.",
  },
  {
    title: "Few past offerings, low confidence",
    text: "Courses with only a few past offerings get a low-confidence label, and the app shows a warning next to their score.",
  },
  {
    title: "Vancouver only",
    text: "All three data sources only reliably cover UBC's Vancouver campus.",
  },
];

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#methodology", label: "Methodology" },
  { href: "#faq", label: "FAQ" },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is this a workload predictor?",
    a: "No. The score comes from a course's past average grade, fail rate and grade spread. A heavy course can still score low if it grades generously, and a light one can score high if it grades strictly.",
  },
  {
    q: "How far back does the data go?",
    a: "The predictor learns from UBC's PAIR reports up to 2016W. The history browser goes further, from 1996 to the latest available term (currently 2025W), but that newer data is only shown to you. The model never uses it.",
  },
  {
    q: "How accurate is it?",
    a: "On terms it hadn't seen, the model's average error was 16.00 points, against 16.38 for simply looking up each course's own history. That's about 2.3% better. A small gain is expected, since a course's past grades already explain most of its score.",
  },
  {
    q: "Do I need an account?",
    a: "No. You can build a term and get scores without signing up. If you save a term, it's kept in your browser, not on a server.",
  },
  {
    q: "Why does a course show a low-confidence warning?",
    a: "It has only a few past offerings, or it was first offered after 2016W. The predictor then falls back on estimates for the whole subject or for all courses, so the app flags the score as less reliable.",
  },
  {
    q: "Is this affiliated with UBC?",
    a: "No. It's an independent portfolio project built on publicly available UBC grade data. It isn't an official UBC tool or a rating of instructors.",
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
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Mobile nav dropdown closes on Escape or any tap outside the header.
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

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
    <div className="landing min-h-screen flex flex-col">
      {/* ---- Nav --------------------------------------------------------
          No logo, no button, no bar over the hero - just the three link
          names floating over the page. Fixed (not sticky-in-flow) so it
          overlays the hero instead of taking up layout space; every anchor
          target below has its own pt/scroll-mt sized to this row's actual
          height (~68px, see below) to clear it. Past the hero,
          the row itself grows a "liquid glass" pill (blur + translucency +
          rim light) driven by `navScrolled`, both so the links stay
          legible over whatever section is scrolling underneath and so
          scrolling reads as picking the nav up off the page.

          Below sm the three links don't fit on one line next to the theme
          toggle, so they collapse behind a hamburger button into a small
          glass dropdown instead. The link pill and both buttons share one 44px
          height (also the touch-target size), so py-3 keeps the row at ~68px
          below md and md:py-5 at ~84px above it. */}
      <header ref={headerRef} className="fixed top-0 inset-x-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-end sm:justify-center gap-2 sm:gap-0 px-gutter py-3 md:py-5">
          <nav
            aria-label="Primary"
            className={`hidden sm:flex h-11 items-center justify-center gap-x-8 rounded-full border transition-all duration-300 ease-out ${
              navScrolled
                ? "px-6 border-[var(--color-border-strong)]/50 bg-[var(--color-surface)]/60 shadow-lg shadow-black/10 backdrop-blur-xl backdrop-saturate-150"
                : "px-0 border-transparent"
            }`}
          >
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-foreground)] transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-nav"
            className={`sm:hidden shrink-0 rounded-full border w-11 h-11 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-foreground)] transition-all duration-300 ease-out ${
              navScrolled || menuOpen
                ? "border-[var(--color-border-strong)]/50 bg-[var(--color-surface)]/60 shadow-lg shadow-black/10 backdrop-blur-xl backdrop-saturate-150"
                : "border-transparent"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className={`sm:ml-4 shrink-0 rounded-full border w-11 h-11 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-foreground)] transition-all duration-300 ease-out ${
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
        {menuOpen && (
          <nav
            id="landing-mobile-nav"
            aria-label="Primary"
            className="sm:hidden absolute top-full right-gutter -mt-1 w-56 max-w-[calc(100vw-2rem)] flex flex-col p-1.5 rounded-2xl border border-[var(--color-border-strong)]/50 bg-[var(--color-surface)]/80 shadow-lg shadow-black/10 backdrop-blur-xl backdrop-saturate-150"
          >
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center min-h-11 px-4 rounded-xl text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-hover-surface)] transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>

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
            phones/small tablets). Plain page background, like every
            section below it - the only decoration is the accent glow at the
            top. */}
        <section
          className="landing-glow overflow-hidden min-h-[100svh] flex flex-col bg-[var(--color-background)]"
          style={{ "--glow-strength": "22%" } as CSSProperties}
        >
          <div className="flex-1 w-full flex flex-col items-center justify-center px-gutter pt-[68px] pb-6 sm:pb-8">
          <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-stretch gap-12 lg:gap-hero">
            <div className="w-full min-w-0 lg:w-[50%] flex flex-col items-start text-left">
              {/* CrunchCast is the actual hero here - the brand name, not
                  the tagline, gets the big display treatment and the <h1>,
                  with the tagline below demoted to a small supporting line.
                  Both sizes are fluid (see --text-display* in globals.css)
                  so they fit a 320px phone and never run past this half of
                  the row into the graph at laptop widths. */}
              <h1
                className="landing-rise-in text-display lg:text-display-lg font-black tracking-tight"
                style={{ animationDelay: "40ms" }}
              >
                Crunch<span style={{ color: "var(--color-chart-accent)" }}>Cast</span>
              </h1>

              {/* w-fit sizes this box to the tagline's own (one-line from sm
                  up) width; the paragraph's w-0 min-w-full then fills exactly
                  that width without widening it, so the two always end at
                  the same edge whatever the tagline's fluid font size. */}
              <div className="w-fit max-w-full">
                <p
                  className="landing-rise-in mt-6 sm:whitespace-nowrap text-sm sm:text-base lg:text-tagline-lg font-bold tracking-tight text-[var(--color-text-muted)] leading-snug"
                  style={{ animationDelay: "60ms" }}
                >
                  Know how a course <span style={{ color: "var(--color-chart-accent)" }}>actually grades</span> before
                  you register.
                </p>

                <p
                  className="landing-rise-in mt-3 w-0 min-w-full text-sm text-[var(--color-text-subtle)] leading-relaxed"
                  style={{ animationDelay: "80ms" }}
                >
                  CrunchCast scores every UBC course&apos;s historical difficulty from decades of
                  real grade data - fail rates, grade spread, class size, the works. Not a workload
                  guess.
                </p>
              </div>

              <div
                id="picker"
                className="landing-rise-in scroll-mt-[84px] w-full max-w-xl mt-8 mb-[4.5rem] lg:mb-8"
                style={{ animationDelay: "180ms" }}
              >
                {/* mb reserves room for the out-of-flow added-courses tray
                    (see below) so the stat ticker can't slide up under it.
                    Below lg that's the tray's full height; at lg+ the
                    taller graph column beside this one already covers
                    most of it, except near 1024px where the headline has
                    shrunk (so a smaller mb covers the rest without
                    changing wider layouts, where the graph column is the
                    taller one). */}
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
                    className="tap-target shrink-0 flex items-center justify-center gap-2 bg-accent text-on-accent px-6 py-2.5 text-sm font-bold disabled:opacity-40 hover:opacity-85 transition-opacity"
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
                        className="tap-target border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-foreground)] disabled:opacity-30 disabled:hover:border-[var(--color-border)] transition-colors"
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
                        className="tap-target flex items-center gap-1.5 border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:border-severity-hard hover:text-severity-hard transition-colors"
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
                  <p className="border-l-2 border-severity-hard bg-severity-hard/5 pl-3 pr-3 py-1.5 mt-4 text-sm text-left text-[var(--color-foreground)]">
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
                  state. Fluid between those two old fixed steps (410 at
                  lg, 490 at xl) rather than jumping between them. */}
              <div className="relative w-full h-[clamp(400px,32vw,490px)]">
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

          {/* Hidden on phones and short viewports (landscape phones,
              768/800px-tall laptops) - there the hero's own content already
              reaches the bottom edge, and an absolutely positioned cue would
              sit on top of the picker/ticker. */}
          <a
            href="#how-it-works"
            className="landing-mono absolute inset-x-0 bottom-16 max-sm:hidden [@media(max-height:820px)]:hidden flex flex-col items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)] transition-colors"
          >
            Scroll
            <IconChevronDown className="landing-scroll-cue w-3.5 h-3.5" />
          </a>
        </section>

        {/* ---- How it works: four signals --------------------------------- */}
        <section
          id="how-it-works"
          className="landing-glow landing-divider scroll-mt-[68px] bg-[var(--color-background)]"
          // Straight after the hero with no divider line, so the glow sits
          // lower instead of starting at a hard edge - centered on, and tall
          // enough to cover, the whole heading + subtitle block. Offset tracks
          // the section's own top padding so it stays on the text at every
          // width, and is always past the glow's ~210px fade radius, so it
          // never reaches the top edge.
          style={{ "--glow-offset": "calc(var(--spacing-section) + 120px)", "--glow-size": "1100px 300px" } as CSSProperties}
        >
          <div className="max-w-6xl mx-auto px-gutter py-section">
            <SectionHeading
              eyebrow="How it works"
              title="Four numbers behind every score"
              subtitle="Each course is scored on four things taken from its past grade reports. Each one is ranked from 0 to 100 against courses at the same level, so a first-year course is only compared with other first-year courses. The app shows all four for every course you add, along with the raw figure behind each."
              centered
            />
            {/* 2x2 grid of wide cards, each with its own animated
                illustration - see SignalCards.tsx. */}
            <SignalCards />
          </div>
        </section>

        {/* ---- What it measures (and doesn't) ------------------------------ */}
        <section id="what-it-measures" className="landing-glow landing-divider scroll-mt-[68px] bg-[var(--color-background)]">
          <div className="max-w-6xl mx-auto px-gutter py-section">
            <SectionHeading
              eyebrow="The honest part"
              title="It measures grading, not workload"
              subtitle="The score is built from how a course has graded in the past, so it can't tell you how much work the course takes. A course with a heavy weekly load and generous grading scores low. A light course with strict grading scores high."
              centered
            />
            {/* The workload example as two made-up courses scored with the
                dashboard's own gauge (ExampleCourses.tsx), then a short
                "is / isn't" strip. */}
            <div className="mt-12">
              <ExampleCourses />
            </div>
            <Reveal className="mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 border border-[var(--color-border)] bg-[var(--color-surface-raised)] divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)]">
                {SCORE_IS.map(({ heading, tone, text }) => (
                  <div key={heading} className="flex items-start gap-3 p-6 sm:p-7">
                    {tone === "is" ? (
                      <IconCheck className="w-4 h-4 mt-0.5 shrink-0 text-severity-easy" />
                    ) : (
                      <IconX className="w-4 h-4 mt-0.5 shrink-0 text-severity-hard" />
                    )}
                    <div>
                      <p className={`font-bold text-sm mb-1 ${tone === "is" ? "text-severity-easy" : "text-severity-hard"}`}>
                        {heading}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---- Under the hood: data / model / personalization -------------- */}
        <section id="methodology" className="landing-glow landing-divider scroll-mt-[68px] bg-[var(--color-background)]">
          <div className="max-w-6xl mx-auto px-gutter py-section">
            <SectionHeading
              eyebrow="Under the hood"
              title="How the model is built"
              subtitle="Three parts, each written up in the repo: the data it learns from, the model itself, and how your quiz answers change the score."
              centered
            />
            {/* One card per part, each with a small animated visual built
                from the README's real numbers - see MethodCards.tsx. */}
            <MethodCards />
          </div>
        </section>

        {/* ---- Known limitations ------------------------------------------- */}
        <section className="landing-glow landing-divider bg-[var(--color-background)]">
          <div className="max-w-6xl mx-auto px-gutter py-section">
            <SectionHeading
              eyebrow="Known limitations"
              title="Read this before you trust a score"
              subtitle="What the model can't tell you, and where the data falls short."
              centered
            />
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {LIMITATIONS.map(({ title, text }, index) => (
                <Reveal key={title} delay={(index % 3) * 100} className="flex">
                  <div className="flex-1 flex flex-col gap-3 border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 hover:border-[var(--color-border-strong)] transition-colors">
                    <span className="landing-mono text-xs font-bold" style={{ color: "var(--color-chart-accent)" }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-bold text-base">{title}</h3>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---- FAQ ---------------------------------------------------------- */}
        <section id="faq" className="landing-glow scroll-mt-[68px] bg-[var(--color-background)]">
          <div className="max-w-3xl mx-auto px-gutter py-section">
            <SectionHeading eyebrow="FAQ" title="Common questions" centered />
            {/* Separate cards rather than one divided box, so the open one can
                stand out with an accent border and number. */}
            <div className="mt-10 flex flex-col gap-3">
              {FAQ.map(({ q, a }, index) => {
                const open = openFaq === index;
                return (
                  <Reveal key={q} delay={index * 60}>
                    <div
                      className={`border bg-[var(--color-surface-raised)] px-5 sm:px-6 transition-colors duration-300 ${
                        open
                          ? "border-[var(--color-chart-accent)]/50"
                          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(open ? null : index)}
                        aria-expanded={open}
                        className="w-full flex items-center gap-4 py-5 cursor-pointer select-none text-left"
                      >
                        <span
                          className="landing-mono w-6 shrink-0 text-xs font-bold transition-colors duration-300"
                          style={{ color: open ? "var(--color-chart-accent)" : "var(--color-text-subtle)" }}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1 font-bold text-sm sm:text-base">{q}</span>
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center border transition-[rotate,border-color,color] duration-300 ease-out ${
                            open
                              ? "rotate-45 border-[var(--color-chart-accent)]/50 text-[var(--color-chart-accent)]"
                              : "border-[var(--color-border-strong)] text-[var(--color-text-subtle)]"
                          }`}
                          aria-hidden="true"
                        >
                          <IconPlus className="w-3.5 h-3.5" />
                        </span>
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
                          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed pb-5 -mt-1 pl-10 sm:pr-11">{a}</p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

      </main>

      {/* ---- Footer ----------------------------------------------------- */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/90">
        <div className="max-w-6xl mx-auto px-gutter py-12 flex flex-col sm:flex-row sm:items-start justify-between gap-8">
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
            <nav className="flex items-center gap-1 md:gap-4 max-md:-mx-3">
              <a
                href="https://github.com/ONIGIRIIII/CrunchCast"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                title="GitHub"
                className="tap-target flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-chart-accent)] transition-colors"
              >
                <IconGithub className="w-5 h-5" />
              </a>
              <a
                href="mailto:singhharshpreet675@gmail.com"
                aria-label="Email"
                title="Email"
                className="tap-target flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-chart-accent)] transition-colors"
              >
                <IconEmail className="w-5 h-5" />
              </a>
              <a
                href="https://www.linkedin.com/in/harshpreet-singh-2331762a4/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                title="LinkedIn"
                className="tap-target flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-chart-accent)] transition-colors"
              >
                <IconLinkedIn className="w-5 h-5" />
              </a>
            </nav>
          </div>
        </div>
      </footer>
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
      <h2 className="text-h2 font-black tracking-tight leading-tight">{title}</h2>
      {subtitle && <p className="text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed">{subtitle}</p>}
    </div>
  );
}

// ---- Inline icon set ---------------------------------------------------
// Minimal hand-drawn SVGs (no icon library dependency, matching the
// stroke-based convention the header logomark already used) - each takes
// only a `className` for sizing/color so callers stay terse above.

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

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
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
