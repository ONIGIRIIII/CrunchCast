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

/** Horizontal bar chart of the four real signals, averaged across the term -
 * each signal's label + value sits above its own full-width, hatch-textured
 * track that fills left-to-right, colored by that signal's own 0-100
 * severity. Stacked with generous gaps so four short rows still use up the
 * full height of whatever column they share with taller sibling panels. */
export default function SignalBars({ signals }: { signals: SignalValue[] }) {
  return (
    <div className="flex flex-col gap-5 flex-1 justify-center min-h-[70px]">
      {signals.map((s) => {
        const { barClass, textClass } = bandFor(s.value);
        const widthPct = Math.max(4, Math.min(100, s.value));
        return (
          <div key={s.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-[var(--color-foreground)]">{s.label}</span>
              <span className={`text-sm font-bold ${textClass}`}>{s.value.toFixed(0)}</span>
            </div>
            <div className="relative mt-3">
              <div
                className={`absolute -top-3 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-current ${textClass}`}
                style={{ left: `${widthPct}%` }}
              />
              <div className="h-3 hatch-texture bg-[var(--color-border)]/50 overflow-hidden">
                <div className={`h-full ${barClass}`} style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
