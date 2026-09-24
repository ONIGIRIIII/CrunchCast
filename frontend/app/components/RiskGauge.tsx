import { bandFor, gaugeRingFor } from "@/lib/scoreColor";

const SIZE = 200;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const ARC_LENGTH = Math.PI * RADIUS;

// The value-marker arrow sits just outside the arc's stroke, pointing back
// in at it - pad the viewBox by its full reach so it never gets clipped.
const ARROW_GAP = 6;
const ARROW_LENGTH = 10;
const ARROW_HALF_WIDTH = 6;
const PAD = STROKE / 2 + ARROW_GAP + ARROW_LENGTH;

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
  const { textClass } = bandFor(score);
  const arcPath = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`;

  // Outward unit vector at the arc point for the current score, plus its
  // perpendicular (tangent) - used to build the marker arrow entirely from
  // vector math rather than an SVG rotate() transform, so it points the
  // right way at every angle without any angle-convention guesswork.
  const theta = (180 - 180 * fraction) * (Math.PI / 180);
  const ux = Math.cos(theta);
  const uy = -Math.sin(theta);
  const px = -uy;
  const py = ux;

  const tipR = RADIUS + STROKE / 2 + ARROW_GAP;
  const baseR = tipR + ARROW_LENGTH;
  const tip = { x: CX + ux * tipR, y: CY + uy * tipR };
  const base = { x: CX + ux * baseR, y: CY + uy * baseR };
  const base1 = { x: base.x + px * ARROW_HALF_WIDTH, y: base.y + py * ARROW_HALF_WIDTH };
  const base2 = { x: base.x - px * ARROW_HALF_WIDTH, y: base.y - py * ARROW_HALF_WIDTH };
  const arrowPoints = `${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`;

  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${SIZE + PAD * 2} ${SIZE / 2 + STROKE + PAD}`}
      style={{ width: "100%", maxWidth: size }}
      role="img"
      aria-label={`Gauge: ${score.toFixed(0)} out of 100`}
    >
      <path d={arcPath} fill="none" className="stroke-[var(--color-border)]" strokeWidth={STROKE} strokeLinecap="butt" />
      <path
        d={arcPath}
        fill="none"
        className={ringClass}
        strokeWidth={STROKE}
        strokeLinecap="butt"
        strokeDasharray={ARC_LENGTH}
        strokeDashoffset={ARC_LENGTH * (1 - fraction)}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <polygon points={arrowPoints} className={`fill-current ${textClass}`} />
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
