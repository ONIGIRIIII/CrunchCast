import { bandFor } from "@/lib/scoreColor";

/** `showScore` defaults to true; pass false when the score is already
 * displayed right next to the badge (e.g. the hero "Your crunch score"
 * number), so the badge doesn't repeat it. */
export default function DifficultyBadge({ score, showScore = true }: { score: number; showScore?: boolean }) {
  const { label, textClass } = bandFor(score);
  return (
    <span className={`font-bold text-xs uppercase tracking-wide ${textClass}`}>
      {showScore ? `[${label.toUpperCase()} · ${score.toFixed(0)}]` : `[${label.toUpperCase()}]`}
    </span>
  );
}
