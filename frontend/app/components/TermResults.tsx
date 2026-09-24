"use client";

import { useState } from "react";
import type { PredictResponse, Weights } from "@/lib/api";
import DifficultyBadge from "./DifficultyBadge";
import ConfidenceNote from "./ConfidenceNote";
import CourseHistoryPanel from "./CourseHistoryPanel";
import CourseSearch from "./CourseSearch";
import TermScoreChart from "./TermScoreChart";
import SignalBars, { type SignalValue } from "./SignalBars";
import SignalGauges from "./SignalGauges";
import StatTile from "./StatTile";

const SIGNAL_ORDER = ["grade", "failrisk", "variance", "classsize"] as const;

function courseElId(subject: string, course: string) {
  return `course-detail-${subject}-${course}`;
}

function scrollToCourse(subject: string, course: string) {
  document.getElementById(courseElId(subject, course))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

interface TermResultsProps {
  result: PredictResponse;
  onSelectCourse: (subject: string, course: string) => void;
  addedKeys: Set<string>;
  onSaveTerm: () => void;
  onRemoveCourse: (index: number) => void;
  weights: Weights | null;
  onPersonalize: () => void;
  onRemovePersonalization: () => void;
}

export default function TermResults({
  result,
  onSelectCourse,
  addedKeys,
  onSaveTerm,
  onRemoveCourse,
  weights,
  onPersonalize,
  onRemovePersonalization,
}: TermResultsProps) {
  const [courseDescOpen, setCourseDescOpen] = useState(true);
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(new Set());

  function toggleCourse(key: string) {
    setCollapsedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const personalized = result.term_personalized_score;
  const mainScore = personalized ?? result.term_difficulty_score;

  const scorePoints = result.courses.map((c) => ({
    subject: c.subject,
    course: c.course,
    score: c.personalized_score ?? c.difficulty_score,
  }));
  const averageScore = scorePoints.reduce((sum, p) => sum + p.score, 0) / scorePoints.length;

  const highConfidenceCount = result.courses.filter((c) => c.confidence === "high").length;

  const avgSignals: SignalValue[] = SIGNAL_ORDER.map((key) => {
    const entries = result.courses.flatMap((c) => c.explanation.filter((e) => e.key === key));
    const value = entries.reduce((sum, e) => sum + e.score, 0) / entries.length;
    return { key, label: entries[0]?.label ?? key, value };
  });

  return (
    <section className="flex flex-col gap-6">
      {/* Single page-level grid: course selector top-left, spanning full
          height; everything else (overview row + detail panel) shares the
          same right-column width/position instead of using its own grid. */}
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] items-start">
        {/* Left: add-course search box plus the clickable course list -
            sticky so it stays pinned in view while the right side scrolls, at
            the same top offset as the "Saved Terms" sidebar (Dashboard's
            `sticky top-0` wrapper) so both stay level while scrolling. No
            top border - Dashboard's header border-b is this column's top
            edge at rest, one continuous gridline rather than two close
            parallel lines. */}
        <div className="flex flex-col border-r border-b border-[var(--color-border)] lg:border-r-0 lg:sticky lg:top-[73px]">
          <h2 className="flex items-center h-[69px] sm:h-[73px] px-4 border-b border-[var(--color-border)] text-2xl sm:text-3xl font-black tracking-widest">
            Term Builder
          </h2>
          <div className="h-[88px] flex flex-col justify-center px-4 border-b border-[var(--color-border)]">
            <h3 className="font-bold text-lg">Add Course</h3>
            <p className="text-xs text-[var(--color-text-subtle)] mt-1">Search or type a course code to add it to this term.</p>
          </div>
          <div className="flex flex-col gap-2 p-3">
            <CourseSearch onSelectCourse={onSelectCourse} addedKeys={addedKeys} />
            <div className="flex items-center gap-2">
              <button
                onClick={onSaveTerm}
                className="flex-1 border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3.5 py-2 text-sm font-semibold hover:bg-[var(--color-hover-surface)] hover:border-[var(--color-chart-accent)] hover:text-[var(--color-chart-accent)] transition-colors"
              >
                Save current term
              </button>
            </div>
          </div>

          {result.courses.length > 0 && (
            <>
              <div className="p-4 border-t border-b border-[var(--color-border)]">
                <h3 className="font-bold text-lg">Course Selection</h3>
                <p className="text-xs text-[var(--color-text-subtle)] mt-1">Courses added to this term so far.</p>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {result.courses.map((c, index) => {
                  return (
                  <div
                    key={`${c.subject}-${c.course}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => scrollToCourse(c.subject, c.course)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") scrollToCourse(c.subject, c.course);
                    }}
                    className="text-left p-4 transition-colors cursor-pointer hover:bg-[var(--color-hover-surface)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm truncate">
                              {c.subject} {c.course}
                            </p>
                            <DifficultyBadge score={c.personalized_score ?? c.difficulty_score} />
                          </div>
                          <ConfidenceNote confidence={c.confidence} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveCourse(index);
                          }}
                          aria-label={`Remove ${c.subject} ${c.course}`}
                          title={`Remove ${c.subject} ${c.course}`}
                          className="w-7 h-7 border border-[var(--color-border-strong)] text-[var(--color-text-subtle)] flex items-center justify-center hover:bg-[var(--color-hover-surface)] hover:border-severity-hard hover:text-severity-hard transition-colors"
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            scrollToCourse(c.subject, c.course);
                          }}
                          aria-label={`Jump to ${c.subject} ${c.course}`}
                          title={`Jump to ${c.subject} ${c.course}`}
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
            </>
          )}
        </div>

        {/* Right: overview row, then every course's full detail card -
            both share this column's exact width and horizontal position.
            No top border, same reasoning as the left column above. */}
        <div className="flex flex-col border-[var(--color-border)] lg:border-l">
          <div className="w-full flex items-center justify-between gap-3 h-[69px] sm:h-[73px] px-4 border-b border-r border-[var(--color-border)] text-2xl sm:text-3xl font-black tracking-widest text-left">
            <span>Overview</span>
            <div className="flex items-center gap-2 text-sm font-bold tracking-normal normal-case mr-6">
              {weights != null ? (
                <button
                  type="button"
                  onClick={onRemovePersonalization}
                  title="Remove personalization"
                  className="flex items-center justify-center gap-1.5 h-8 w-[174px] border border-[var(--color-chart-accent)] bg-[var(--color-chart-accent)]/10 whitespace-nowrap text-[var(--color-chart-accent)] hover:border-severity-hard hover:text-severity-hard hover:bg-severity-hard/10 transition-colors"
                >
                  Personalized
                  <span aria-hidden="true">&times;</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPersonalize}
                  className="h-8 w-[174px] flex items-center justify-center whitespace-nowrap transition-colors border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)] hover:border-[var(--color-chart-accent)] hover:text-[var(--color-chart-accent)]"
                >
                  Personalize
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_0.9fr] border-b border-r border-[var(--color-border)] divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)]">
            <div className="p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-base font-bold">Term risk performance</h3>
                <span className="text-xs text-[var(--color-text-subtle)]">
                  {highConfidenceCount}/{result.n_courses} high-confidence
                </span>
              </div>

              <p className="text-xs text-[var(--color-text-subtle)] mb-1">
                {personalized != null ? "Your crunch score" : "Term risk readout"}
              </p>
              <div className="flex items-center gap-3">
                <p className="text-4xl font-black tracking-tight">{mainScore.toFixed(0)}</p>
                <DifficultyBadge score={mainScore} showScore={false} />
              </div>
              {personalized != null && (
                <p className="text-xs text-[var(--color-text-subtle)] mt-1">
                  Objective historical score: {result.term_difficulty_score.toFixed(0)} / 100
                </p>
              )}

              <div className="grid grid-cols-2 border border-[var(--color-border)] divide-x divide-y divide-[var(--color-border)] mt-3">
                <StatTile label="Total credits" value={result.total_credits} />
                <StatTile label="Hard courses (≥70)" value={result.n_high_difficulty_courses} />
                <StatTile label="Courses" value={result.n_courses} />
                <StatTile
                  label="Hardest course"
                  value={`${result.hardest_course.subject} ${result.hardest_course.course}`}
                />
              </div>

              {result.low_confidence_courses.length > 0 && (
                <p className="mt-3 text-xs border-l-2 border-severity-moderate pl-3 py-1.5 text-[var(--color-foreground)]">
                  ! Low-confidence predictions for: {result.low_confidence_courses.join(", ")}. Treat these scores as
                  rough guesses.
                </p>
              )}
            </div>

            <div className="p-4 flex flex-col">
              <h3 className="text-base font-bold">Score by course</h3>
              <p className="text-xs text-[var(--color-text-subtle)] mb-3">
                Each course relative to your {averageScore.toFixed(0)}-point term average
              </p>
              <div className="flex-1 flex flex-col">
                <TermScoreChart points={scorePoints} averageScore={averageScore} />
              </div>
            </div>

            <div className="p-4 flex flex-col">
              <h3 className="text-base font-bold">Signal breakdown</h3>
              <p className="text-xs text-[var(--color-text-subtle)] mb-3">
                Averaged across your {result.n_courses} course{result.n_courses !== 1 && "s"}
              </p>
              <SignalBars signals={avgSignals} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCourseDescOpen((v) => !v)}
            aria-expanded={courseDescOpen}
            className="w-full flex items-center justify-between gap-3 p-4 border-b border-r border-[var(--color-border)] text-2xl sm:text-3xl font-black tracking-widest text-left hover:bg-[var(--color-hover-surface)] transition-colors"
          >
            <span>Course Description</span>
            <svg
              width="24"
              height="24"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className={`shrink-0 transition-transform ${courseDescOpen ? "rotate-180" : ""}`}
            >
              <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {courseDescOpen && (
          <div className="border-b border-r border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {result.courses.map((c, index) => {
              const courseKey = `${c.subject}-${c.course}`;
              const courseOpen = !collapsedCourses.has(courseKey);
              const courseSignals: SignalValue[] = c.explanation.map((e) => ({
                key: e.key,
                label: e.label,
                value: e.score,
                detail: e.detail,
              }));
              return (
                <div key={courseKey} id={courseElId(c.subject, c.course)} className="scroll-mt-6">
                  <button
                    type="button"
                    onClick={() => toggleCourse(courseKey)}
                    aria-expanded={courseOpen}
                    className="w-full p-4 border-b border-[var(--color-border)] flex items-center justify-between gap-4 text-left hover:bg-[var(--color-hover-surface)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl font-black text-[var(--color-text-subtle)] leading-none shrink-0">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-lg">
                            {c.subject} {c.course}
                          </p>
                          <DifficultyBadge score={c.personalized_score ?? c.difficulty_score} />
                          <span className="text-xs text-[var(--color-text-subtle)]">
                            {c.credits} cr{c.personalized_score != null && ` · objective ${c.difficulty_score.toFixed(0)}`}
                          </span>
                        </div>
                        <ConfidenceNote confidence={c.confidence} />
                      </div>
                    </div>
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className={`shrink-0 transition-transform ${courseOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {courseOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] md:divide-x md:divide-[var(--color-border)]">
                    <div className="p-5 sm:p-6">
                      <SignalGauges signals={courseSignals} />
                    </div>
                    <div className="p-5 sm:p-6">
                      <CourseHistoryPanel subject={c.subject} course={c.course} />
                    </div>
                  </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>
    </section>
  );
}
