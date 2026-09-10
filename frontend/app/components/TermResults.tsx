import type { PredictResponse } from "@/lib/api";
import { bandFor } from "@/lib/scoreColor";
import { paletteFor } from "@/lib/coursePalette";
import DifficultyBadge from "./DifficultyBadge";
import ConfidenceNote from "./ConfidenceNote";
import CourseHistoryPanel from "./CourseHistoryPanel";
import CourseTicker from "./CourseTicker";
import TermScoreChart from "./TermScoreChart";
import SignalBars, { type SignalValue } from "./SignalBars";
import SignalGauges from "./SignalGauges";
import StatTile from "./StatTile";

const SIGNAL_ORDER = ["grade", "failrisk", "variance", "classsize"] as const;

export default function TermResults({ result }: { result: PredictResponse }) {
  const personalized = result.term_personalized_score;
  const mainScore = personalized ?? result.term_difficulty_score;
  const band = bandFor(mainScore);

  const scorePoints = result.courses.map((c) => ({
    subject: c.subject,
    course: c.course,
    score: c.personalized_score ?? c.difficulty_score,
  }));

  const highConfidenceCount = result.courses.filter((c) => c.confidence === "high").length;

  const avgSignals: SignalValue[] = SIGNAL_ORDER.map((key) => {
    const entries = result.courses.flatMap((c) => c.explanation.filter((e) => e.key === key));
    const value = entries.reduce((sum, e) => sum + e.score, 0) / entries.length;
    return { key, label: entries[0]?.label ?? key, value };
  });

  return (
    <section className="flex flex-col gap-6">
      {/* Full-width course ticker, so every course shows without needing to scroll it */}
      <CourseTicker courses={result.courses} />

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Left: term-level stats sidebar, sticky while scrolling the course list below */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h2 className="text-base font-semibold">Term risk performance</h2>
              <span className="text-xs text-[var(--color-text-subtle)]">
                {highConfidenceCount}/{result.n_courses} high-confidence
              </span>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs text-[var(--color-text-subtle)] mb-1.5">
                  {personalized != null ? "Your crunch score" : "Term risk readout"}
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-4xl font-bold tracking-tight">{mainScore.toFixed(0)}</p>
                  <DifficultyBadge score={mainScore} />
                </div>
                {personalized != null && (
                  <p className="text-xs text-[var(--color-text-subtle)] mt-1.5">
                    Objective historical score: {result.term_difficulty_score.toFixed(0)} / 100
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Total credits" value={result.total_credits} dotColor="#3b82f6" />
                <StatTile label="Hard courses (≥70)" value={result.n_high_difficulty_courses} dotColor="#ef4444" />
                <StatTile label="Courses" value={result.n_courses} dotColor="#10b981" />
                <StatTile
                  label="Hardest course"
                  value={`${result.hardest_course.subject} ${result.hardest_course.course}`}
                  dotColor="#f59e0b"
                />
              </div>

              <div className={`rounded-2xl p-5 flex flex-col ${band.heroClass}`}>
                <p className={`text-xs font-medium ${band.heroMutedClass}`}>
                  {personalized != null ? "Your crunch score" : "Term difficulty"}
                </p>
                <p className="text-3xl font-bold text-white mt-1">{mainScore.toFixed(0)} / 100</p>
                <div className="mt-3">
                  <TermScoreChart points={scorePoints} />
                </div>
              </div>
            </div>

            {result.low_confidence_courses.length > 0 && (
              <p className="mt-5 text-xs rounded-md bg-amber-500/10 text-amber-400 px-3.5 py-2.5">
                Low-confidence predictions for: {result.low_confidence_courses.join(", ")}. Treat these scores as
                rough guesses.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
            <p className="text-sm font-semibold">Signal breakdown</p>
            <p className="text-xs text-[var(--color-text-subtle)] mb-4">
              Averaged across your {result.n_courses} course{result.n_courses !== 1 && "s"}
            </p>
            <SignalBars signals={avgSignals} />
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
            <p className="text-sm font-semibold mb-3">About this score</p>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              {personalized != null
                ? "Your crunch score is a weighted combination of four real historical signals (grade impact, fail risk, grading unpredictability, class size), weighted by your quiz answers. "
                : "Difficulty scores are a proxy built from historical UBC grade outcomes (2016W and earlier): lower average grade, higher fail rate, and higher grade variance push a score up. "}
              This is not a direct measurement of workload - a generously-graded but time-consuming course can still
              score as &quot;easy&quot; here.
            </p>
            <p className="mt-3 text-xs text-[var(--color-text-subtle)] leading-relaxed">
              See the project README for full details and limitations of this proxy score.
            </p>
          </div>
        </div>

        {/* Right: per-course detail cards, directly under the course ticker, stacked, each with its own accent color */}
        <div className="flex flex-col gap-5">
          {result.courses.map((c, index) => {
            const accent = paletteFor(index);
            const courseSignals: SignalValue[] = c.explanation.map((e) => ({
              key: e.key,
              label: e.label,
              value: e.score,
              detail: e.detail,
            }));
            return (
              <div
                key={`${c.subject}-${c.course}`}
                className="rounded-2xl border border-[var(--color-border)] border-t-2 bg-[var(--color-surface)] p-5 sm:p-6"
                style={{ borderTopColor: accent.hex }}
              >
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent.hex }} />
                    <div>
                      <p className="font-semibold text-lg">
                        {c.subject} {c.course}
                      </p>
                      <ConfidenceNote confidence={c.confidence} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 text-sm text-[var(--color-text-subtle)] shrink-0">
                    <DifficultyBadge score={c.personalized_score ?? c.difficulty_score} />
                    <span className="text-xs text-[var(--color-text-subtle)]">
                      {c.credits} cr{c.personalized_score != null && ` · objective ${c.difficulty_score.toFixed(0)}`}
                    </span>
                  </div>
                </div>
                <SignalGauges signals={courseSignals} />
                <CourseHistoryPanel subject={c.subject} course={c.course} accentHex={accent.hex} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
