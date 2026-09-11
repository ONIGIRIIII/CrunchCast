"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, predictTerm, type CourseInput, type PredictResponse, type Session, type Weights } from "@/lib/api";
import { loadWeights } from "@/lib/weights";
import { deleteCollection, loadCollections, saveCollection, type SavedCollection } from "@/lib/savedCollections";
import { loadTheme, saveTheme, type Theme } from "@/lib/theme";
import TermResults from "./TermResults";
import CourseSearch from "./CourseSearch";
import PersonalizationQuiz from "./PersonalizationQuiz";
import SaveCollectionModal from "./SaveCollectionModal";
import WorkdayUpload from "./WorkdayUpload";

const MAX_COURSES = 5;
const SIDEBAR_WIDTH = 264;

function EmptyResults() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border-strong)] flex flex-col items-center justify-center text-center gap-2 p-12 min-h-[420px]">
      <p className="text-sm font-medium text-[var(--color-foreground)]">No prediction yet</p>
      <p className="text-xs text-[var(--color-text-subtle)] max-w-xs">
        Add up to {MAX_COURSES} courses above, then hit &quot;Predict&quot; to see your term risk breakdown
        here.
      </p>
    </div>
  );
}

export default function CourseBuilder() {
  const [courses, setCourses] = useState<CourseInput[]>([]);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    // Reading localStorage on mount (not a "real" derived-state effect, but
    // deliberately deferred past the initial render so server and client
    // render the same "nothing loaded yet" output before hydration).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeights(loadWeights());
    setCollections(loadCollections());
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

  const addedKeys = useMemo(
    () => new Set(courses.map((c) => `${c.subject}-${c.course}`)),
    [courses]
  );

  function addCourseIfNew(subject: string, course: string, session: Session) {
    if (!subject || !course) return;
    if (courses.length >= MAX_COURSES) return;
    if (addedKeys.has(`${subject}-${course}`)) return;
    setCourses([...courses, { subject, course, session }]);
    setResult(null);
    setActiveCollectionId(null);
  }

  function removeCourse(index: number) {
    setCourses(courses.filter((_, i) => i !== index));
    setResult(null);
    setActiveCollectionId(null);
  }

  function handleNewTerm() {
    setCourses([]);
    setResult(null);
    setActiveCollectionId(null);
    setError(null);
  }

  async function handlePredict() {
    if (courses.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await predictTerm(courses, weights);
      setResult(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong reaching the API.");
    } finally {
      setLoading(false);
    }
  }

  function handleSaveCollection(name: string) {
    const updated = saveCollection(name, courses);
    setCollections(updated);
    setActiveCollectionId(updated[0].id);
    setSaveModalOpen(false);
  }

  function handleSelectCollection(collection: SavedCollection) {
    setCourses(collection.courses);
    setResult(null);
    setActiveCollectionId(collection.id);
  }

  function handleDeleteCollection(id: string) {
    setCollections(deleteCollection(id));
    if (activeCollectionId === id) setActiveCollectionId(null);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav bar - full width: logo/name on the left, personalize +
          theme toggle on the right. Everything else sits below it. */}
      <header className="mx-3 mt-3 rounded-2xl flex items-center gap-4 pl-4 pr-4 sm:pr-6 lg:pr-10 py-4 border border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <div className="flex-1 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 19V13M11 19V8M17 19V15M23 19V5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-black text-sm whitespace-nowrap">CrunchCast</span>
        </div>

        <nav className="hidden sm:flex items-center gap-6 shrink-0">
          <button className="text-sm font-semibold text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)] transition-colors">
            About
          </button>
          <button className="text-sm font-semibold text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)] transition-colors">
            How it works
          </button>
          <button className="text-sm font-semibold text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)] transition-colors">
            FAQ
          </button>
        </nav>

        <div className="flex-1 flex items-center justify-end gap-3">
          <button
            onClick={() => setQuizOpen(true)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold whitespace-nowrap transition-colors ${
              weights != null
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)]"
            }`}
          >
            {weights != null ? "Personalized ✓" : "Personalize"}
          </button>
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] w-8 h-8 flex items-center justify-center hover:bg-[var(--color-hover-surface)] transition-colors shrink-0"
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
        {/* Left column: the collapsible "Saved terms" nav bar. */}
        <div
          className="shrink-0 h-[calc(100vh-1.5rem)] sticky top-3 mt-3 mb-3 ml-3 flex flex-col gap-3 transition-[width] duration-200"
          style={{ width: sidebarOpen ? SIDEBAR_WIDTH : 64 }}
        >
          <aside className="flex-1 min-h-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col overflow-hidden">
          <div
            className={`flex items-center px-3 py-3 border-b border-[var(--color-border)] shrink-0 ${
              sidebarOpen ? "justify-between" : "justify-center"
            }`}
          >
            {sidebarOpen && <span className="font-bold text-sm whitespace-nowrap">Saved Terms</span>}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="rounded-md w-8 h-8 flex items-center justify-center text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)] transition-colors shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M9 4v16" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </div>

          <div className="px-3 py-3 shrink-0">
          <button
            onClick={handleNewTerm}
            title="New term"
            className={`w-full flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] hover:bg-[var(--color-hover-surface)] transition-colors text-sm font-bold py-2 ${
              sidebarOpen ? "justify-start px-3" : "justify-center px-0"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {sidebarOpen && <span className="whitespace-nowrap">New term</span>}
          </button>
        </div>

        {sidebarOpen && (
          <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
            <p className="text-xs font-medium text-[var(--color-text-subtle)] px-1.5 py-1.5 mb-1">
              Saved terms{collections.length > 0 && ` (${collections.length})`}
            </p>
            {collections.length === 0 ? (
              <p className="text-xs text-[var(--color-text-subtle)] px-1.5 py-1">
                No saved terms yet. Predict a term, then hit &quot;Save this term&quot; to keep it here.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {collections.map((c) => {
                  const active = c.id === activeCollectionId;
                  const preview = c.courses.map((course) => `${course.subject} ${course.course}`).join(", ");
                  return (
                    <li key={c.id}>
                      <div
                        className={`group flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                          active ? "bg-blue-950 border border-blue-800" : "hover:bg-[var(--color-hover-surface)]"
                        }`}
                        onClick={() => handleSelectCollection(c)}
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-bold truncate ${
                              active ? "text-blue-300" : "text-[var(--color-foreground)]"
                            }`}
                          >
                            {c.name}
                          </p>
                          <p className="text-xs text-[var(--color-text-subtle)] truncate">
                            {c.courses.length} course{c.courses.length !== 1 && "s"}
                            {preview && ` · ${preview}`}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCollection(c.id);
                          }}
                          aria-label={`Delete ${c.name}`}
                          className="shrink-0 rounded-full w-5 h-5 flex items-center justify-center text-xs text-[var(--color-text-subtle)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-border)] transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            </div>
          )}
        </aside>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-6 px-4 sm:px-6 lg:px-10 pt-3 pb-8">
        {/* Course-builder bar */}
        <section className="w-full flex flex-col gap-5">
          <h1 className="text-2xl font-black">Add a Course</h1>
          <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: manual entry */}
            <div className="flex flex-col gap-5">
              <CourseSearch
                onSelectCourse={(subject, course) => addCourseIfNew(subject, course, "W")}
                addedKeys={addedKeys}
                atMax={courses.length >= MAX_COURSES}
              />

              <div className="w-full flex flex-col gap-4">
                {/* Course list gets the same dashed-box treatment as the
                    screenshot dropzone opposite it, for visual parity. */}
                <div className="h-48 rounded-2xl border-2 border-dashed border-[var(--color-border-strong)] flex flex-col items-center justify-center text-center gap-2 p-6">
                  {courses.length === 0 ? (
                    <>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-[var(--color-text-subtle)]">
                        <path
                          d="M4 6h16M4 12h16M4 18h10"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      <p className="text-sm font-bold">No courses added yet</p>
                      <p className="text-xs text-[var(--color-text-subtle)]">
                        Search above to add up to {MAX_COURSES} courses
                      </p>
                    </>
                  ) : (
                    <ul className="flex flex-wrap justify-center gap-2.5">
                      {courses.map((c, i) => (
                        <li
                          key={`${c.subject}-${c.course}-${i}`}
                          className="flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] pl-4 pr-2 py-1.5 text-sm"
                        >
                          <span className="font-semibold">
                            {c.subject} {c.course}
                          </span>
                          <button
                            onClick={() => removeCourse(i)}
                            aria-label={`Remove ${c.subject} ${c.course}`}
                            className="rounded-full w-5 h-5 flex items-center justify-center text-xs text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)]"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {courses.length >= MAX_COURSES && (
                  <span className="text-xs text-[var(--color-text-subtle)]">Max {MAX_COURSES} courses per term.</span>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePredict}
                    disabled={courses.length === 0 || loading}
                    className="flex items-center gap-2 rounded-md bg-blue-600 text-white px-5 py-2.5 text-sm font-bold disabled:opacity-40 hover:bg-blue-700 transition-colors"
                  >
                    {loading ? (
                      "Predicting..."
                    ) : (
                      <>
                        Predict
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </>
                    )}
                  </button>
                  {/* Save only becomes available once there's something worth saving -
                      a result the student has actually seen. */}
                  {result && (
                    <button
                      onClick={() => setSaveModalOpen(true)}
                      className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3.5 py-2.5 text-sm font-semibold hover:bg-[var(--color-hover-surface)] transition-colors"
                    >
                      Save this term
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Workday screenshot upload */}
            <div className="flex flex-col gap-5">
              <div className="h-[38px] flex items-center">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-subtle)]">
                  Or upload a Workday screenshot
                </p>
              </div>
              <WorkdayUpload />
            </div>
          </div>
        </section>

        <PersonalizationQuiz
          open={quizOpen}
          onClose={() => setQuizOpen(false)}
          onComplete={(newWeights) => {
            setWeights(newWeights);
            setQuizOpen(false);
            setResult(null);
          }}
        />

        <SaveCollectionModal
          open={saveModalOpen}
          courseCount={courses.length}
          onClose={() => setSaveModalOpen(false)}
          onSave={handleSaveCollection}
        />

        {error && <p className="rounded-md bg-red-950 text-red-300 px-3 py-2 text-sm">{error}</p>}

        {/* Main: predictions get the page's full width now */}
        <h2 className="text-2xl font-black">Prediction</h2>
        {result ? <TermResults result={result} /> : <EmptyResults />}
      </div>
      </div>
    </div>
  );
}
