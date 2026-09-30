"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useRevealOnce } from "@/lib/useRevealOnce";

// Landing page "Under the hood" - the three parts of how a score is made,
// each with a small visual built from the real numbers in the README /
// data/README.md: the two data windows (PAIR 1996S-2016W trains the model,
// 2017W-2025W is display-only), the test error against the lookup baseline
// (MAE 16.00 vs 16.38), and personalization re-weighting the four signals
// (equal by default - model/predict.py's DEFAULT_WEIGHTS). The weights the
// third card shifts to are an example, and labelled as one.

type StepKey = "data" | "model" | "weights";

const STEPS: { key: StepKey; title: string; tag: string; caption: string; detail: string }[] = [
  {
    key: "data",
    title: "The data",
    tag: "data window",
    caption: "42 terms train the model",
    detail:
      "The model only learns from UBC's PAIR grade reports, 1996 to 2016W. The source says its data from 2017W on was altered, so the model never sees it. Newer terms, up to 2025W, only show up in the history browser.",
  },
  {
    key: "model",
    title: "The model",
    tag: "test error (MAE)",
    caption: "lower is better",
    detail:
      "XGBoost, trained on terms up to 2013W and tested on 2014W to 2016W, so it's always scored on terms it hasn't seen. It beats a simple lookup of each course's own history by 2.3% on average error. That's a small gain, because a course's past grades already explain most of its score.",
  },
  {
    key: "weights",
    title: "Personalization",
    tag: "signal weights",
    caption: "example quiz result",
    detail:
      "There's no second model. By default the four signals count equally. Your quiz answers change how much each one counts, and the app recombines them with simple arithmetic when you ask for a score.",
  },
];

type VisualProps = { shown: boolean };

const VISUALS: Record<StepKey, ComponentType<VisualProps>> = {
  data: DataWindowVisual,
  model: ModelErrorVisual,
  weights: WeightsVisual,
};

export default function MethodCards() {
  return (
    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {STEPS.map((step, index) => (
        <MethodCard key={step.key} step={step} index={index} />
      ))}
    </div>
  );
}

function MethodCard({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const [ref, shown] = useRevealOnce<HTMLElement>();
  const Visual = VISUALS[step.key];
  const delay = index * 120;
  return (
    <article
      ref={ref}
      className={`flex flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:border-[var(--color-border-strong)] transition-[opacity,translate,border-color] duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 md:last:col-span-2 lg:last:col-span-1 ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${delay}ms, ${delay}ms, 0ms` }}
    >
      <div className="relative h-48 border-b border-[var(--color-border)] bg-[var(--color-background)]/40">
        <p className="landing-mono absolute top-3 left-4 text-[11px] text-[var(--color-text-subtle)]">{step.tag}</p>
        <Visual shown={shown} />
        <p className="landing-mono absolute bottom-3 right-4 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">
          {step.caption}
        </p>
      </div>
      <div className="flex flex-col gap-2 p-6">
        <div className="flex items-baseline gap-3">
          <span className="landing-mono text-xs font-bold" style={{ color: "var(--color-chart-accent)" }}>
            0{index + 1}
          </span>
          <h3 className="font-bold text-base">{step.title}</h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{step.detail}</p>
      </div>
    </article>
  );
}

// ---- Visuals ---------------------------------------------------------------

// 1996S -> 2016W is 21 of the 30 years shown (1996 through 2025W).
const TRAIN_SHARE = 70;

/** 1996-2025 timeline: the PAIR training window grows in solid, then the
 * display-only 2017W+ stretch appears hatched beside it. */
