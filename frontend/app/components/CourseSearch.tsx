"use client";

import { useMemo, useState } from "react";
import { ApiError, getCourseCatalog } from "@/lib/api";

const MAX_RESULTS = 8;

interface Match {
  subject: string;
  course: string;
}

interface Props {
  onSelectCourse: (subject: string, course: string) => void;
  addedKeys: Set<string>;
  atMax: boolean;
}

export default function CourseSearch({ onSelectCourse, addedKeys, atMax }: Props) {
  const [catalog, setCatalog] = useState<Record<string, string[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  function ensureCatalogLoaded() {
    if (catalog || loading) return;
    setLoading(true);
    getCourseCatalog()
      .then((subjects) => setCatalog(subjects))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load courses."))
      .finally(() => setLoading(false));
  }

  const matches: Match[] = useMemo(() => {
    if (!catalog) return [];
    const needle = query.trim().toUpperCase().replace(/\s+/g, "");
    if (!needle) return [];
    const results: Match[] = [];
    for (const subject of Object.keys(catalog)) {
      for (const course of catalog[subject]) {
        if (`${subject}${course}`.includes(needle)) {
          results.push({ subject, course });
          if (results.length >= MAX_RESULTS) return results;
        }
      }
    }
    return results;
  }, [catalog, query]);

  function select(subject: string, course: string) {
    onSelectCourse(subject, course);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative mb-4">
      <label className="block text-xs text-neutral-500 mb-1" htmlFor="course-search">
        Search courses
      </label>
      <input
        id="course-search"
        placeholder={atMax ? "Max courses reached" : "e.g. CPSC or CPSC 110"}
        value={query}
        disabled={atMax}
        onFocus={() => {
          ensureCatalogLoaded();
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} // let a click on a result register first
        className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-sm disabled:opacity-40"
        autoComplete="off"
      />

      {open && query.trim() && (
        <ul className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-neutral-500">Loading...</li>}
          {error && <li className="px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</li>}
          {!loading && !error && matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-500">No matches - try the fields below.</li>
          )}
          {matches.map(({ subject, course }) => {
            const added = addedKeys.has(`${subject}-${course}`);
            return (
              <li key={`${subject}-${course}`}>
                <button
                  type="button"
                  disabled={added || atMax}
                  onMouseDown={(e) => e.preventDefault()} // keep focus so onBlur doesn't beat the click
                  onClick={() => select(subject, course)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-40 flex items-center justify-between"
                >
                  <span>
                    {subject} {course}
                  </span>
                  {added && <span className="text-xs text-neutral-400">Added</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
