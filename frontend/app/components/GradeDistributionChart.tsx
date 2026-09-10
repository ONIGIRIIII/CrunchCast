"use client";

import { useState } from "react";
import type { GradeBin } from "@/lib/api";

const CHART_HEIGHT = 72;

export default function GradeDistributionChart({ distribution }: { distribution: GradeBin[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = distribution.reduce((sum, b) => sum + b.count, 0);
  const max = Math.max(1, ...distribution.map((b) => b.count));

  return (
    <div className="mt-3">
      <p className="text-xs text-neutral-500 mb-1.5">Grade distribution</p>
      <div className="flex items-end gap-1" style={{ height: CHART_HEIGHT }} role="img" aria-label="Grade distribution bar chart">
        {distribution.map((b, i) => {
          const pct = total > 0 ? (b.count / total) * 100 : 0;
          const barHeight = Math.max(2, Math.round((b.count / max) * CHART_HEIGHT));
          return (
            <div
              key={b.bin}
              className="relative flex-1 flex flex-col justify-end items-center h-full"
              title={`${b.bin}: ${b.count} students (${pct.toFixed(0)}%)`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            >
              {hovered === i && (
                <div className="absolute bottom-full mb-1 whitespace-nowrap rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-[10px] px-1.5 py-0.5 z-10">
                  {b.count} students ({pct.toFixed(0)}%)
                </div>
              )}
              <div
                aria-label={`${b.bin}: ${b.count} students (${pct.toFixed(0)}%)`}
                className="w-full rounded-t bg-blue-500 dark:bg-blue-400"
                style={{ height: barHeight }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {distribution.map((b) => (
          <span key={b.bin} className="flex-1 text-center text-[9px] text-neutral-400 truncate">
            {b.bin}
          </span>
        ))}
      </div>
    </div>
  );
}
