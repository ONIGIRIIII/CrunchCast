export interface ScoreBand {
  label: string;
  badgeClass: string;
  barClass: string;
}

/** Shared 0-100 severity scale used for both the difficulty badge and the
 * per-signal explanation bars, so "red" means the same thing everywhere. */
export function bandFor(score: number): ScoreBand {
  if (score >= 70) {
    return {
      label: "Hard",
      badgeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
      barClass: "bg-red-500",
    };
  }
  if (score >= 40) {
    return {
      label: "Moderate",
      badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      barClass: "bg-amber-500",
    };
  }
  return {
    label: "Easy",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    barClass: "bg-emerald-500",
  };
}
