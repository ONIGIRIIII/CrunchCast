"use client";

import { useId, useMemo, useState } from "react";
import { ApiError, getCourseCatalog } from "@/lib/api";

interface Match {
  subject: string;
  course: string;
}

// Real UBC course codes are always a 3-digit level, optionally followed by
// a section letter (e.g. "110", "317A") - the catalog occasionally has
// malformed 1-2 digit entries from the source data, which read as bogus
// "courses" in the dropdown (e.g. "MATH 1") and get filtered out here.
function isRealCourseCode(course: string): boolean {
  return /^\d{3}/.test(course);
}

function courseNumber(course: string): number {
  const digits = course.match(/\d+/)?.[0];
  return digits ? parseInt(digits, 10) : 0;
}

interface Props {
  onSelectCourse: (subject: string, course: string) => void;
  addedKeys: Set<string>;
  placeholder?: string;
}

function parseFreeText(raw: string): Match | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, " ");
  const match = cleaned.match(/^([A-Z]{2,6})\s?([0-9]{3}[0-9A-Z]{0,3})$/);
  if (!match) return null;
  return { subject: match[1], course: match[2] };
}

export default function CourseSearch({
  onSelectCourse,
  addedKeys,
  placeholder = "Search or type a course",
}: Props) {
  const [catalog, setCatalog] = useState<Record<string, string[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // True only right after clicking "+" with an empty search box - lets the
  // dropdown list every course from every subject instead of requiring a
  // query first. Typing anything switches back to the normal filtered
  // search automatically (the needle-based branch below takes over).
  const [browseAll, setBrowseAll] = useState(false);

  function ensureCatalogLoaded() {
    if (catalog || loading) return;
    setLoading(true);
    getCourseCatalog()
      .then((data) => setCatalog(data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load courses."))
      .finally(() => setLoading(false));
  }

  const matches: Match[] = useMemo(() => {
    if (!catalog) return [];
    const needle = query.trim().toUpperCase().replace(/\s+/g, "");
    if (!needle && !browseAll) return [];
    const results: Match[] = [];
    for (const subject of Object.keys(catalog)) {
      for (const course of catalog[subject]) {
        if (!isRealCourseCode(course)) continue;
        if (!needle || `${subject}${course}`.includes(needle)) {
          results.push({ subject, course });
        }
      }
    }
    if (!needle) {
      // Browsing all subjects at once - the loop above groups by subject
      // (each subject's own courses already ascending), so alphabetically
      // early subjects with no low-numbered offerings (e.g. AANB starting
      // at 500) would otherwise show up first. Sort the combined list by
      // course number instead, so it genuinely starts from the 100 level.
      results.sort((a, b) => courseNumber(a.course) - courseNumber(b.course) || a.subject.localeCompare(b.subject));
    }
    return results;
  }, [catalog, query, browseAll]);

  function select(subject: string, course: string) {
    onSelectCourse(subject, course);
    setQuery("");
    setOpen(false);
  }

  const freeTextMatch = parseFreeText(query);
  const freeTextKey = freeTextMatch ? `${freeTextMatch.subject}-${freeTextMatch.course}` : null;
  const alreadyAdded = freeTextKey != null && addedKeys.has(freeTextKey);
  const canAdd = freeTextMatch != null && !alreadyAdded;

  // Validation feedback for what's typed, shown in the dropdown and read out
  // to screen readers (aria-describedby + a polite live region) - so "+"
  // being disabled or Enter doing nothing never happens without a reason.
  const typed = query.trim() !== "";
  const noCatalogMatch = typed && !browseAll && catalog != null && matches.length === 0;
  const hint = !typed
    ? null
    : alreadyAdded
      ? `${freeTextMatch!.subject} ${freeTextMatch!.course} is already in your term.`
      : noCatalogMatch && freeTextMatch
        ? `No matches in the catalog - press Enter or + to add ${freeTextMatch.subject} ${freeTextMatch.course} anyway.`
        : noCatalogMatch
          ? "No matches. Course codes look like CPSC 110."
          : null;
  const invalid = noCatalogMatch && !freeTextMatch;
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  function handleAdd() {
    if (!freeTextMatch) return;
    select(freeTextMatch.subject, freeTextMatch.course);
  }

  // "+" does one of two things: adds the exact course typed, or - if the
  // box is empty - opens a browsable list of every course from every
  // subject instead of requiring a query first.
  function handleAddOrBrowse() {
    if (canAdd) {
      handleAdd();
      return;
    }
    if (!query.trim()) {
      ensureCatalogLoaded();
      setBrowseAll(true);
      setOpen(true);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] pl-4 pr-1.5 py-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-[var(--color-chart-accent)] focus-within:-outline-offset-1 transition-colors">
        {/* 16px (text-base) below sm - iOS Safari zooms the whole page in on
            focus for any input under 16px, and it stays zoomed afterward. */}
        <input
          id={inputId}
          aria-label="Search for a course to add"
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? hintId : undefined}
          placeholder={placeholder}
          value={query}
          onFocus={() => {
            ensureCatalogLoaded();
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setBrowseAll(false);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canAdd) handleAdd();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)} // let a click on a result register first
          className="flex-1 min-w-0 self-stretch bg-transparent px-1 py-1.5 text-base sm:text-sm disabled:opacity-40 focus:outline-none"
          autoComplete="off"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()} // keep the input focused so onBlur doesn't close the dropdown we're about to open
          onClick={handleAddOrBrowse}
          disabled={query.trim() !== "" && !canAdd}
          aria-label={query.trim() ? "Add course" : "Browse all courses"}
          title={query.trim() ? "Add course" : "Browse all courses"}
          className="tap-target shrink-0 bg-[var(--color-chart-accent)] text-on-chart-accent w-9 h-9 flex items-center justify-center disabled:opacity-40 hover:opacity-85 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (query.trim() || browseAll) && (
        <ul className="absolute z-30 mt-1.5 w-full max-h-72 overflow-y-auto border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]">
          {loading && <li className="px-3.5 py-2.5 text-sm text-[var(--color-text-subtle)]">Loading...</li>}
          {error && <li className="px-3.5 py-2.5 text-sm text-severity-hard">{error}</li>}
          {!loading && !error && hint && (
            <li
              id={hintId}
              aria-live="polite"
              className={`px-3.5 py-2.5 text-sm ${invalid ? "text-severity-moderate" : "text-[var(--color-text-muted)]"}`}
            >
              {hint}
            </li>
          )}
          {matches.map(({ subject, course }) => {
            const added = addedKeys.has(`${subject}-${course}`);
            return (
              <li key={`${subject}-${course}`}>
                <button
                  type="button"
                  disabled={added}
                  onMouseDown={(e) => e.preventDefault()} // keep focus so onBlur doesn't beat the click
                  onClick={() => select(subject, course)}
                  className="tap-target w-full text-left px-3.5 py-2.5 text-sm hover:bg-[var(--color-hover-surface)] disabled:opacity-40 flex items-center justify-between"
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
