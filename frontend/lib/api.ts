export type Session = "S" | "W";

export interface CourseInput {
  subject: string;
  course: string;
  session: Session;
}

export type Confidence = "high" | "medium" | "low" | "very_low";

export interface Weights {
  grade: number;
  failrisk: number;
  variance: number;
  classsize: number;
}

export type ExplanationKey = "grade" | "failrisk" | "variance" | "classsize";

export interface ExplanationComponent {
  key: ExplanationKey;
  label: string;
  score: number;
  detail: string;
}

export interface CoursePrediction {
  subject: string;
  course: string;
  difficulty_score: number;
  personalized_score: number | null;
  confidence: Confidence;
  historical_offerings_count: number;
  credits: number;
  explanation: ExplanationComponent[];
}

export interface PredictResponse {
  term_difficulty_score: number;
  term_personalized_score: number | null;
  total_credits: number;
  n_courses: number;
  n_high_difficulty_courses: number;
  hardest_course: {
    subject: string;
    course: string;
    difficulty_score: number;
  };
  low_confidence_courses: string[];
  courses: CoursePrediction[];
}

export interface GradeBin {
  bin: string;
  count: number;
}

export interface InstructorTermStats {
  instructor: string;
  sections: string[];
  avg: number;
  std_dev: number | null;
  fail_rate: number;
  enrolled: number;
}

export interface CourseTermStats {
  year: number;
  session: Session;
  session_label: string;
  available: boolean;
  enrolled: number | null;
  avg: number | null;
  std_dev: number | null;
  high: number | null;
  low: number | null;
  fail_rate: number | null;
  instructors: string[];
  distribution: GradeBin[] | null;
  instructor_stats: InstructorTermStats[];
  best_instructor: string | null;
  source: "pair" | "tableau_v1" | "tableau_v2";
}

export interface CourseHistoryResponse {
  subject: string;
  course: string;
  terms: CourseTermStats[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {}

export async function getCourseCatalog(): Promise<Record<string, string[]>> {
  const response = await fetch(`${API_URL}/courses`);
  if (!response.ok) {
    throw new ApiError(`Failed to load course catalog (${response.status})`);
  }
  const body: { subjects: Record<string, string[]> } = await response.json();
  return body.subjects;
}

export async function getCourseHistory(subject: string, course: string): Promise<CourseHistoryResponse> {
  const response = await fetch(
    `${API_URL}/courses/${encodeURIComponent(subject)}/${encodeURIComponent(course)}/history`
  );
  if (!response.ok) {
    throw new ApiError(`Failed to load course history (${response.status})`);
  }
  return response.json();
}

export async function predictTerm(
  courses: CourseInput[],
  weights?: Weights | null
): Promise<PredictResponse> {
  const response = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(weights ? { courses, weights } : { courses }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail =
      typeof body?.detail === "string" ? body.detail : `Request failed (${response.status})`;
    throw new ApiError(detail);
  }

  return response.json();
}
