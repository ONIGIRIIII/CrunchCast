"use client";

import type { ComponentType } from "react";
import { useRevealOnce } from "@/lib/useRevealOnce";

// Landing page "How it works" cards - one per real signal behind a score
// (see model/predict.py's EXPLANATION_SPECS and build_features.py's
// add_component_scores). Each card gets a small illustration of what that
// signal actually measures, which plays once as the card scrolls into view.
// The illustrations are deliberately number-free: they show the shape of
// each measurement, not real course data.
//
// `measures` is the raw historical column each 0-100 score is ranked from,
// and `direction` which way that column pushes the score - grade impact is
// the one inverted signal (a lower average ranks higher).

type SignalKey = "grade" | "failrisk" | "variance" | "classsize";

const SIGNALS: { key: SignalKey; label: string; measures: string; direction: string; detail: string }[] = [
  {
    key: "grade",
    label: "Grade impact",
    measures: "avg",
    direction: "lower average → higher score",
    detail: "Where the course's average grade sits among other courses at its level. A lower average means a higher score.",
  },
  {
    key: "failrisk",
    label: "Fail risk",
    measures: "fail_rate",
    direction: "more fails → higher score",
    detail: "The share of students who have failed the course in past terms.",
  },
  {
    key: "variance",
    label: "Grading unpredictability",
    measures: "std_dev",
    direction: "wider spread → higher score",
    detail: "How spread out grades are within a section. A wide spread means the class average tells you less about where you'll land.",
  },
  {
    key: "classsize",
    label: "Class size",
    measures: "enrolled",
    direction: "bigger class → higher score",
    detail: "How many students usually take it. Bigger classes score higher, and you can turn this down in the personalization quiz if size doesn't bother you.",
  },
];

type VisualProps = { shown: boolean };

const VISUALS: Record<SignalKey, ComponentType<VisualProps>> = {
  grade: GradeImpactVisual,
  failrisk: FailRiskVisual,
  variance: SpreadVisual,
  classsize: ClassSizeVisual,
};

export default function SignalCards() {
  return (
    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
      {SIGNALS.map((signal, index) => (
        <SignalCard key={signal.key} signal={signal} index={index} />
      ))}
    </div>
  );
}

function SignalCard({ signal, index }: { signal: (typeof SIGNALS)[number]; index: number }) {
  const [ref, shown] = useRevealOnce<HTMLElement>();
  const Visual = VISUALS[signal.key];
  // Right-hand column trails the left slightly when a row reveals together.
  // Delay covers only the entrance (opacity/translate), not border-color,
  // so hover feedback stays instant afterwards.
  const delay = (index % 2) * 120;
  return (
    <article
      ref={ref}
      className={`group flex flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:border-[var(--color-border-strong)] transition-[opacity,translate,border-color] duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${delay}ms, ${delay}ms, 0ms` }}
    >
      <div className="relative h-48 border-b border-[var(--color-border)] bg-[var(--color-background)]/40">
        <code className="landing-mono absolute top-3 left-4 text-[11px] text-[var(--color-text-subtle)]">
          {signal.measures}
        </code>
        <Visual shown={shown} />
        <p className="landing-mono absolute bottom-3 right-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">
          {signal.direction}
        </p>
      </div>
      <div className="flex flex-col gap-2 p-6">
        <div className="flex items-baseline gap-3">
          <span className="landing-mono text-xs font-bold" style={{ color: "var(--color-chart-accent)" }}>
            0{index + 1}
          </span>
          <h3 className="font-bold text-base">{signal.label}</h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{signal.detail}</p>
      </div>
    </article>
  );
}

// ---- Illustrations ---------------------------------------------------------
// Each fills the space between the card's top tag and bottom caption.

// Other courses at the same level, as [x%, lane] along an average-grade axis.
const PEERS: [number, number][] = [
  [5, 0], [9, 2], [13, 1], [21, 0], [25, 2], [29, 1], [33, 0], [37, 2], [41, 1], [45, 0], [49, 2],
  [53, 1], [57, 0], [61, 2], [65, 1], [69, 0], [73, 2], [77, 1], [82, 0], [87, 2], [91, 1], [95, 0],
];

/** Same-level courses scattered along an average-grade axis, with this
 * course's marker sliding toward the low-average (high-score) end. */
function GradeImpactVisual({ shown }: VisualProps) {
  return (
    <div className="absolute inset-x-6 top-10 bottom-10">
      <div className="absolute inset-x-0 bottom-5 h-px bg-[var(--color-border-strong)]" />
      <span className="landing-mono absolute left-0 bottom-0 text-[10px] text-[var(--color-text-subtle)]">low avg</span>
      <span className="landing-mono absolute right-0 bottom-0 text-[10px] text-[var(--color-text-subtle)]">high avg</span>
      {PEERS.map(([x, lane], i) => (
        <span
          key={i}
          className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--color-text-subtle)] transition-opacity duration-500 motion-reduce:transition-none"
          style={{ left: `${x}%`, bottom: `${28 + lane * 11}px`, opacity: shown ? 0.5 : 0, transitionDelay: `${i * 25}ms` }}
        />
      ))}
      <div
        className="absolute top-0 bottom-5 w-0 transition-[left] duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] delay-500 motion-reduce:transition-none"
        style={{ left: shown ? "17%" : "50%" }}
      >
        <span className="landing-mono absolute top-0 left-0 -translate-x-1/2 whitespace-nowrap border border-[var(--color-chart-accent)]/50 bg-[var(--color-chart-accent)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--color-chart-accent)]">
          this course
        </span>
        <span className="absolute top-6 bottom-0 left-0 border-l border-dashed border-[var(--color-chart-accent)]/60" />
        <span className="absolute bottom-0 left-0 h-3 w-3 -translate-x-1/2 translate-y-1/2">
          <span className="absolute inset-0 rounded-full bg-[var(--color-chart-accent)] opacity-60 motion-safe:animate-ping" />
          <span className="absolute inset-0 rounded-full bg-[var(--color-chart-accent)]" />
        </span>
      </div>
    </div>
  );
}

