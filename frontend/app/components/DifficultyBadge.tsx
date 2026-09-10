import { bandFor } from "@/lib/scoreColor";

export default function DifficultyBadge({ score }: { score: number }) {
  const { label, badgeClass } = bandFor(score);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
      {label} · {score.toFixed(0)}
    </span>
  );
}
