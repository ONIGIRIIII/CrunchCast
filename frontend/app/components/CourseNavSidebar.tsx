"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, getCourseCatalog } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectCourse: (subject: string, course: string) => void;
  addedKeys: Set<string>;
}

export default function CourseNavSidebar({ open, onClose, onSelectCourse, addedKeys }: Props) {
  const [catalog, setCatalog] = useState<Record<string, string[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (open && !catalog && !error) {
      getCourseCatalog()
        .then(setCatalog)
        .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load courses."));
    }
  }, [open, catalog, error]);

  const subjects = useMemo(() => {
    if (!catalog) return [];
    const all = Object.keys(catalog);
    if (!filter.trim()) return all;
    const needle = filter.trim().toUpperCase();
    return all.filter((s) => s.includes(needle));
  }, [catalog, filter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          {selectedSubject ? (
            <button
              onClick={() => setSelectedSubject(null)}
              className="text-sm font-medium flex items-center gap-1 text-neutral-600 dark:text-neutral-300"
            >
              ← {selectedSubject}
            </button>
          ) : (
            <h2 className="text-sm font-semibold">Browse courses</h2>
          )}
          <button
            onClick={onClose}
            aria-label="Close course browser"
            className="rounded-full w-6 h-6 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ×
          </button>
        </div>

        {error && <p className="p-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!catalog && !error && <p className="p-4 text-sm text-neutral-500">Loading subjects...</p>}

        {catalog && !selectedSubject && (
          <div className="flex flex-col overflow-hidden">
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter subjects..."
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-sm"
              />
            </div>
            <ul className="overflow-y-auto">
              {subjects.map((subject) => (
                <li key={subject}>
                  <button
                    onClick={() => setSelectedSubject(subject)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900 flex items-center justify-between"
                  >
                    <span>{subject}</span>
                    <span className="text-xs text-neutral-400">{catalog[subject].length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {catalog && selectedSubject && (
          <ul className="overflow-y-auto">
            {catalog[selectedSubject].map((course) => {
              const key = `${selectedSubject}-${course}`;
              const added = addedKeys.has(key);
              return (
                <li key={course}>
                  <button
                    onClick={() => onSelectCourse(selectedSubject, course)}
                    disabled={added}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900 flex items-center justify-between disabled:opacity-40"
                  >
                    <span>
                      {selectedSubject} {course}
                    </span>
                    {added && <span className="text-xs text-neutral-400">Added</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
