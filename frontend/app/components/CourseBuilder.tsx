"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, predictTerm, type CourseInput, type PredictResponse, type Session, type Weights } from "@/lib/api";
import { clearWeights, loadWeights } from "@/lib/weights";
import { deleteCollection, loadCollections, saveCollection, type SavedCollection } from "@/lib/savedCollections";
import { loadTheme, saveTheme, type Theme } from "@/lib/theme";
import TermResults from "./TermResults";
import CourseSearch from "./CourseSearch";
import PersonalizationQuiz from "./PersonalizationQuiz";
import NavSidebar from "./NavSidebar";
import SaveCollectionModal from "./SaveCollectionModal";

const MAX_COURSES = 5;

function emptyDraft(): CourseInput {
  return { subject: "", course: "", session: "W" };
}

function EmptyResults() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border-strong)] flex flex-col items-center justify-center text-center gap-2 p-12 min-h-[420px]">
      <p className="text-sm font-medium text-[var(--color-foreground)]">No prediction yet</p>
      <p className="text-xs text-[var(--color-text-subtle)] max-w-xs">
        Add up to {MAX_COURSES} courses above, then hit &quot;Predict term difficulty&quot; to see your term risk
        breakdown here.
      </p>
    </div>
  );
}

export default function CourseBuilder() {
  const [courses, setCourses] = useState<CourseInput[]>([]);
  const [draft, setDraft] = useState<CourseInput>(emptyDraft());
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

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

  function addCourse() {
    const subject = draft.subject.trim().toUpperCase();
    const course = draft.course.trim().toUpperCase();
    addCourseIfNew(subject, course, draft.session);
    setDraft(emptyDraft());
  }

  function removeCourse(index: number) {
    setCourses(courses.filter((_, i) => i !== index));
    setResult(null);
    setActiveCollectionId(null);
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
    <div className="flex min-h-screen">
      <NavSidebar
        collections={collections}
        activeId={activeCollectionId}
        onSelect={handleSelectCollection}
        onDelete={handleDeleteCollection}
        personalized={weights != null}
        onOpenQuiz={() => setQuizOpen(true)}
        onClearPersonalization={() => {
          clearWeights();
          setWeights(null);
          setResult(null);
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 min-w-0 flex flex-col gap-6 px-4 sm:px-6 lg:px-10 py-8">
        {/* Course-builder bar - compact and horizontal, so the dashboard below
            gets the page's full width instead of sharing it with a sidebar. */}
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <CourseSearch
                onSelectCourse={(subject, course) => addCourseIfNew(subject, course, "W")}
                addedKeys={addedKeys}
                atMax={courses.length >= MAX_COURSES}
              />
            </div>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                addCourse();
              }}
            >
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-subtle)] mb-1.5" htmlFor="subject">
                  Subject
                </label>
                <input
                  id="subject"
                  placeholder="CPSC"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  className="w-24 rounded-md border border-[var(--color-border-strong)] bg-transparent px-3 py-2.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  maxLength={6}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-subtle)] mb-1.5" htmlFor="course">
                  Course
                </label>
                <input
                  id="course"
                  placeholder="110"
                  value={draft.course}
                  onChange={(e) => setDraft({ ...draft, course: e.target.value })}
                  className="w-20 rounded-md border border-[var(--color-border-strong)] bg-transparent px-3 py-2.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  maxLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={courses.length >= MAX_COURSES}
                className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-4 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-[var(--color-hover-surface)] transition-colors"
              >
                Add course
              </button>
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-[var(--color-border)]">
            <div className="flex flex-wrap items-center gap-2.5">
              {courses.length === 0 ? (
                <p className="text-xs text-[var(--color-text-subtle)]">No courses added yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-2.5">
                  {courses.map((c, i) => (
                    <li
                      key={`${c.subject}-${c.course}-${i}`}
                      className="flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] pl-4 pr-2 py-1.5 text-sm"
                    >
                      <span>
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
              {courses.length >= MAX_COURSES && (
                <span className="text-xs text-[var(--color-text-subtle)]">Max {MAX_COURSES} courses per term.</span>
              )}
            </div>

            <button
              onClick={handlePredict}
              disabled={courses.length === 0 || loading}
              className="shrink-0 rounded-md bg-blue-600 text-white px-5 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              {loading ? "Predicting..." : "Predict term difficulty"}
            </button>
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

        {/* Save only becomes available once there's something worth saving -
            a result the student has actually seen. */}
        {result && (
          <div className="flex justify-end -mt-2">
            <button
              onClick={() => setSaveModalOpen(true)}
              className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3.5 py-2 text-sm font-medium hover:bg-[var(--color-hover-surface)] transition-colors"
            >
              Save this term
            </button>
          </div>
        )}

        {/* Main: predictions get the page's full width now */}
        {result ? <TermResults result={result} /> : <EmptyResults />}
      </div>
    </div>
  );
}
