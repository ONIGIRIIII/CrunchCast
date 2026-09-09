function bandFor(score: number): { label: string; className: string } {
  if (score >= 70) return { label: "Hard", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" };
  if (score >= 40) return { label: "Moderate", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" };
  return { label: "Easy", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" };
}

export default function DifficultyBadge({ score }: { score: number }) {
  const { label, className } = bandFor(score);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label} · {score.toFixed(0)}
    </span>
  );
}
