import RiskGauge from "./RiskGauge";
import type { SignalValue } from "./SignalBars";

/** Per-course signal breakdown as a stacked column of small gauges (grade
 * impact, fail risk, grading unpredictability, class size), one per real
 * signal - distinct from the term-level average's horizontal bar chart
 * (SignalBars). Each gauge colors itself by its own value's severity
 * (green/yellow/red - see RiskGauge), same as every other gauge on the page. */
export default function SignalGauges({ signals }: { signals: SignalValue[] }) {
  return (
    <div className="flex flex-col gap-6">
      {signals.map((s) => (
        <div key={s.key} className="flex flex-col items-center text-center gap-2">
          <RiskGauge score={s.value} size={140} showValue />
          <p className="text-xs font-bold text-[var(--color-foreground)]">{s.label}</p>
          {s.detail && <p className="text-[10px] text-[var(--color-text-subtle)] leading-tight">{s.detail}</p>}
        </div>
      ))}
    </div>
  );
}
