import type { CoursePrediction } from "@/lib/api";
import { bandFor } from "@/lib/scoreColor";

/** Horizontal ticker strip summarizing every course in the term at a
 * glance - the dashboard's "watchlist" equivalent, using each course's own
 * score/confidence in place of a live price/change. Scrolls horizontally
 * if it doesn't fit the sidebar's width. */
export default function CourseTicker({ courses }: { courses: CoursePrediction[] }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] flex items-stretch overflow-x-auto">
      <p className="shrink-0 self-center text-xs font-medium text-[var(--color-text-subtle)] pl-5 pr-4">Your courses</p>
      <div className="flex items-stretch divide-x divide-[var(--color-border)] flex-1">
        {courses.map((c) => {
          const score = c.personalized_score ?? c.difficulty_score;
          const { dotClass, label } = bandFor(score);
          return (
            <div key={`${c.subject}-${c.course}`} className="flex items-center gap-3 px-5 py-4 shrink-0">
              <div className="w-9 h-9 rounded-full bg-[var(--color-hover-surface)] flex items-center justify-center text-[11px] font-semibold text-[var(--color-foreground)] shrink-0">
                {c.subject.slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-medium leading-tight">
                  {c.subject} {c.course}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-subtle)] mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                  {label} · {score.toFixed(0)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
