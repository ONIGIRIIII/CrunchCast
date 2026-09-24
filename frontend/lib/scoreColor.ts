export interface ScoreBand {
  label: string;
  /** Text-only severity color - bracket tags, dots, chart accents. Never a
   * fill or background. */
  textClass: string;
  /** Fill class for the one legitimate severity fill left: SignalBars' bar
   * chart column. That's chart data-ink, not decorative chrome. */
  barClass: string;
  /** SVG stroke color for the risk gauge's active arc. */
  ringClass: string;
  /** Small square indicator color (ticker status dot, etc). */
  dotClass: string;
}

/** Shared 0-100 severity scale used everywhere a score needs a color - the
 * difficulty badge, explanation bars, the risk gauge, and status dots - so a
 * given color always means the same band across the whole app. Colors are
 * muted "ANSI terminal" accents (see globals.css --severity-*), used only as
 * text/line/small-indicator accents, never as fills or gradients. */
export function bandFor(score: number): ScoreBand {
  if (score >= 70) {
    return {
      label: "Hard",
      textClass: "text-severity-hard",
      barClass: "bg-severity-hard",
      ringClass: "stroke-[var(--color-severity-hard)]",
      dotClass: "bg-severity-hard",
    };
  }
  if (score >= 40) {
    return {
      label: "Moderate",
      textClass: "text-severity-moderate",
      barClass: "bg-severity-moderate",
      ringClass: "stroke-[var(--color-severity-moderate)]",
      dotClass: "bg-severity-moderate",
    };
  }
  return {
    label: "Easy",
    textClass: "text-severity-easy",
    barClass: "bg-severity-easy",
    ringClass: "stroke-[var(--color-severity-easy)]",
    dotClass: "bg-severity-easy",
  };
}

/** Same 3-band scale as bandFor, returned as a gauge-arc stroke class -
 * kept as its own function since the risk gauge only ever needs the stroke,
 * not the rest of the ScoreBand shape. */
export function gaugeRingFor(score: number): string {
  if (score >= 70) return "stroke-[var(--color-severity-hard)]";
  if (score >= 40) return "stroke-[var(--color-severity-moderate)]";
  return "stroke-[var(--color-severity-easy)]";
}
