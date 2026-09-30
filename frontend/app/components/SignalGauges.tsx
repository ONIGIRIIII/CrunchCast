import RiskGauge from "./RiskGauge";
import type { SignalValue } from "./SignalBars";

/** Per-course signal breakdown as a set of small gauges (grade impact, fail
 * risk, grading unpredictability, class size), one per real signal -
 * distinct from the term-level average's horizontal bar chart (SignalBars).
 * Each gauge colors itself by its own value's severity (green/yellow/red -
 * see RiskGauge), same as every other gauge on the page.
 *
 * Laid out against the enclosing course card's container width (see
 * TermResults): a single stacked column when the card is wide enough to put
 * these in their own 200px side column, otherwise a 2x2 (or 4-across) grid
 * above the history panel instead of one very tall strip. */
export default function SignalGauges({ signals }: { signals: SignalValue[] }) {
  return (
    <div className="grid grid-cols-2 @xl:grid-cols-4 @2xl:grid-cols-1 gap-6">
      {signals.map((s) => (
        <div key={s.key} className="min-w-0 flex flex-col items-center text-center gap-2">
          <RiskGauge score={s.value} size={140} showValue />
          <p className="text-xs font-bold text-[var(--color-foreground)]">{s.label}</p>
          {s.detail && <p className="text-[10px] text-[var(--color-text-subtle)] leading-tight">{s.detail}</p>}
        </div>
      ))}
    </div>
  );
}
