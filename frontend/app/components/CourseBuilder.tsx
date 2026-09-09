"use client";

import { useState } from "react";
import { ApiError, predictTerm, type CourseInput, type PredictResponse, type Session } from "@/lib/api";
import TermResults from "./TermResults";

const MAX_COURSES = 8;

function emptyDraft(): CourseInput {
  return { subject: "", course: "", session: "W" };
}

export default function CourseBuilder() {
  const [courses, setCourses] = useState<CourseInput[]>([]);
  const [draft, setDraft] = useState<CourseInput>(emptyDraft());
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCourse() {
    const subject = draft.subject.trim().toUpperCase();
    const course = draft.course.trim().toUpperCase();
    if (!subject || !course) return;
    if (courses.length >= MAX_COURSES) return;
    setCourses([...courses, { subject, course, session: draft.session }]);
    setDraft(emptyDraft());
    setResult(null);
  }

  function removeCourse(index: number) {
    setCourses(courses.filter((_, i) => i !== index));
    setResult(null);
  }

  async function handlePredict() {
    if (courses.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await predictTerm(courses);
      setResult(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong reaching the API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
        <h2 className="text-sm font-semibold mb-3">Add a course</h2>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            addCourse();
          }}
        >
          <div>
            <label className="block text-xs text-neutral-500 mb-1" htmlFor="subject">
              Subject
            </label>
            <input
              id="subject"
              placeholder="CPSC"
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="w-28 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-sm uppercase"
              maxLength={6}
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1" htmlFor="course">
              Course
            </label>
            <input
              id="course"
              placeholder="110"
              value={draft.course}
              onChange={(e) => setDraft({ ...draft, course: e.target.value })}
              className="w-24 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-sm uppercase"
              maxLength={6}
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1" htmlFor="session">
              Session
            </label>
            <select
              id="session"
              value={draft.session}
              onChange={(e) => setDraft({ ...draft, session: e.target.value as Session })}
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-sm"
            >
              <option value="W">Winter</option>
              <option value="S">Summer</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={courses.length >= MAX_COURSES}
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            Add course
          </button>
        </form>
        {courses.length >= MAX_COURSES && (
          <p className="mt-2 text-xs text-neutral-500">Max {MAX_COURSES} courses per term.</p>
        )}
      </section>

      {courses.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3">Your term ({courses.length})</h2>
          <ul className="flex flex-wrap gap-2">
            {courses.map((c, i) => (
              <li
                key={`${c.subject}-${c.course}-${i}`}
                className="flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 pl-3 pr-1.5 py-1 text-sm"
              >
                <span>
                  {c.subject} {c.course} <span className="text-neutral-400">({c.session})</span>
                </span>
                <button
                  onClick={() => removeCourse(i)}
                  aria-label={`Remove ${c.subject} ${c.course}`}
                  className="rounded-full w-5 h-5 text-xs text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={handlePredict}
            disabled={loading}
            className="mt-4 rounded-md bg-blue-600 text-white px-5 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Predicting..." : "Predict term difficulty"}
          </button>
        </section>
      )}

      {error && (
        <p className="rounded-md bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {result && <TermResults result={result} />}
    </div>
  );
}
