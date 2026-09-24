import type { CourseInput, PredictResponse } from "./api";

export const STORAGE_KEY = "crunchcast-draft-term";

/** The term currently being built - courses plus the last prediction for
 * them (null once courses change and haven't been re-predicted yet). Kept
 * as one pair so the dashboard can tell, on load, whether it has a result
 * to show immediately, a draft to predict, or nothing at all. */
export interface DraftTerm {
  courses: CourseInput[];
  result: PredictResponse | null;
}

export function saveDraftTerm(draft: DraftTerm) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // localStorage unavailable (private mode, etc) - draft just won't persist
  }
}

export function loadDraftTerm(): DraftTerm | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DraftTerm) : null;
  } catch {
    return null;
  }
}

export function clearDraftTerm() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