function DataWindowVisual({ shown }: VisualProps) {
  return (
    <div className="absolute inset-x-6 top-10 bottom-10 flex flex-col justify-center gap-2">
      <div className="landing-mono relative h-4 text-[10px]">
        <span className="absolute left-0 font-bold" style={{ color: "var(--color-chart-accent)" }}>
          trains the model
        </span>
        <span
          className="absolute right-0 text-[var(--color-text-subtle)] transition-opacity duration-500 motion-reduce:transition-none"
          style={{ opacity: shown ? 1 : 0, transitionDelay: "1100ms" }}
        >
          display only
        </span>
      </div>
      <div className="flex h-4 w-full gap-0.5">
        <div className="h-full" style={{ width: `${TRAIN_SHARE}%` }}>
          <div
            className="h-full origin-left bg-[var(--color-chart-accent)] transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] delay-200 motion-reduce:transition-none"
            style={{ transform: shown ? "scaleX(1)" : "scaleX(0)" }}
          />
        </div>
        <div
          className="h-full flex-1 border border-dashed border-[var(--color-border-strong)] hatch-texture transition-opacity duration-500 motion-reduce:transition-none"
          style={{ opacity: shown ? 1 : 0, transitionDelay: "1000ms" }}
        />
      </div>
      <div className="landing-mono relative h-4 text-[10px] text-[var(--color-text-subtle)]">
        <span className="absolute left-0">1996</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${TRAIN_SHARE}%` }}>
          2016W
        </span>
        <span className="absolute right-0">2025W</span>
      </div>
    </div>
  );
}

// README results table. Bars run 0-20 so the real (small) gap stays to scale.
const MAE_ROWS: { label: string; mae: number; accent: boolean }[] = [
  { label: "history lookup", mae: 16.38, accent: false },
  { label: "XGBoost", mae: 16.0, accent: true },
];
const MAE_SCALE = 20;

/** The shipped model's test error against the no-ML baseline, drawn to
 * scale - the gap is small on purpose, because it is small. */
function ModelErrorVisual({ shown }: VisualProps) {
  return (
    <div className="absolute inset-x-6 top-10 bottom-10 flex flex-col justify-center gap-4">
      {MAE_ROWS.map(({ label, mae, accent }, i) => (
        <div key={label} className="flex flex-col gap-1.5">
          <div className="landing-mono flex items-baseline justify-between text-[10px]">
            <span className={accent ? "font-bold text-[var(--color-foreground)]" : "text-[var(--color-text-subtle)]"}>{label}</span>
            <span className={`font-bold ${accent ? "" : "text-[var(--color-text-subtle)]"}`} style={accent ? { color: "var(--color-chart-accent)" } : undefined}>
              {mae.toFixed(2)}
            </span>
          </div>
          <div className="h-2.5 w-full bg-[var(--color-border)]/50 hatch-texture">
            <div
              className={`h-full origin-left transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                accent ? "bg-[var(--color-chart-accent)]" : "bg-[var(--color-text-subtle)]"
              }`}
              style={{
                width: `${(mae / MAE_SCALE) * 100}%`,
                transform: shown ? "scaleX(1)" : "scaleX(0)",
                transitionDelay: `${200 + i * 250}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Equal by default (DEFAULT_WEIGHTS), then an example of what a quiz might
// produce. Bars run 0-50% so the default sits at the halfway mark.
const WEIGHT_ROWS: { label: string; example: number }[] = [
  { label: "grade", example: 40 },
  { label: "fail rate", example: 30 },
  { label: "spread", example: 20 },
  { label: "class size", example: 10 },
];
const DEFAULT_WEIGHT = 25;

/** Four signal weights filling in equal (the default), then shifting to an
 * example quiz result - the "re-weighting, not a new model" idea. */
function WeightsVisual({ shown }: VisualProps) {
  // 0 = hidden, 1 = default equal weights, 2 = example quiz weights
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!shown) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = reduced
      ? [setTimeout(() => setPhase(2), 0)]
      : [setTimeout(() => setPhase(1), 250), setTimeout(() => setPhase(2), 1700)];
    return () => timers.forEach(clearTimeout);
  }, [shown]);

  return (
    <div className="absolute inset-x-6 top-10 bottom-10 grid grid-cols-[4.5rem_1fr_2.25rem] content-center items-center gap-x-2 gap-y-2.5">
      {WEIGHT_ROWS.map(({ label, example }) => {
        const weight = phase === 2 ? example : phase === 1 ? DEFAULT_WEIGHT : 0;
        return (
          <div key={label} className="contents">
            <span className="landing-mono truncate text-[10px] text-[var(--color-text-subtle)]">{label}</span>
            <div className="h-2 bg-[var(--color-border)]/50 hatch-texture">
              <div
                className="h-full bg-[var(--color-text-muted)] transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                style={{ width: `${(weight / 50) * 100}%` }}
              />
            </div>
            <span className="landing-mono text-right text-[10px] font-bold tabular-nums">{phase === 0 ? "" : `${weight}%`}</span>
          </div>
        );
      })}
    </div>
  );
}
