export type Session = "S" | "W";

export interface CourseInput {
  subject: string;
  course: string;
  session: Session;
}

export type Confidence = "high" | "medium" | "low" | "very_low";

export interface CoursePrediction {
  subject: string;
  course: string;
  difficulty_score: number;
  confidence: Confidence;
  historical_offerings_count: number;
  credits: number;
}

export interface PredictResponse {
  term_difficulty_score: number;
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {}

export async function predictTerm(courses: CourseInput[]): Promise<PredictResponse> {
  const response = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courses }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail =
      typeof body?.detail === "string" ? body.detail : `Request failed (${response.status})`;
    throw new ApiError(detail);
  }

  return response.json();
}
