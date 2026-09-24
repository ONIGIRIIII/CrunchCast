"use client";

import { useState } from "react";
import type { CourseInput, Session } from "@/lib/api";
import CourseSearch from "./CourseSearch";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (courses: CourseInput[]) => void;
  loading: boolean;
  error: string | null;
}

/** Lets the user build a brand-new term (search, add, remove courses, then
 * Predict) without leaving the dashboard - "New Term" used to discard the
 * current draft and route back to the landing page's own picker, which lost
 * whatever was on screen. Dashboard owns the actual courses/result state;
 * this component only tracks the in-progress selection and hands the final
 * list to `onCreate` once the user predicts, closing itself (via `open`
 * flipping false) only once that succeeds.
 *
 * Dashboard mounts this with a `key` tied to its open state, so every time
 * it opens React gives it a fresh instance (and fresh useState) instead of
 * reusing one with stale courses from the last time it was open - simpler
 * than an effect that resets state on every `open` change. */
export default function NewTermModal({ open, onClose, onCreate, loading, error }: Props) {
  const [courses, setCourses] = useState<CourseInput[]>([]);

  if (!open) return null;

  const addedKeys = new Set(courses.map((c) => `${c.subject}-${c.course}`));

  function close() {
    onClose();
  }

  function addCourse(subject: string, course: string) {
    if (!subject || !course) return;
    if (addedKeys.has(`${subject}-${course}`)) return;
    setCourses((prev) => [...prev, { subject, course, session: "W" as Session }]);
  }

  function removeCourse(index: number) {
    setCourses((prev) => prev.filter((_, i) => i !== index));
  }

  function predict() {
    if (courses.length === 0 || loading) return;
    onCreate(courses);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative w-full max-w-lg bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold">New term</h2>
          <button
            onClick={close}
            aria-label="Close"
            className="w-6 h-6 flex items-center justify-center text-sm text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)]"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-subtle)] mb-4">
          Add courses to start a fresh term - this replaces what&apos;s on the dashboard now once you predict.
        </p>

        <CourseSearch onSelectCourse={addCourse} addedKeys={addedKeys} />

        {courses.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {courses.map((c, index) => (
              <button
                key={`${c.subject}-${c.course}`}
                type="button"
                onClick={() => removeCourse(index)}
                aria-label={`Remove ${c.subject} ${c.course}`}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:border-severity-hard hover:text-severity-hard transition-colors"
              >
                {c.subject} {c.course}
                <span aria-hidden="true">&times;</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="border-l-2 border-severity-hard pl-3 pr-3 py-1.5 text-sm text-[var(--color-foreground)] mt-4">
            ! {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 mt-5">
          <button onClick={close} className="text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)]">
            Cancel
          </button>
          <button
            onClick={predict}
            disabled={courses.length === 0 || loading}
            className="bg-[var(--color-chart-accent)] text-white px-4 py-2 text-sm font-bold disabled:opacity-40 hover:opacity-85 transition-opacity"
          >
            {loading ? "Predicting..." : "Predict"}
          </button>
        </div>
      </div>
    </div>
  );
}
