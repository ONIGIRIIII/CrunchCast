"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, predictTerm, type CourseInput, type PredictResponse, type Session, type Weights } from "@/lib/api";
import { clearWeights, loadWeights } from "@/lib/weights";
import {
  deleteCollection,
  loadCollections,
  saveCollection,
  updateCollectionScore,
  type SavedCollection,
} from "@/lib/savedCollections";
import { loadTheme, saveTheme, type Theme } from "@/lib/theme";
import { loadDraftTerm, saveDraftTerm } from "@/lib/draftTerm";
import TermResults from "./TermResults";
import PersonalizationQuiz from "./PersonalizationQuiz";
import SaveCollectionModal from "./SaveCollectionModal";
import NewTermModal from "./NewTermModal";
import DifficultyBadge from "./DifficultyBadge";

// Rail widths in rem (260px / 64px at the default 16px root) so they scale
// with the rest of the dashboard - see :root:has(.app-dashboard) in
// globals.css.
const SIDEBAR_WIDTH = "16.25rem";
const RAIL_WIDTH = "4rem";

// Term Builder column width at lg+, exposed as --tb-w on the dashboard root
// and read by both the header's title column and TermResults' grid, so the
// header divider always sits on the Term Builder / Overview line.
// - Saved Terms collapsed: Term Builder gets 25% of the space beside the
//   rail; Overview / Course Description get the other 75%.
// - Saved Terms open: Saved Terms + Term Builder together take 35% of the
//   page; Overview / Course Description get the other 65%.
// Never narrower than 18rem (the "Term Builder" heading and course rows
// still fit there), so on smaller laptops the split leans a little past
// 25% / 35%; from ~1440px up it's exact.
const TERM_BUILDER_WIDTH_COLLAPSED = `max(18rem, (100vw - ${RAIL_WIDTH}) * 0.25)`;
const TERM_BUILDER_WIDTH_OPEN = `max(18rem, 100vw * 0.35 - ${SIDEBAR_WIDTH})`;
// Matches Tailwind's `lg` breakpoint - the width at which the inline Saved
// Terms rail replaces the mobile drawer.
const DESKTOP_QUERY = "(min-width: 1024px)";

function EmptyResults() {
  return (
    <div className="border border-dashed border-[var(--color-border-strong)] flex flex-col items-center justify-center text-center gap-2 p-12 min-h-[26.25rem]">
      <p className="text-sm font-medium text-[var(--color-foreground)]">No prediction yet</p>
      <p className="text-xs text-[var(--color-text-subtle)] max-w-xs">
        Add courses above, then hit &quot;Predict&quot; to see your term risk breakdown here.
      </p>
    </div>
  );
}

function PredictingPlaceholder() {
  return (
    <div className="border border-dashed border-[var(--color-border-strong)] flex flex-col items-center justify-center text-center gap-2 p-12 min-h-[26.25rem]">
      <p className="text-sm font-medium text-[var(--color-foreground)]">Predicting...</p>
      <p className="text-xs text-[var(--color-text-subtle)] max-w-xs">Scoring your term, one moment.</p>
    </div>
  );
}

interface SavedTermsPanelProps {
  /** "rail" is the lg+ inline sidebar (collapsible to a 64px icon column);
   * "drawer" is the below-lg overlay, always expanded, whose header button
   * closes it instead of collapsing it. */
  variant: "rail" | "drawer";
  expanded: boolean;
  onToggle: () => void;
  collections: SavedCollection[];
  activeCollectionId: string | null;
  onNewTerm: () => void;
  onLoad: (collection: SavedCollection) => void;
  onDelete: (id: string) => void;
}

