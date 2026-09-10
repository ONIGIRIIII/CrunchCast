import type { ExplanationComponent } from "@/lib/api";
import { bandFor } from "@/lib/scoreColor";

export default function ExplanationChart({ explanation }: { explanation: ExplanationComponent[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {explanation.map((item) => {
        const { barClass } = bandFor(item.score);
        return (
          <div key={item.key}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{item.label}</span>
              <span className="text-neutral-400">{item.score.toFixed(0)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${barClass}`}
                style={{ width: `${Math.min(100, Math.max(0, item.score))}%` }}
              />
            </div>
            <p className="text-xs text-neutral-500 mt-1">{item.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
