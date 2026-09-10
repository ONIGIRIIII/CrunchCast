import type { CourseInput } from "./api";

export interface SavedCollection {
  id: string;
  name: string;
  courses: CourseInput[];
  createdAt: number;
}

const STORAGE_KEY = "crunchcast-saved-collections";

/** Named, saved sets of courses - the "save this term plan" equivalent of
 * a saved chat, listed in a left sidebar so a student can flip between a
 * few different course combinations they're considering. Stored only in
 * this browser (localStorage), same as lib/weights.ts's personalization. */
export function loadCollections(): SavedCollection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedCollection[]) : [];
  } catch {
    return [];
  }
}

function persist(collections: SavedCollection[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  } catch {
    // localStorage unavailable (private mode, etc) - saving just won't persist
  }
}

export function saveCollection(name: string, courses: CourseInput[]): SavedCollection[] {
  const entry: SavedCollection = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    courses,
    createdAt: Date.now(),
  };
  const next = [entry, ...loadCollections()];
  persist(next);
  return next;
}

export function deleteCollection(id: string): SavedCollection[] {
  const next = loadCollections().filter((c) => c.id !== id);
  persist(next);
  return next;
}
