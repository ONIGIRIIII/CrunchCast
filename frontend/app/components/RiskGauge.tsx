import { gaugeRingFor } from "@/lib/scoreColor";

const SIZE = 200;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const ARC_LENGTH = Math.PI * RADIUS;

function pointOnArc(fraction: number) {
  const theta = (180 - 180 * fraction) * (Math.PI / 180);
  return {
    x: CX + RADIUS * Math.cos(theta),
    y: CY - RADIUS * Math.sin(theta),
  };
}

/** Semi-circular gauge for a 0-100 score, always colored by the same
 * strict 3-color traffic-light scale (green/yellow/red for easy/medium/
 * hard - see gaugeRingFor) so every gauge on the page means the same thing
 * at a glance, whether it's the term-level "Risk score" or one of a
 * course's four per-signal gauges. `size` scales the rendered width (the
 * internal coordinate system stays fixed); `showValue` embeds the rounded
 * score in the arc's opening, for use where there isn't already a separate
 * big-number readout beside it. */
export default function RiskGauge({
  score,
  size = 220,
  showValue = false,
}: {
  score: number;
  size?: number;
  showValue?: boolean;
}) {
  const fraction = Math.min(1, Math.max(0, score / 100));
  const ringClass = gaugeRingFor(score);
  const knob = pointOnArc(fraction);
  const arcPath = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE / 2 + STROKE}`}
      style={{ width: "100%", maxWidth: size }}
      role="img"
      aria-label={`Gauge: ${score.toFixed(0)} out of 100`}
    >
      <path d={arcPath} fill="none" className="stroke-[var(--color-border)]" strokeWidth={STROKE} strokeLinecap="round" />
      <path
        d={arcPath}
        fill="none"
        className={ringClass}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={ARC_LENGTH}
        strokeDashoffset={ARC_LENGTH * (1 - fraction)}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <circle cx={knob.x} cy={knob.y} r={STROKE / 2 + 3} className="fill-white stroke-black/10" />
      {showValue && (
        <text
          x={CX}
          y={CY - 12}
          textAnchor="middle"
          fontSize={30}
          className="fill-[var(--color-foreground)] font-black"
        >
          {score.toFixed(0)}
        </text>
      )}
    </svg>
  );
}
