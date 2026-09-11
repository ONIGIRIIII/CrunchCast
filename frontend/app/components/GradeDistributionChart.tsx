"use client";

import { useId, useState } from "react";
import type { GradeBin } from "@/lib/api";

const WIDTH = 600;
const HEIGHT = 120;
const PAD_X = 12;
const PAD_Y = 14;

/** Line/area chart of the 11-bin grade distribution, in the same visual
 * language as the term-level TermScoreChart (line + soft area fill, hover
 * dots with a tooltip) rather than a plain bar chart. `accentHex` is that
 * course's own accent color (lib/coursePalette.ts) so the chart matches
 * the rest of its panel. Each instance gets its own gradient id via
 * useId() since several of these can render on the page at once. */
export default function GradeDistributionChart({
  distribution,
  accentHex = "#60a5fa",
}: {
  distribution: GradeBin[];
  accentHex?: string;
}) {
  const gradientId = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const total = distribution.reduce((sum, b) => sum + b.count, 0);
  const max = Math.max(1, ...distribution.map((b) => b.count));
  const n = distribution.length;

  const xFor = (i: number) => PAD_X + (i * (WIDTH - PAD_X * 2)) / (n - 1);
  const yFor = (count: number) => PAD_Y + (1 - count / max) * (HEIGHT - PAD_Y * 2);

  const linePath = distribution.map((b, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(b.count)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(n - 1)} ${HEIGHT} L ${xFor(0)} ${HEIGHT} Z`;

  return (
    <div className="mt-4">
      <p className="text-xs text-[var(--color-text-subtle)] mb-2">Grade distribution</p>
      <div className="relative" style={{ height: HEIGHT }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ height: HEIGHT }}
          preserveAspectRatio="none"
          role="img"
          aria-label="Grade distribution line chart"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentHex} stopOpacity="0.35" />
              <stop offset="100%" stopColor={accentHex} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={accentHex} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {/* Dots are plain HTML circles positioned by percentage, not SVG
            <circle> elements - the chart's viewBox is stretched non-uniformly
            (preserveAspectRatio="none") to fill the responsive width, which
            would otherwise squash every <circle> into an ellipse. */}
        {distribution.map((b, i) => (
          <div
            key={b.bin}
            className="absolute -translate-x-1/2 -translate-y-1/2 p-1.5 cursor-pointer"
            style={{ left: `${(xFor(i) / WIDTH) * 100}%`, top: `${(yFor(b.count) / HEIGHT) * 100}%` }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
          >
            <span
              className="block rounded-full transition-transform"
              style={{ backgroundColor: accentHex, width: hovered === i ? 10 : 6, height: hovered === i ? 10 : 6 }}
            />
          </div>
        ))}
        {hovered != null && (
          <div
            className="absolute -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg bg-neutral-950 border border-neutral-800 text-white text-[11px] px-2.5 py-1.5 whitespace-nowrap pointer-events-none shadow-lg z-10"
            style={{
              left: `${(xFor(hovered) / WIDTH) * 100}%`,
              top: `${(yFor(distribution[hovered].count) / HEIGHT) * 100}%`,
            }}
          >
            <p className="font-bold">{distribution[hovered].bin}</p>
            <p className="text-neutral-400">
              {distribution[hovered].count} students (
              {total > 0 ? ((distribution[hovered].count / total) * 100).toFixed(0) : 0}%)
            </p>
          </div>
        )}
      </div>
      <div className="flex gap-1 mt-1">
        {distribution.map((b) => (
          <span key={b.bin} className="flex-1 text-center text-[9px] text-[var(--color-text-muted)] truncate">
            {b.bin}
          </span>
        ))}
      </div>
    </div>
  );
}
