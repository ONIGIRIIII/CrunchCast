"use client";

import { useState } from "react";
import type { Weights } from "@/lib/api";
import { QUIZ_QUESTIONS, computeWeights, saveWeights } from "@/lib/weights";

const LIKERT_LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: (weights: Weights) => void;
}

export default function PersonalizationQuiz({ open, onClose, onComplete }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  if (!open) return null;

  const allAnswered = QUIZ_QUESTIONS.every((q) => answers[q.id] != null);

  function submit() {
    const weights = computeWeights(answers);
    saveWeights(weights);
    onComplete(weights);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold">What does &quot;crunch&quot; mean to you?</h2>
          <button
            onClick={onClose}
            aria-label="Close quiz"
            className="rounded-full w-6 h-6 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-neutral-500 mb-5">
          8 quick questions. Your answers set how much weight your personalized score gives to
          grade impact, fail risk, grading unpredictability, and class size - all based on real
          historical data, just combined differently for you. Saved only in this browser.
        </p>

        <div className="flex flex-col gap-5">
          {QUIZ_QUESTIONS.map((q, i) => (
            <div key={q.id}>
              <p className="text-sm mb-2">
                {i + 1}. {q.text}
              </p>
              <div className="flex gap-1.5">
                {LIKERT_LABELS.map((label, value0) => {
                  const value = value0 + 1;
                  const selected = answers[q.id] === value;
                  return (
                    <button
                      key={value}
                      title={label}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
                      className={`flex-1 rounded-md border py-1.5 text-xs ${
                        selected
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                <span>{LIKERT_LABELS[0]}</span>
                <span>{LIKERT_LABELS[4]}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-6">
          <button onClick={onClose} className="text-xs text-neutral-500">
            Skip for now
          </button>
          <button
            onClick={submit}
            disabled={!allAnswered}
            className="rounded-md bg-blue-600 text-white px-5 py-2 text-sm font-medium disabled:opacity-40"
          >
            See my crunch weights
          </button>
        </div>
      </div>
    </div>
  );
}
