"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const SIDEBAR_WIDTH = 260;

function EmptyResults() {
  return (
    <div className="border border-dashed border-[var(--color-border-strong)] flex flex-col items-center justify-center text-center gap-2 p-12 min-h-[420px]">
      <p className="text-sm font-medium text-[var(--color-foreground)]">No prediction yet</p>
      <p className="text-xs text-[var(--color-text-subtle)] max-w-xs">
        Add courses above, then hit &quot;Predict&quot; to see your term risk breakdown here.
      </p>
    </div>
  );
}

function PredictingPlaceholder() {
  return (
    <div className="border border-dashed border-[var(--color-border-strong)] flex flex-col items-center justify-center text-center gap-2 p-12 min-h-[420px]">
      <p className="text-sm font-medium text-[var(--color-foreground)]">Predicting...</p>
      <p className="text-xs text-[var(--color-text-subtle)] max-w-xs">Scoring your term, one moment.</p>
    </div>
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

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveTheme(next);
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
    <div className="min-h-screen flex flex-col">
      {/* Top nav bar - just logo/name now. Saved Term/Personalize/theme
          toggle live in TermResults' own "Overview" title row instead. */}
      <header
        className="sticky top-0 z-30 flex items-center gap-4 py-4 border-x border-b border-[var(--color-border)] backdrop-blur-xl backdrop-saturate-150 shrink-0"
        style={{
          background: "var(--glass-tint)",
          boxShadow: "inset 0 1px 0 var(--glass-highlight), 0 8px 30px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex items-center self-stretch whitespace-nowrap -ml-px">
          {/* Fixed 64px, centered - same width as the sidebar's own
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
              still lines up with the sidebar's right edge in both states. */}
          <Link
            href="/"
            className="shrink-0 self-stretch -my-4 flex items-center justify-center border-r border-[var(--color-border)] transition-[width] duration-200 hover:opacity-85"
            style={{ width: sidebarOpen ? SIDEBAR_WIDTH : 64 }}
          >
            <svg width="30" height="30" viewBox="-2 0 24 24" fill="none" aria-hidden="true">
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
          {/* Second column, 420px wide only at lg+ (matching TermResults'
              own `lg:grid-cols-[420px_1fr]`, which only kicks in at that
              breakpoint - below it Term Builder/Overview stack instead of
              sitting side by side, so there's no boundary to line up with).
              Its own border-r lands exactly on the Term Builder/Overview
              divider below; text sized up so it actually fills the column
              instead of sitting small in a lot of empty space. */}
          <div className="flex items-center justify-start gap-2 px-3 lg:w-[420px]">
            <Link href="/" className="font-black text-lg sm:text-xl lg:text-[28px] hover:opacity-85 transition-opacity">
              Crunch<span style={{ color: "var(--color-chart-accent)" }}>Cast</span>
            </Link>
            <span className="text-lg sm:text-xl lg:text-[28px] text-[var(--color-text-subtle)]">|</span>
            <span className="font-black text-lg sm:text-xl lg:text-[28px]" style={{ color: "var(--color-chart-accent)" }}>
              Dashboard
            </span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-3 pr-4 sm:pr-6 lg:pr-10">
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open Saved Terms"
            className="h-8 px-4 flex items-center text-base font-bold whitespace-nowrap transition-colors border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)] hover:border-[var(--color-chart-accent)] hover:text-[var(--color-chart-accent)]"
          >
            Saved Term
          </button>
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] w-8 h-8 flex items-center justify-center hover:bg-[var(--color-hover-surface)] hover:border-[var(--color-chart-accent)] hover:text-[var(--color-chart-accent)] transition-colors shrink-0"
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
        {/* Left column: the "Saved terms" nav bar - fixed width, no longer
            collapsible (Personalize/theme took over the toggle's spot in
            its header row above). */}
        <div
          className="shrink-0 h-[calc(100vh-69px)] sm:h-[calc(100vh-73px)] sticky top-[69px] sm:top-[73px] flex flex-col gap-3 transition-[width] duration-200"
          style={{ width: sidebarOpen ? SIDEBAR_WIDTH : 64 }}
        >
          {/* No top border - the header's own border-b above is this card's
              top edge, so the two read as one continuous gridline instead
              of two parallel lines a few px apart. */}
          <aside
            className="flex-1 min-h-0 border-x border-b border-[var(--color-border)] backdrop-blur-xl backdrop-saturate-150 flex flex-col overflow-hidden"
            style={{
              background: "var(--glass-tint)",
              boxShadow: "inset 1px 0 0 var(--glass-highlight), 0 8px 30px rgba(0,0,0,0.35)",
            }}
          >
          <div
            className={`flex items-center h-[69px] sm:h-[73px] px-4 border-b border-[var(--color-border)] shrink-0 ${
              sidebarOpen ? "justify-between" : "justify-center"
            }`}
          >
            {sidebarOpen && (
              <div className="min-w-0">
                <h3 className="font-bold text-lg truncate">
                  Saved Terms{collections.length > 0 && ` [${collections.length}]`}
                </h3>
                <p className="text-xs text-[var(--color-text-subtle)] mt-1 truncate">
                  Click to load the term.
                </p>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="w-8 h-8 border border-[var(--color-border-strong)] flex items-center justify-center text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)] hover:border-[var(--color-chart-accent)] hover:text-[var(--color-chart-accent)] transition-colors shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <line x1="6" y1="2.5" x2="6" y2="13.5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          </div>

          <div className="h-[88px] flex items-center px-4 border-b border-[var(--color-border)] shrink-0">
          <button
            onClick={handleNewTerm}
            title="New Term"
            className={`w-full flex items-center gap-2 border border-[var(--color-border-strong)] bg-transparent hover:bg-[var(--color-hover-surface)] hover:border-[var(--color-chart-accent)] hover:text-[var(--color-chart-accent)] transition-colors text-sm font-bold py-2 ${
              sidebarOpen ? "justify-start px-4" : "justify-center px-0"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {sidebarOpen && <span className="whitespace-nowrap">New Term</span>}
          </button>
        </div>

          {sidebarOpen && (
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
                      onClick={() => handlePredictCollection(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") handlePredictCollection(c);
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
                              handleDeleteCollection(c.id);
                            }}
                            aria-label={`Delete ${c.name}`}
                            title={`Delete ${c.name}`}
                            className="w-7 h-7 border border-[var(--color-border-strong)] text-[var(--color-text-subtle)] flex items-center justify-center hover:bg-[var(--color-hover-surface)] hover:border-severity-hard hover:text-severity-hard transition-colors"
                          >
                            ×
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePredictCollection(c);
                            }}
                            aria-label={`Load ${c.name}`}
                            title={`Load ${c.name}`}
                            className="w-7 h-7 border border-[var(--color-border-strong)] text-[var(--color-text-subtle)] flex items-center justify-center hover:border-accent hover:text-accent transition-colors"
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
      </div>

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
