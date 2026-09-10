import type { Weights } from "./api";

export const STORAGE_KEY = "crunchcast-weights";

export type Dimension = "grade" | "failrisk" | "variance" | "classsize";

export interface QuizQuestion {
  id: string;
  dimension: Dimension;
  text: string;
}

// Two questions per dimension - averaging a pair is more reliable than one
// question per dimension, even though there are only 4 real underlying
// signals to weight (see model/predict.py's WEIGHT_TO_COMPONENT).
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: "q1", dimension: "grade", text: "A lower grade in this course would really bother me, even if I still passed comfortably." },
  { id: "q2", dimension: "grade", text: "Keeping my GPA high matters a lot to me when choosing courses." },
  { id: "q3", dimension: "failrisk", text: "The chance of failing or needing to retake a course worries me a lot." },
  { id: "q4", dimension: "failrisk", text: "I'd actively avoid a course known for a high fail rate." },
  { id: "q5", dimension: "variance", text: "I get uneasy when grading feels unpredictable or inconsistent between sections." },
  { id: "q6", dimension: "variance", text: "I'd rather have steady, predictable grading than a class with a big curve/spread." },
  { id: "q7", dimension: "classsize", text: "I prefer smaller classes where I might get more individual attention." },
  { id: "q8", dimension: "classsize", text: "Large, crowded courses stress me out more than small ones." },
];

const DIMENSIONS: Dimension[] = ["grade", "failrisk", "variance", "classsize"];

/** answers: question id -> 1-5 Likert value. Averages the pair per
 * dimension, then normalizes across dimensions so they sum to 1 - only
 * relative emphasis between dimensions matters, not absolute intensity. */
export function computeWeights(answers: Record<string, number>): Weights {
  const dimensionAverages: Record<Dimension, number> = { grade: 0, failrisk: 0, variance: 0, classsize: 0 };
  for (const dim of DIMENSIONS) {
    const questions = QUIZ_QUESTIONS.filter((q) => q.dimension === dim);
    const sum = questions.reduce((acc, q) => acc + (answers[q.id] ?? 3), 0);
    dimensionAverages[dim] = sum / questions.length;
  }
  const total = DIMENSIONS.reduce((acc, dim) => acc + dimensionAverages[dim], 0);
  return {
    grade: dimensionAverages.grade / total,
    failrisk: dimensionAverages.failrisk / total,
    variance: dimensionAverages.variance / total,
    classsize: dimensionAverages.classsize / total,
  };
}

export function saveWeights(weights: Weights) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
  } catch {
    // localStorage unavailable (private mode, etc) - personalization just won't persist
  }
}

export function loadWeights(): Weights | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Weights) : null;
  } catch {
    return null;
  }
}

export function clearWeights() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
