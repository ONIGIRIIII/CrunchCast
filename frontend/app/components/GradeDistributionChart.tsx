"use client";

import { useId, useRef, useState } from "react";
import { labelAlignClass, tooltipAlignClass, useDismissTooltipOnOutsidePointer } from "@/lib/chartTooltip";
import type { GradeBin } from "@/lib/api";

const WIDTH = 600;
const HEIGHT = 160;
const PAD_X = 12;
const PAD_Y = 18;
const TICK_COUNT = 4;

/** Line/area chart of the 11-bin grade distribution, styled to match the
 * term-level TermScoreChart exactly (same height, y-axis tick labels,
 * gridlines, orange accent, hover dots with a tooltip) rather than a plain
 * bar chart. Each instance gets its own gradient id via useId() since
 * several of these can render on the page at once. */
export default function GradeDistributionChart({
  distribution,
}: {
  distribution: GradeBin[];
}) {
  const accentColor = "var(--color-chart-accent)";
  const gradientId = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissTooltipOnOutsidePointer(rootRef, hovered, setHovered);
  const total = distribution.reduce((sum, b) => sum + b.count, 0);
  const max = Math.max(1, ...distribution.map((b) => b.count));
  const n = distribution.length;

  const xFor = (i: number) => PAD_X + (i * (WIDTH - PAD_X * 2)) / (n - 1);
  const yFor = (count: number) => PAD_Y + (1 - count / max) * (HEIGHT - PAD_Y * 2);

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => (max * i) / (TICK_COUNT - 1));

  const linePath = distribution.map((b, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(b.count)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(n - 1)} ${HEIGHT} L ${xFor(0)} ${HEIGHT} Z`;

  return (
    <div ref={rootRef} className="@container mt-4">
      <p className="text-xs text-[var(--color-text-subtle)] mb-2">Grade distribution</p>
      <div className="min-h-[140px] flex gap-2">
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
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-full" preserveAspectRatio="none" role="img" aria-label="Grade distribution line chart">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.22" />
                <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
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
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path d={linePath} fill="none" stroke={accentColor} strokeWidth={0.75} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          {/* Dots are plain HTML circles positioned by percentage, not SVG
              <circle> elements - the chart's viewBox is stretched non-uniformly
              (preserveAspectRatio="none") to fill the responsive width, which
              would otherwise squash every <circle> into an ellipse. Buttons
              so tap and keyboard focus open the tooltip too, not just hover. */}
          {distribution.map((b, i) => (
            <button
              type="button"
              key={b.bin}
              aria-label={`${b.bin}: ${b.count} students`}
              className="tap-target absolute -translate-x-1/2 -translate-y-1/2 p-1.5 flex items-center justify-center cursor-pointer"
              style={{ left: `${(xFor(i) / WIDTH) * 100}%`, top: `${(yFor(b.count) / HEIGHT) * 100}%` }}
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
                top: `${(yFor(distribution[hovered].count) / HEIGHT) * 100}%`,
              }}
            >
              <p className="font-bold">{distribution[hovered].bin}</p>
              <p className="text-[var(--color-text-muted)]">
                {distribution[hovered].count} students (
                {total > 0 ? ((distribution[hovered].count / total) * 100).toFixed(0) : 0}%)
              </p>
            </div>
          )}
        </div>
      </div>
      {/* Each label sits directly under its own point (ml-8 = the y-axis
          column + gap above). 11 bin labels don't fit a phone-width chart,
          so every other one drops out until there's room. */}
      <div className="relative h-4 mt-2 ml-8">
        {distribution.map((b, i) => (
          <span
            key={b.bin}
            className={`absolute top-0 whitespace-nowrap text-[9px] text-[var(--color-text-subtle)] ${labelAlignClass(i, n)} ${
              i % 2 === 1 ? "hidden @lg:inline" : ""
            }`}
            style={{ left: `${(xFor(i) / WIDTH) * 100}%` }}
          >
            {b.bin}
          </span>
        ))}
      </div>
    </div>
  );
}
