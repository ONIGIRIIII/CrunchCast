"use client";

import { useState } from "react";

export interface ScorePoint {
  subject: string;
  course: string;
  score: number;
}

const WIDTH = 600;
const HEIGHT = 160;
const PAD_X = 12;
const PAD_Y = 18;

/** Line/area chart of each course's score across the term, in the order
 * added - the hero chart's analog of a price-over-time line, using real
 * per-course scores instead of a time series we don't have. */
export default function TermScoreChart({ points }: { points: ScorePoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-white/60">
        Add another course to see a comparison across your term.
      </div>
    );
  }

  const n = points.length;
  const xFor = (i: number) => PAD_X + (i * (WIDTH - PAD_X * 2)) / (n - 1);
  const yFor = (score: number) => PAD_Y + (1 - score / 100) * (HEIGHT - PAD_Y * 2);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.score)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(n - 1)} ${HEIGHT} L ${xFor(0)} ${HEIGHT} Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: HEIGHT }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="term-score-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.32" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#term-score-fill)" />
        <path d={linePath} fill="none" stroke="white" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={`${p.subject}-${p.course}`}
            cx={xFor(i)}
            cy={yFor(p.score)}
            r={hovered === i ? 6 : 4}
            className="fill-white cursor-pointer transition-[r]"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
          />
        ))}
      </svg>
      {hovered != null && (
        <div
          className="absolute -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg bg-black/85 text-white text-xs px-3 py-2 whitespace-nowrap pointer-events-none shadow-lg"
          style={{
            left: `${(xFor(hovered) / WIDTH) * 100}%`,
            top: `${(yFor(points[hovered].score) / HEIGHT) * 100}%`,
          }}
        >
          <p className="font-semibold">
            {points[hovered].subject} {points[hovered].course}
          </p>
          <p className="text-white/70">{points[hovered].score.toFixed(0)} / 100</p>
        </div>
      )}
      <div className="flex justify-between mt-2 px-1">
        {points.map((p) => (
          <span key={`${p.subject}-${p.course}-label`} className="text-[10px] text-white/60">
            {p.subject} {p.course}
          </span>
        ))}
      </div>
    </div>
  );
}