// 48 past students, 6 of whom failed (just a picture of "a share", not data).
const STUDENTS = 48;
const FAILED = [4, 13, 22, 30, 39, 45];

/** A block of past students filling in, then the ones who failed turning red. */
function FailRiskVisual({ shown }: VisualProps) {
  const fillDone = STUDENTS * 18 + 250;
  return (
    <div className="absolute inset-x-6 top-10 bottom-10 flex items-center justify-center">
      <div className="grid w-full max-w-[16rem] grid-cols-12 gap-1.5">
        {Array.from({ length: STUDENTS }, (_, i) => {
          const failedAt = FAILED.indexOf(i);
          const failed = failedAt !== -1;
          return (
            <span
              key={i}
              className={`aspect-square transition-[opacity,background-color] duration-300 motion-reduce:transition-none ${
                shown && failed ? "bg-severity-hard" : "bg-[var(--color-border-strong)]"
              }`}
              style={{
                opacity: shown ? 1 : 0,
                transitionDelay: `${i * 18}ms, ${failed ? fillDone + failedAt * 140 : 0}ms`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function bellPath(sigma: number, height: number): string {
  const points: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = 8 + (i * 224) / 60;
    const y = 92 - height * Math.exp(-((x - 120) ** 2) / (2 * sigma ** 2));
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M ${points.join(" L ")}`;
}
const TIGHT_CURVE = bellPath(15, 78);
const WIDE_CURVE = bellPath(40, 50);

/** A tight grade distribution for reference, and a wide one spreading out
 * from it - then breathing gently (see .signal-breathe in globals.css). */
function SpreadVisual({ shown }: VisualProps) {
  return (
    <div className="absolute inset-x-6 top-10 bottom-10">
      <div className="landing-mono absolute -top-7 right-0 flex items-center gap-3 text-[10px] text-[var(--color-text-subtle)]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t border-dashed border-[var(--color-text-subtle)]" /> tight
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-[var(--color-chart-accent)]" /> wide
        </span>
      </div>
      <svg viewBox="0 0 240 96" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <line x1="8" x2="232" y1="92" y2="92" stroke="var(--color-border-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path
          d={TIGHT_CURVE}
          fill="none"
          stroke="var(--color-text-subtle)"
          strokeWidth="1.25"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        <g
          className="transition-[transform,opacity] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] delay-300 motion-reduce:transition-none"
          style={{ transformOrigin: "120px 92px", transform: shown ? "scaleX(1)" : "scaleX(0.38)", opacity: shown ? 1 : 0 }}
        >
          <g className={shown ? "signal-breathe" : undefined}>
            <path d={`${WIDE_CURVE} L 232 92 L 8 92 Z`} fill="var(--color-chart-accent)" fillOpacity="0.14" />
            <path d={WIDE_CURVE} fill="none" stroke="var(--color-chart-accent)" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
          </g>
        </g>
      </svg>
    </div>
  );
}

// Lecture-hall seats in rows around a podium, front row first. Coordinates
// are rounded to 2 decimals: the server (Node) and the browser can compute
// Math.cos/sin differently in the last digit, and unrounded values made the
// server-rendered cx/cy attributes fail to hydrate.
const HALL_ROWS = [24, 36, 48, 60, 72, 84];
const round2 = (v: number) => Math.round(v * 100) / 100;
const SEATS = HALL_ROWS.flatMap((r, row) => {
  const n = Math.floor((Math.PI * r) / 10.5);
  return Array.from({ length: n }, (_, j) => {
    const angle = Math.PI - ((j + 0.5) * Math.PI) / n;
    return { x: round2(120 + r * Math.cos(angle)), y: round2(96 - r * Math.sin(angle)), row, j };
  });
});
const FILLED_SEATS = Math.round(SEATS.length * 0.82);

/** A lecture hall filling up from the front row back. */
function ClassSizeVisual({ shown }: VisualProps) {
  return (
    <div className="absolute inset-x-6 top-9 bottom-9">
      <svg viewBox="0 0 240 102" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect x="108" y="97" width="24" height="4" fill="var(--color-chart-accent)" />
        {SEATS.map((s, i) => (
          <circle key={`empty-${i}`} cx={s.x} cy={s.y} r="2.6" fill="none" stroke="var(--color-border-strong)" strokeWidth="1" />
        ))}
        {SEATS.slice(0, FILLED_SEATS).map((s, i) => (
          <circle
            key={`filled-${i}`}
            cx={s.x}
            cy={s.y}
            r="2.6"
            fill="var(--color-text-muted)"
            className="transition-opacity duration-300 motion-reduce:transition-none"
            style={{ opacity: shown ? 1 : 0, transitionDelay: `${300 + s.row * 160 + s.j * 12}ms` }}
          />
        ))}
      </svg>
    </div>
  );
}
