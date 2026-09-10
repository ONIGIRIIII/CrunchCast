"use client";

import { useState } from "react";
import { ApiError, getCourseInstructors, type InstructorStats } from "@/lib/api";

export default function InstructorComparison({ subject, course }: { subject: string; course: string }) {
  const [open, setOpen] = useState(false);
  const [instructors, setInstructors] = useState<InstructorStats[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && instructors === null && !loading) {
      setLoading(true);
      setError(null);
      getCourseInstructors(subject, course)
        .then((res) => setInstructors(res.instructors))
        .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load instructor stats."))
        .finally(() => setLoading(false));
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
      <button onClick={toggle} className="text-xs font-medium text-blue-600 dark:text-blue-400">
        {open ? "Hide" : "Compare"} instructors {open ? "▴" : "▾"}
      </button>

      {open && (
        <div className="mt-2">
          {loading && <p className="text-xs text-neutral-500">Loading...</p>}
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {instructors && instructors.length === 0 && (
            <p className="text-xs text-neutral-500">No instructor data for this course.</p>
          )}

          {instructors && instructors.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="font-normal pr-3 py-1">Instructor</th>
                      <th className="font-normal pr-3 py-1">Avg</th>
                      <th className="font-normal pr-3 py-1">Fail rate</th>
                      <th className="font-normal pr-3 py-1">Std dev</th>
                      <th className="font-normal pr-3 py-1">Offerings</th>
                      <th className="font-normal py-1">Years</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instructors.map((i, idx) => (
                      <tr key={i.instructor} className="border-t border-neutral-100 dark:border-neutral-900">
                        <td className="pr-3 py-1">
                          <span className="font-medium">{i.instructor}</span>
                          {idx === 0 && (
                            <span className="ml-1.5 inline-block rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 text-[10px]">
                              Historically highest average
                            </span>
                          )}
                        </td>
                        <td className="pr-3 py-1">{i.avg}%</td>
                        <td className="pr-3 py-1">{i.fail_rate}%</td>
                        <td className="pr-3 py-1">{i.std_dev != null ? i.std_dev : "-"}</td>
                        <td className="pr-3 py-1">
                          {i.n_offerings}
                          {i.n_offerings === 1 && <span className="text-neutral-400"> (limited data)</span>}
                        </td>
                        <td className="py-1">
                          {i.first_year === i.last_year ? i.first_year : `${i.first_year}-${i.last_year}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Historical grade outcomes only, not a teaching-quality rating - things like which students
                self-select into a section, exam difficulty, and TA support all affect these numbers too.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
