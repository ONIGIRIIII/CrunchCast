"use client";

import { useState } from "react";
import type { Weights } from "@/lib/api";
import { QUIZ_QUESTIONS, computeWeights, saveWeights } from "@/lib/weights";

const LIKERT_LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const TOTAL = QUIZ_QUESTIONS.length;

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: (weights: Weights) => void;
}

export default function PersonalizationQuiz({ open, onClose, onComplete }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);

  if (!open) return null;

  const question = QUIZ_QUESTIONS[step];
  const isLast = step === TOTAL - 1;
  const answered = answers[question.id] != null;

  // Reset the step back to the first question on the way out - whether via
  // Skip, the backdrop, the close button, or a completed submission - so
  // the quiz always starts from question 1 next time it's opened
  // (previous answers are kept, so retaking feels like editing, not
  // starting over).
  function close() {
    setStep(0);
    onClose();
  }

  function submit() {
    const weights = computeWeights(answers);
    saveWeights(weights);
    setStep(0);
    onComplete(weights);
  }

  function next() {
    if (isLast) {
      submit();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative w-full max-w-xl bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] p-7 sm:p-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold">What does &quot;crunch&quot; mean to you?</h2>
          <button
            onClick={close}
            aria-label="Close quiz"
            className="w-7 h-7 flex items-center justify-center text-sm text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)]"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-subtle)] mb-5 leading-relaxed">
          Your answers set how much weight your personalized score gives to grade impact, fail risk,
          grading unpredictability, and class size - all based on real historical data, just combined
          differently for you. Saved only in this browser.
        </p>

        <div className="flex items-center justify-between text-xs text-[var(--color-text-subtle)] mb-1.5">
          <span>
            Question {step + 1} of {TOTAL}
          </span>
        </div>
        <div className="h-1.5 w-full bg-[var(--color-border)] overflow-hidden mb-6">
          <div
            className="h-full bg-[var(--color-chart-accent)] transition-all"
            style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
          />
        </div>

        <div key={question.id}>
          <p className="text-base mb-4">{question.text}</p>
          <div className="flex gap-2">
            {LIKERT_LABELS.map((label, value0) => {
              const value = value0 + 1;
              const selected = answers[question.id] === value;
              return (
                <button
                  key={value}
                  title={label}
                  onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: value }))}
                  className={`flex-1 border py-2.5 text-xs font-bold transition-colors ${
                    selected
                      ? "bg-[var(--color-chart-accent)] border-[var(--color-chart-accent)] text-white"
                      : "border-[var(--color-border-strong)] hover:bg-[var(--color-hover-surface)]"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1.5">
            <span>{LIKERT_LABELS[0]}</span>
            <span>{LIKERT_LABELS[4]}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-7">
          {step === 0 ? (
            <button onClick={close} className="text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)]">
              Skip for now
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)]"
            >
              ← Back
            </button>
          )}
          <button
            onClick={next}
            disabled={!answered}
            className="bg-[var(--color-chart-accent)] text-white px-5 py-2.5 text-sm font-bold disabled:opacity-40 hover:opacity-85 transition-opacity"
          >
            {isLast ? "See my crunch weights" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
