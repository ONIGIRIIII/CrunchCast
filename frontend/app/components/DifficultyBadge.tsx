import { bandFor } from "@/lib/scoreColor";

/** `showScore` defaults to true; pass false when the score is already
 * displayed right next to the badge (e.g. the hero "Your crunch score"
 * number), so the badge doesn't repeat it. */
export default function DifficultyBadge({ score, showScore = true }: { score: number; showScore?: boolean }) {
  const { label, badgeClass } = bandFor(score);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${badgeClass}`}>
      {showScore ? `${label} · ${score.toFixed(0)}` : label}
    </span>
  );
}
