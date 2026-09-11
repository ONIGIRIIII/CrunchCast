import { bandFor } from "@/lib/scoreColor";

export interface SignalValue {
  key: string;
  label: string;
  value: number;
  /** Plain-English number behind the score, e.g. "12% of students
   * historically fail" - used by the per-course signal gauges
   * (SignalGauges), not rendered by this bar chart. */
  detail?: string;
}

/** Horizontal bar chart of the four real signals, averaged across the
 * term - each row is a label above a full-width, hatch-textured track
 * with a colored fill (left to right) sized and colored by that signal's
 * own 0-100 severity. All bars share the same left edge, so - unlike a
 * column chart - there's no risk of rows misaligning from wrapped labels. */
export default function SignalBars({ signals }: { signals: SignalValue[] }) {
  return (
    <div className="flex flex-col gap-4">
      {signals.map((s) => {
        const { barClass } = bandFor(s.value);
        const widthPct = Math.max(4, Math.min(100, s.value));
        return (
          <div key={s.key}>
            <div className="flex items-baseline justify-between text-xs mb-1.5">
              <span className="font-bold text-[var(--color-foreground)]">{s.label}</span>
              <span className="text-[var(--color-text-subtle)]">{s.value.toFixed(0)}</span>
            </div>
            <div className="relative w-full h-3 rounded-full hatch-texture bg-[var(--color-border)]/50">
              <div className={`h-full rounded-full ${barClass}`} style={{ width: `${widthPct}%` }} />
              {/* Knob at the fill's end, matching the gauges' end-of-arc dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border border-black/10"
                style={{ left: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
