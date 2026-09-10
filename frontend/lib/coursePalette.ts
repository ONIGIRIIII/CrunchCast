export interface CoursePalette {
  /** Raw hex, for SVG strokes/fills/gradients that can't use Tailwind
   * classes, and for inline-styled accents (card border, identity dot). */
  hex: string;
}

// Each course card in the per-course breakdown gets one of these, cycling
// by position - a visual identity (border/dot/history-chart color) distinct
// from the green/yellow/red severity scale used by gauges and badges, which
// stays reserved for what a score actually means rather than which course
// it belongs to.
const PALETTE: CoursePalette[] = [
  { hex: "#60a5fa" }, // blue
  { hex: "#a78bfa" }, // violet
  { hex: "#2dd4bf" }, // teal
  { hex: "#fb7185" }, // rose
  { hex: "#fbbf24" }, // amber
  { hex: "#22d3ee" }, // cyan
];

export function paletteFor(index: number): CoursePalette {
  return PALETTE[index % PALETTE.length];
}