function SavedTermsPanel({
  variant,
  expanded,
  onToggle,
  collections,
  activeCollectionId,
  onNewTerm,
  onLoad,
  onDelete,
}: SavedTermsPanelProps) {
  const toggleLabel = variant === "drawer" ? "Close Saved Terms" : expanded ? "Collapse sidebar" : "Expand sidebar";
  return (
    // No top border - the header's own border-b above is this card's top
    // edge, so the two read as one continuous gridline instead of two
    // parallel lines a few px apart.
    <aside
      className="flex-1 min-h-0 border-x border-b border-[var(--color-border)] backdrop-blur-xl backdrop-saturate-150 flex flex-col overflow-hidden"
      style={{
        background: "var(--glass-tint)",
        boxShadow: "inset 1px 0 0 var(--glass-highlight), 0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div
        className={`flex items-center h-[4.3125rem] sm:h-[4.5625rem] px-4 border-b border-[var(--color-border)] shrink-0 ${
          expanded ? "justify-between" : "justify-center"
        }`}
      >
        {expanded && (
          <div className="min-w-0">
            <h3 className="font-bold text-lg truncate">
              Saved Terms{collections.length > 0 && ` [${collections.length}]`}
            </h3>
            <p className="text-xs text-[var(--color-text-subtle)] mt-1 truncate">
              {variant === "drawer" ? "Tap to load the term." : "Click to load the term."}
            </p>
          </div>
        )}
        <button
          onClick={onToggle}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="tap-target w-8 h-8 border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)] hover:border-[var(--color-chart-accent)] hover:text-[var(--color-chart-accent)] transition-colors shrink-0"
        >
          {variant === "drawer" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <line x1="6" y1="2.5" x2="6" y2="13.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          )}
        </button>
      </div>

      <div className="h-[5.5rem] flex items-center px-4 border-b border-[var(--color-border)] shrink-0">
        <button
          onClick={onNewTerm}
          title="New Term"
          aria-label="New Term"
          className={`tap-target w-full flex items-center gap-2 border border-[var(--color-border-strong)] bg-transparent hover:bg-[var(--color-hover-surface)] hover:border-[var(--color-chart-accent)] hover:text-[var(--color-chart-accent)] transition-colors text-sm font-bold py-2 ${
            expanded ? "justify-start px-4" : "justify-center px-0"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {expanded && <span className="whitespace-nowrap">New Term</span>}
        </button>
      </div>

      {expanded && (
        <div className="flex-1 overflow-y-auto pb-2 min-h-0">
          {collections.length === 0 ? (
            <p className="text-xs text-[var(--color-text-subtle)] p-4">
              No saved terms yet. Predict a term, then hit &quot;Save this term&quot; to keep it here.
            </p>
          ) : (
            <div className="grid grid-cols-1 -space-y-px -mt-px">
              {collections.map((c) => {
                const active = c.id === activeCollectionId;
                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onLoad(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onLoad(c);
                    }}
                    className={`text-left p-4 border-t border-b border-[var(--color-border)] transition-colors cursor-pointer ${
                      active ? "bg-[var(--color-hover-surface)]" : "hover:bg-[var(--color-hover-surface)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{c.name}</p>
                        <p className="text-xs text-[var(--color-text-subtle)] truncate mt-0.5">
                          {c.score != null ? <DifficultyBadge score={c.score} /> : "Scoring…"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(c.id);
                          }}
                          aria-label={`Delete ${c.name}`}
                          title={`Delete ${c.name}`}
                          className="tap-target w-7 h-7 border border-[var(--color-border-strong)] text-[var(--color-text-subtle)] flex items-center justify-center hover:bg-[var(--color-hover-surface)] hover:border-severity-hard hover:text-severity-hard transition-colors"
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoad(c);
                          }}
                          aria-label={`Load ${c.name}`}
                          title={`Load ${c.name}`}
                          className="tap-target w-7 h-7 border border-[var(--color-border-strong)] text-[var(--color-text-subtle)] flex items-center justify-center hover:border-accent hover:text-accent transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                              d="M3 8h10M9 4l4 4-4 4"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseInput[]>([]);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newTermModalOpen, setNewTermModalOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Below lg there's no room for the inline sidebar rail, so Saved Terms
  // opens as an off-canvas drawer instead - separate state from
  // `sidebarOpen`, which only ever drives the lg+ rail's expanded width.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const backfillingScores = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Reading localStorage on mount (not a "real" derived-state effect, but
    // deliberately deferred past the initial render so server and client
    // render the same "nothing loaded yet" output before hydration).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeights(loadWeights());
    setCollections(loadCollections());
    setTheme(loadTheme());

    const draft = loadDraftTerm();
    if (!draft || draft.courses.length === 0) {
      router.replace("/");
      return;
    }
    setCourses(draft.courses);
    if (draft.result) {
      setResult(draft.result);
      setHydrated(true);
    } else {
      setHydrated(true);
      handlePredict(draft.courses);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Keep the draft in sync so a refresh on /dashboard always reflects the
    // current courses/result - only once hydration has resolved, so we
    // don't clobber storage with the pre-hydration empty state.
    if (!hydrated) return;
    saveDraftTerm({ courses, result });
  }, [hydrated, courses, result]);

  useEffect(() => {
    // Collections saved before the `score` field existed have none - predict
    // each one once in the background so its sidebar row can show a
    // difficulty badge instead of falling back to a course count.
    const unscored = collections.filter((c) => c.score == null && !backfillingScores.current.has(c.id));
    if (unscored.length === 0) return;
    for (const c of unscored) backfillingScores.current.add(c.id);
    (async () => {
      for (const c of unscored) {
        try {
          const response = await predictTerm(c.courses, weights);
          const score = response.term_personalized_score ?? response.term_difficulty_score;
          setCollections(updateCollectionScore(c.id, score));
        } catch {
          // Leave unscored - will retry next time collections change/mount.
          backfillingScores.current.delete(c.id);
        }
      }
    })();
  }, [collections, weights]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!drawerOpen) return;
    // Lock page scroll behind the drawer, close on Escape, and close if the
    // viewport grows past lg (where the inline rail takes over instead).
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (desktop.matches) setDrawerOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    desktop.addEventListener("change", onChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      desktop.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveTheme(next);
  }

  function openSavedTerms() {
    if (window.matchMedia(DESKTOP_QUERY).matches) setSidebarOpen(true);
    else setDrawerOpen(true);
  }

  const addedKeys = useMemo(
    () => new Set(courses.map((c) => `${c.subject}-${c.course}`)),
    [courses]
  );

  function addCourseIfNew(subject: string, course: string, session: Session) {
    if (!subject || !course) return;
    if (addedKeys.has(`${subject}-${course}`)) return;
    const next = [...courses, { subject, course, session }];
    setCourses(next);
    setActiveCollectionId(null);
    // Auto-predicts so the score is always current - the user only needs
    // Predict for a manual re-run (e.g. after changing weights elsewhere).
    handlePredict(next);
  }

  function removeCourse(index: number) {
    const next = courses.filter((_, i) => i !== index);
    setCourses(next);
    setActiveCollectionId(null);
    if (next.length === 0) {
      setResult(null);
    } else {
      handlePredict(next);
    }
  }

  function handleNewTerm() {
    setDrawerOpen(false);
    setNewTermModalOpen(true);
  }

  async function handleCreateNewTerm(newCourses: CourseInput[]) {
    setActiveCollectionId(null);
    setCourses(newCourses);
    const ok = await handlePredict(newCourses);
    if (ok) setNewTermModalOpen(false);
  }

  async function handlePredict(
    coursesToPredict: CourseInput[] = courses,
    weightsOverride: Weights | null = weights
  ): Promise<boolean> {
    if (coursesToPredict.length === 0) return false;
    setLoading(true);
    setError(null);
    try {
      const response = await predictTerm(coursesToPredict, weightsOverride);
      setResult(response);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong reaching the API.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function handleSaveCollection(name: string) {
    const score = result ? result.term_personalized_score ?? result.term_difficulty_score : undefined;
    const updated = saveCollection(name, courses, score);
    setCollections(updated);
    setActiveCollectionId(updated[0].id);
    setSaveModalOpen(false);
  }

  function handlePredictCollection(collection: SavedCollection) {
    setDrawerOpen(false);
    setCourses(collection.courses);
    setActiveCollectionId(collection.id);
    handlePredict(collection.courses);
  }

  function handleDeleteCollection(id: string) {
    setCollections(deleteCollection(id));
    if (activeCollectionId === id) {
      setActiveCollectionId(null);
      setCourses([]);
      setResult(null);
    }
  }

  return (
    <div
      className="app-dashboard min-h-screen flex flex-col"
      style={
        {
          "--rail-w": sidebarOpen ? SIDEBAR_WIDTH : RAIL_WIDTH,
          "--tb-w": sidebarOpen ? TERM_BUILDER_WIDTH_OPEN : TERM_BUILDER_WIDTH_COLLAPSED,
        } as CSSProperties
      }
    >
      {/* Top nav bar - just logo/name now. Saved Term/Personalize/theme
          toggle live in TermResults' own "Overview" title row instead. */}
      {/* Below md the header's py-3 + 44px touch-size buttons keep it at
          about the same height as md+'s py-4 + 32px buttons. The buttons
          use tap-target-until-lg (not tap-target) so a touch device at lg+
          never grows this row past the 4.5625rem (73px at full scale) the
          sidebar/Term Builder gridline offsets assume. */}
      <header
        className="sticky top-0 z-30 flex items-center gap-2 sm:gap-4 py-3 md:py-4 border-x border-b border-[var(--color-border)] backdrop-blur-xl backdrop-saturate-150 shrink-0"
        style={{
          background: "var(--glass-tint)",
          boxShadow: "inset 0 1px 0 var(--glass-highlight), 0 8px 30px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex items-center self-stretch whitespace-nowrap -ml-px">
          {/* Fixed 4rem (64px at full scale), centered - same width as the sidebar's own
              collapsed column below, so this icon sits on the exact same
              vertical line as the ">" toggle and "+" New Term button
              instead of drifting with the header's own left padding. The
              -ml-px above cancels the header's own 1px left border (kept
              for the boxed look) so this still starts at true x=0, same as
              the sidebar's own left edge - otherwise everything here,
              including the divider below, would sit 1px too far right and
              miss the sidebar's border line. */}
          {/* border-r (not a separate background-color divider span) so
              this uses the exact same technique as the sidebar's own
              border-x below it - two 1px lines built different ways (one a
              border, one a background span) can round to different device
              pixels even when the math matches, so both sides now draw
              their line the same way. -my-4 cancels the header's own py-4
              so the border reaches the header's actual top/bottom edges
              (full navbar height), not just this row's content height.
              Width tracks the sidebar's own current width (64 collapsed /
              SIDEBAR_WIDTH open) instead of a fixed 64, so the divider
              still lines up with the sidebar's right edge in both states.
              That tracking only applies at lg+, where the rail exists -
              below lg it's a plain 64px cell (the drawer overlays the page
              instead of pushing it). */}
          <Link
            href="/"
            aria-label="CrunchCast home"
            className="shrink-0 self-stretch -my-3 md:-my-4 w-16 lg:w-[var(--rail-w)] flex items-center justify-center border-r border-[var(--color-border)] transition-[width] duration-200 hover:opacity-85"
          >
            <svg viewBox="-2 0 24 24" fill="none" aria-hidden="true" className="w-[1.875rem] h-[1.875rem]">
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
          </Link>
          {/* Second column, --tb-w wide only at lg+ (the same width as
              TermResults' Term Builder column - see TERM_BUILDER_WIDTH_* -
              which only sits beside Overview from lg up; below it they
              stack, so there's no boundary to line up with). It ends
              exactly on the Term Builder/Overview divider below and
              animates with it when Saved Terms opens/closes. */}
          <div className="flex items-center justify-start gap-2 px-3 lg:w-[var(--tb-w)] lg:shrink-0 lg:@container transition-[width] duration-200">
            <Link href="/" className="tap-target-until-lg inline-flex items-center font-black text-lg sm:text-xl lg:text-[1.75rem] hover:opacity-85 transition-opacity">
              Crunch<span style={{ color: "var(--color-chart-accent)" }}>Cast</span>
            </Link>
            {/* "| Dashboard" drops below xs (no room next to the menu/theme
                buttons on a phone), and at lg+ whenever the column is
                narrower than the full title needs (~23.5rem) - hiding it
                rather than shrinking the font, since the header's height
                (which the sidebar/Term Builder gridline rows match) comes
                from this text size. */}
            <span className="hidden xs:inline-flex items-center gap-2 lg:@max-[23.5rem]:hidden">
              <span className="text-lg sm:text-xl lg:text-[1.75rem] text-[var(--color-text-subtle)]">|</span>
              <span className="font-black text-lg sm:text-xl lg:text-[1.75rem]" style={{ color: "var(--color-chart-accent)" }}>
                Dashboard
              </span>
            </span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3 pr-3 sm:pr-6 lg:pr-10">
          <button
            onClick={openSavedTerms}
            title="Open Saved Terms"
            className="hidden sm:flex tap-target-until-lg h-8 px-4 items-center text-base font-bold whitespace-nowrap transition-colors border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)] hover:border-[var(--color-chart-accent)] hover:text-[var(--color-chart-accent)]"
          >
            Saved Term
          </button>
          {/* Phone-width stand-in for the "Saved Term" text button above -
              the hamburger that opens the Saved Terms drawer. */}
          <button
            onClick={openSavedTerms}
            aria-label="Open Saved Terms"
            aria-expanded={drawerOpen}
            aria-controls="saved-terms-drawer"
            className="sm:hidden tap-target-until-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] w-8 h-8 flex items-center justify-center text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)] hover:border-[var(--color-chart-accent)] hover:text-[var(--color-chart-accent)] transition-colors shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="tap-target-until-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] w-8 h-8 flex items-center justify-center hover:bg-[var(--color-hover-surface)] hover:border-[var(--color-chart-accent)] hover:text-[var(--color-chart-accent)] transition-colors shrink-0"
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

      <div className="flex flex-1 min-h-0">
        {/* Left column: the "Saved terms" nav rail - lg+ only. Below lg
            the same panel opens as an overlay drawer (right below) instead
            of permanently taking 64-260px of a phone's width. */}
        <div
          className="hidden lg:flex shrink-0 h-[calc(100dvh-4.5625rem)] sticky top-[4.5625rem] flex-col gap-3 transition-[width] duration-200"
          style={{ width: sidebarOpen ? SIDEBAR_WIDTH : RAIL_WIDTH }}
        >
          <SavedTermsPanel
            variant="rail"
            expanded={sidebarOpen}
            onToggle={() => setSidebarOpen((v) => !v)}
            collections={collections}
            activeCollectionId={activeCollectionId}
            onNewTerm={handleNewTerm}
            onLoad={handlePredictCollection}
            onDelete={handleDeleteCollection}
          />
        </div>

        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <div
              id="saved-terms-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Saved Terms"
              className="drawer-enter absolute inset-y-0 left-0 w-[min(85vw,20rem)] flex flex-col bg-[var(--color-background)]"
            >
              <SavedTermsPanel
                variant="drawer"
                expanded
                onToggle={() => setDrawerOpen(false)}
                collections={collections}
                activeCollectionId={activeCollectionId}
                onNewTerm={handleNewTerm}
                onLoad={handlePredictCollection}
                onDelete={handleDeleteCollection}
              />
            </div>
          </div>
        )}

      <div className="flex-1 min-w-0 flex flex-col gap-6 pb-8">
        <PersonalizationQuiz
          open={quizOpen}
          onClose={() => setQuizOpen(false)}
          onComplete={(newWeights) => {
            setWeights(newWeights);
            setQuizOpen(false);
            // Re-predict immediately with the new weights instead of just
            // clearing the result - otherwise the dashboard would show the
            // empty state until the user manually hit Predict again.
            handlePredict(courses, newWeights);
          }}
        />

        <SaveCollectionModal
          open={saveModalOpen}
          courseCount={courses.length}
          onClose={() => setSaveModalOpen(false)}
          onSave={handleSaveCollection}
        />

        <NewTermModal
          key={newTermModalOpen ? "new-term-open" : "new-term-closed"}
          open={newTermModalOpen}
          onClose={() => setNewTermModalOpen(false)}
          onCreate={handleCreateNewTerm}
          loading={loading}
          error={error}
        />

        {error && (
          <p className="border-l-2 border-severity-hard pl-3 pr-3 py-1.5 text-sm text-[var(--color-foreground)]">
            ! {error}
          </p>
        )}

        {/* Main: predictions get the page's full width now */}
        {result ? (
          <TermResults
            result={result}
            onSelectCourse={(subject, course) => addCourseIfNew(subject, course, "W")}
            addedKeys={addedKeys}
            onSaveTerm={() => setSaveModalOpen(true)}
            onRemoveCourse={removeCourse}
            weights={weights}
            onPersonalize={() => setQuizOpen(true)}
            onRemovePersonalization={() => {
              setWeights(null);
              clearWeights();
              handlePredict(courses, null);
            }}
          />
        ) : loading ? (
          <PredictingPlaceholder />
        ) : (
          <EmptyResults />
        )}
      </div>
      </div>
    </div>
  );
}
