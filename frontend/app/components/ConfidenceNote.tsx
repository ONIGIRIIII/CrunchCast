import type { Confidence } from "@/lib/api";

const LABELS: Record<Confidence, string> = {
  high: "Based on plenty of historical offerings",
  medium: "Based on a handful of historical offerings",
  low: "Subject seen before, but this exact course wasn't in the historical data",
  very_low: "No matching historical data - this score is just the overall average",
};

export default function ConfidenceNote({ confidence }: { confidence: Confidence }) {
  return <p className="text-xs text-[var(--color-text-subtle)]">{LABELS[confidence]}</p>;
}
