"use client";

import { useRef, useState } from "react";
import { labelAlignClass, tooltipAlignClass, useDismissTooltipOnOutsidePointer } from "@/lib/chartTooltip";

export interface ScorePoint {
  subject: string;
  course: string;
  score: number;
}

const WIDTH = 600;
const HEIGHT = 160;
const PAD_X = 12;
const PAD_Y = 18;

interface TermScoreChartProps {
  points: ScorePoint[];
  /** Term-level average score, drawn as a dashed horizontal reference line
   * so each course reads relative to the term mean instead of in isolation. */
  averageScore?: number;
}

/** Line/area chart of each course's score across the term, in the order
 * added - the hero chart's analog of a price-over-time line, using real
 * per-course scores instead of a time series we don't have. */
export default function TermScoreChart({ points, averageScore }: TermScoreChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissTooltipOnOutsidePointer(rootRef, hovered, setHovered);

  if (points.length < 2) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-text-subtle)]">
        Add another course to see a comparison across your term.
      </div>
    );
  }

  const n = points.length;
  const xFor = (i: number) => PAD_X + (i * (WIDTH - PAD_X * 2)) / (n - 1);

  // Scale the y-axis to the actual spread of scores in this term (plus a
  // little padding) instead of the full fixed 0-100 range, so real
  // differences between courses are visible instead of compressed into a
  // narrow band in the middle of the chart.
  const allScores = [...points.map((p) => p.score), ...(averageScore != null ? [averageScore] : [])];
  const rawMin = Math.min(...allScores);
  const rawMax = Math.max(...allScores);
  const padding = Math.max((rawMax - rawMin) * 0.1, 3);
  const domainMin = Math.max(0, rawMin - padding);
  const domainMax = Math.min(100, rawMax + padding);
  const domainRange = domainMax - domainMin || 1;

  const yFor = (score: number) => PAD_Y + (1 - (score - domainMin) / domainRange) * (HEIGHT - PAD_Y * 2);

  const TICK_COUNT = 4;
  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => domainMin + (domainRange * i) / (TICK_COUNT - 1));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.score)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(n - 1)} ${HEIGHT} L ${xFor(0)} ${HEIGHT} Z`;

  return (
    <div ref={rootRef} className="@container flex flex-col h-full">
      {/* This wrapper's height must be exactly the SVG's rendered height -
          nothing else can live inside it - since the dots/tooltip below are
          positioned by percentage against it. It fills the remaining space
          in its flex parent instead of a fixed pixel height, so the chart
          uses the full card rather than leaving empty space beneath it. */}
      <div className="flex-1 min-h-[140px] flex gap-2">
      {/* Y-axis tick labels, sharing the same yFor percentages as the chart
          itself so they line up with the gridlines drawn inside the SVG. */}
      <div className="relative w-6 shrink-0">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute right-0 -translate-y-1/2 text-[9px] text-[var(--color-text-subtle)]"
            style={{ top: `${(yFor(t) / HEIGHT) * 100}%` }}
          >
            {Math.round(t)}
          </span>
        ))}
      </div>
      <div className="relative flex-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Difficulty score by course: ${points
          .map((p) => `${p.subject} ${p.course} ${p.score.toFixed(0)}`)
          .join(", ")}${averageScore != null ? `; term average ${averageScore.toFixed(0)}` : ""}`}
      >
        <defs>
          <linearGradient id="term-score-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-chart-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <line
            key={t}
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={yFor(t)}
            y2={yFor(t)}
            stroke="var(--color-border)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={areaPath} fill="url(#term-score-fill)" />
        {averageScore != null && (
          <line
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={yFor(averageScore)}
            y2={yFor(averageScore)}
            stroke="var(--color-text-muted)"
            strokeOpacity={0.8}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path d={linePath} fill="none" stroke="var(--color-chart-accent)" strokeWidth={0.75} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {averageScore != null && (
        <div
          className="absolute right-0 -translate-y-1/2 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 whitespace-nowrap pointer-events-none"
          style={{ top: `${(yFor(averageScore) / HEIGHT) * 100}%` }}
        >
          Avg {averageScore.toFixed(0)}
        </div>
      )}
      {/* Dots are plain HTML circles positioned by percentage, not SVG
          <circle> elements - the chart's viewBox is stretched non-uniformly
          (preserveAspectRatio="none") to fill the responsive width, which
          would otherwise squash every <circle> into an ellipse. Buttons, not
          divs, so the tooltip also opens on tap and keyboard focus instead
          of only on mouse hover. */}
      {points.map((p, i) => (
        <button
          type="button"
          key={`${p.subject}-${p.course}`}
          aria-label={`${p.subject} ${p.course}: ${p.score.toFixed(0)} out of 100`}
          className="tap-target absolute -translate-x-1/2 -translate-y-1/2 p-2 flex items-center justify-center cursor-pointer"
          style={{ left: `${(xFor(i) / WIDTH) * 100}%`, top: `${(yFor(p.score) / HEIGHT) * 100}%` }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
          onFocus={() => setHovered(i)}
          onBlur={() => setHovered((h) => (h === i ? null : h))}
          onClick={() => setHovered(i)}
        >
          <span
            className={`block bg-[var(--color-chart-accent)] transition-transform ${hovered === i ? "w-3 h-3" : "w-2 h-2"}`}
          />
        </button>
      ))}
      {hovered != null && (
        <div
          className={`absolute ${tooltipAlignClass((xFor(hovered) / WIDTH) * 100)} -translate-y-[calc(100%+10px)] bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] text-[var(--color-foreground)] text-xs px-3 py-2 whitespace-nowrap pointer-events-none z-10`}
          style={{
            left: `${(xFor(hovered) / WIDTH) * 100}%`,
            top: `${(yFor(points[hovered].score) / HEIGHT) * 100}%`,
          }}
        >
          <p className="font-bold">
            {points[hovered].subject} {points[hovered].course}
          </p>
          <p className="text-[var(--color-text-muted)]">{points[hovered].score.toFixed(0)} / 100</p>
        </div>
      )}
      </div>
      </div>
      {/* Each label sits directly under its own point (ml-8 = the y-axis
          column + gap above). With many courses in a narrow chart every
          other label drops out rather than overlapping - the dots' own
          tooltips still name every one. */}
      <div className="relative h-4 mt-2 ml-8">
        {points.map((p, i) => (
          <span
            key={`${p.subject}-${p.course}-label`}
            className={`absolute top-0 whitespace-nowrap text-[10px] text-[var(--color-text-subtle)] ${labelAlignClass(i, n)} ${
              i % 2 === 1 ? (n > 8 ? "hidden @xl:inline" : n > 5 ? "hidden @md:inline" : n > 4 ? "hidden @xs:inline" : "") : ""
            }`}
            style={{ left: `${(xFor(i) / WIDTH) * 100}%` }}
          >
            {p.subject} {p.course}
          </span>
        ))}
      </div>
    </div>
  );
}
