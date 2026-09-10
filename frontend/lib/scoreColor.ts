export interface ScoreBand {
  label: string;
  badgeClass: string;
  barClass: string;
  /** Vivid gradient for the hero readout card - the one place the severity
   * color gets to be loud rather than a small accent. */
  heroClass: string;
  /** SVG stroke color for the risk gauge's active arc. */
  ringClass: string;
  /** Small solid dot used next to stat-tile labels in the bento grid. */
  dotClass: string;
  /** Muted text tone that reads well on the vivid hero gradient. */
  heroMutedClass: string;
}

/** Shared 0-100 severity scale used everywhere a score needs a color - the
 * difficulty badge, explanation bars, the hero gradient card, the risk
 * gauge, and stat-tile dots - so a given color always means the same band
 * across the whole dashboard. Dark-theme only (see globals.css). */
export function bandFor(score: number): ScoreBand {
  if (score >= 70) {
    return {
      label: "Hard",
      badgeClass: "bg-red-500/15 text-red-400",
      barClass: "bg-red-500",
      heroClass: "bg-gradient-to-br from-red-600 via-red-600 to-rose-800",
      ringClass: "stroke-red-500",
      dotClass: "bg-red-500",
      heroMutedClass: "text-red-100/70",
    };
  }
  if (score >= 40) {
    return {
      label: "Moderate",
      badgeClass: "bg-amber-500/15 text-amber-400",
      barClass: "bg-amber-500",
      heroClass: "bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700",
      ringClass: "stroke-amber-500",
      dotClass: "bg-amber-500",
      heroMutedClass: "text-orange-100/70",
    };
  }
  return {
    label: "Easy",
    badgeClass: "bg-emerald-500/15 text-emerald-400",
    barClass: "bg-emerald-500",
    heroClass: "bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-800",
    ringClass: "stroke-emerald-500",
    dotClass: "bg-emerald-500",
    heroMutedClass: "text-emerald-100/70",
  };
}

/** Strict 3-color traffic-light scale (green/yellow/red for easy/medium/
 * hard) used specifically for gauge arcs - simpler and more literal than
 * bandFor's badge/hero palette (emerald/amber/red), which stays as-is for
 * everything else. */
export function gaugeRingFor(score: number): string {
  if (score >= 70) return "stroke-red-500";
  if (score >= 40) return "stroke-yellow-500";
  return "stroke-green-500";
}
