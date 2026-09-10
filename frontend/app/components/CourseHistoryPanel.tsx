"use client";

import { useMemo, useState } from "react";
import { ApiError, getCourseHistory, type CourseTermStats } from "@/lib/api";

function termKey(t: CourseTermStats) {
  return `${t.year}${t.session}`;
}

function termLabel(t: CourseTermStats) {
  return `${t.year}${t.session} (${t.session_label})`;
}

export default function CourseHistoryPanel({ subject, course }: { subject: string; course: string }) {
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<CourseTermStats[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && terms === null && !loading) {
      setLoading(true);
      setError(null);
      getCourseHistory(subject, course)
        .then((res) => {
          setTerms(res.terms);
          if (res.terms.length > 0) setSelectedKey(termKey(res.terms[0]));
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load history."))
        .finally(() => setLoading(false));
    }
  }

  const selected = useMemo(
    () => terms?.find((t) => termKey(t) === selectedKey) ?? null,
    [terms, selectedKey]
  );

  return (
    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
      <button
        onClick={toggle}
        className="text-xs font-medium text-blue-600 dark:text-blue-400"
      >
        {open ? "Hide" : "View"} by term {open ? "▴" : "▾"}
      </button>

      {open && (
        <div className="mt-2">
          {loading && <p className="text-xs text-neutral-500">Loading...</p>}
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {terms && terms.length === 0 && (
            <p className="text-xs text-neutral-500">No term-by-term data for this course.</p>
          )}

          {terms && terms.length > 0 && (
            <>
              <select
                value={selectedKey ?? ""}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-xs"
              >
                {terms.map((t) => (
                  <option key={termKey(t)} value={termKey(t)}>
                    {termLabel(t)}
                  </option>
                ))}
              </select>

              {selected && !selected.available && (
                <p className="mt-2 text-xs text-neutral-500">
                  Not reported for this term (likely privacy-suppressed - too few students).
                </p>
              )}

              {selected && selected.available && (
                <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-2 text-xs sm:grid-cols-6">
                  <div>
                    <dt className="text-neutral-500">Average</dt>
                    <dd className="font-medium">{selected.avg}%</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Std dev</dt>
                    <dd className="font-medium">
                      {selected.std_dev != null ? selected.std_dev : "not reported"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">High</dt>
                    <dd className="font-medium">{selected.high}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Low</dt>
                    <dd className="font-medium">{selected.low}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Fail rate</dt>
                    <dd className="font-medium">{selected.fail_rate}%</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Enrolled</dt>
                    <dd className="font-medium">{selected.enrolled}</dd>
                  </div>
                </dl>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
