"use client";

import { useEffect, useState } from "react";
import { useRevealOnce } from "@/lib/useRevealOnce";
import DifficultyBadge from "./DifficultyBadge";
import RiskGauge from "./RiskGauge";

// Landing page "The honest part" - the README's own workload example as two
// made-up courses, scored with the dashboard's real gauge and badge: the
// heavy-workload course that grades generously scores low, the light one
// with strict grading scores high. Workload is shown on each card but marked
// "not counted", since it never reaches the score. The scores are
// illustrative (labelled as such on the page), not real course data.

const EXAMPLES: { name: string; load: number; loadLabel: string; grading: string; score: number }[] = [
  { name: "Example A", load: 5, loadLabel: "heavy", grading: "generous", score: 28 },
  { name: "Example B", load: 1, loadLabel: "light", grading: "strict", score: 81 },
];

const LOAD_BARS = 5;

export default function ExampleCourses() {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {EXAMPLES.map((example, index) => (
          <ExampleCard key={example.name} example={example} index={index} />
        ))}
      </div>
      <p className="landing-mono mt-3 text-center text-[11px] text-[var(--color-text-subtle)]">
        Made-up courses to show the idea, not real scores.
      </p>
    </div>
  );
}

/** Eases from 0 up to `target` once `active` turns true (after `delayMs`).
 * Jumps straight to the target under reduced motion. */
function useCountUp(target: number, active: boolean, delayMs: number, durationMs = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : durationMs;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, reduced ? 0 : delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, active, delayMs, durationMs]);
  return value;
}

function ExampleCard({ example, index }: { example: (typeof EXAMPLES)[number]; index: number }) {
  const [ref, shown] = useRevealOnce<HTMLElement>();
  const delay = index * 150;
  const score = useCountUp(example.score, shown, delay + 700);

  return (
    <article
      ref={ref}
      className={`flex flex-col border border-[var(--color-border)] bg-[var(--color-surface-raised)] transition-[opacity,translate] duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex flex-col gap-2.5 px-5 py-4 border-b border-[var(--color-border)]">
        <p className="landing-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-chart-accent)" }}>
          {example.name}
        </p>

        {/* Workload and grading side by side, each with its counted/not-
            counted tag next to the value - the tag wraps under the value
            only where a half is too narrow for both (phones/tablets). */}
        <div className="grid grid-cols-2 divide-x divide-[var(--color-border)]">
          {/* Workload: shown, but marked as never reaching the score */}
          <div className="flex flex-col items-start gap-1.5 pr-4">
            <span className="landing-mono text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">Weekly load</span>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span className="flex items-end gap-2">
                <span className="flex items-end gap-1" aria-hidden="true">
                  {Array.from({ length: LOAD_BARS }, (_, i) => (
                    <span
                      key={i}
                      className={`w-1 transition-[opacity] duration-300 motion-reduce:transition-none ${
                        i < example.load ? "bg-[var(--color-text-muted)]" : "bg-[var(--color-border)]"
                      }`}
                      style={{ height: `${6 + i * 2}px`, opacity: shown ? 1 : 0, transitionDelay: `${delay + 250 + i * 60}ms` }}
                    />
                  ))}
                </span>
                <span className="text-xs font-bold leading-none">{example.loadLabel}</span>
              </span>
              <span className="landing-mono border border-dashed border-[var(--color-border-strong)] px-1.5 py-px text-[9px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                not counted
              </span>
            </div>
          </div>

          {/* Grading: the part the score actually sees */}
          <div className="flex flex-col items-start gap-1.5 pl-4">
            <span className="landing-mono text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">Grading</span>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span className="text-xs font-bold leading-[14px]">{example.grading}</span>
              <span className="landing-mono border border-[var(--color-chart-accent)]/50 bg-[var(--color-chart-accent)]/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-[var(--color-chart-accent)]">
                counted
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pt-7 pb-7">
        <div className="w-full max-w-[19rem]">
          <RiskGauge score={score} size={304} showValue />
        </div>
        <DifficultyBadge score={score} showScore={false} />
      </div>
    </article>
  );
}
