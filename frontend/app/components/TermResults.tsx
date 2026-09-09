import type { PredictResponse } from "@/lib/api";
import DifficultyBadge from "./DifficultyBadge";
import ConfidenceNote from "./ConfidenceNote";

export default function TermResults({ result }: { result: PredictResponse }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-500">Term risk readout</h2>
            <p className="text-3xl font-bold mt-1">{result.term_difficulty_score.toFixed(0)} / 100</p>
          </div>
          <DifficultyBadge score={result.term_difficulty_score} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">Total credits</dt>
            <dd className="font-medium">{result.total_credits}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Hard courses (≥70)</dt>
            <dd className="font-medium">{result.n_high_difficulty_courses}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Hardest course</dt>
            <dd className="font-medium">
              {result.hardest_course.subject} {result.hardest_course.course}
            </dd>
          </div>
        </dl>
        {result.low_confidence_courses.length > 0 && (
          <p className="mt-4 text-xs rounded-md bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-3 py-2">
            Low-confidence predictions for: {result.low_confidence_courses.join(", ")}. Treat these scores as rough guesses.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
        {result.courses.map((c) => (
          <div key={`${c.subject}-${c.course}`} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">
                {c.subject} {c.course}
              </p>
              <ConfidenceNote confidence={c.confidence} />
            </div>
            <div className="flex items-center gap-4 text-sm text-neutral-500">
              <span>{c.credits} cr</span>
              <DifficultyBadge score={c.difficulty_score} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Difficulty scores are a proxy built from historical UBC grade outcomes (2016W and earlier):
        lower average grade, higher fail rate, and higher grade variance push a score up. This is not
        a direct measurement of workload - a generously-graded but time-consuming course can still
        score as &quot;easy&quot; here. See the project README for details and limitations.
      </p>
    </section>
  );
}
