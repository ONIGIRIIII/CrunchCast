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

function parseFreeText(raw: string): Match | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, " ");
  const match = cleaned.match(/^([A-Z]{2,6})\s?([0-9][0-9A-Z]{0,5})$/);
  if (!match) return null;
  return { subject: match[1], course: match[2] };
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

  const freeTextMatch = parseFreeText(query);
  const freeTextKey = freeTextMatch ? `${freeTextMatch.subject}-${freeTextMatch.course}` : null;
  const canAdd = !atMax && freeTextMatch != null && !(freeTextKey && addedKeys.has(freeTextKey));

  function handleAdd() {
    if (!freeTextMatch) return;
    select(freeTextMatch.subject, freeTextMatch.course);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] pl-4 pr-1 py-1 focus-within:ring-2 focus-within:ring-blue-500/40 focus-within:border-blue-500 transition-colors">
        <input
          id="course-search"
          placeholder={atMax ? "Max courses reached" : "Search or type a course, e.g. CPSC 110"}
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && canAdd) handleAdd();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)} // let a click on a result register first
          className="flex-1 min-w-0 bg-transparent px-1 py-1 text-sm disabled:opacity-40 focus:outline-none"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          aria-label="Add course"
          title="Add course"
          className="shrink-0 rounded-full bg-blue-600 text-white w-7 h-7 flex items-center justify-center disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && query.trim() && (
        <ul className="absolute z-30 mt-1.5 w-full max-h-72 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-lg">
          {loading && <li className="px-3.5 py-2.5 text-sm text-[var(--color-text-subtle)]">Loading...</li>}
          {error && <li className="px-3.5 py-2.5 text-sm text-red-400">{error}</li>}
          {!loading && !error && matches.length === 0 && (
            <li className="px-3.5 py-2.5 text-sm text-[var(--color-text-subtle)]">
              No matches - hit &quot;Add course&quot; to add it directly.
            </li>
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
                  className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-[var(--color-hover-surface)] disabled:opacity-40 flex items-center justify-between"
                >
                  <span>
                    {subject} {course}
                  </span>
                  {added && <span className="text-xs text-[var(--color-text-subtle)]">Added</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
