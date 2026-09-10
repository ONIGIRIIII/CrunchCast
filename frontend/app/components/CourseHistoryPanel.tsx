"use client";

import { useMemo, useState } from "react";
import { ApiError, getCourseHistory, type CourseTermStats, type InstructorTermStats } from "@/lib/api";
import GradeDistributionChart from "./GradeDistributionChart";

const OVERALL = "__overall__";

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
  const [selectedTermKey, setSelectedTermKey] = useState<string | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<string>(OVERALL);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && terms === null && !loading) {
      setLoading(true);
      setError(null);
      getCourseHistory(subject, course)
        .then((res) => {
          setTerms(res.terms);
          if (res.terms.length > 0) setSelectedTermKey(termKey(res.terms[0]));
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load history."))
        .finally(() => setLoading(false));
    }
  }

  const selectedTerm = useMemo(
    () => terms?.find((t) => termKey(t) === selectedTermKey) ?? null,
    [terms, selectedTermKey]
  );

  function selectTerm(key: string) {
    setSelectedTermKey(key);
    setSelectedInstructor(OVERALL); // switching terms resets the instructor picker back to "Overall"
  }

  const selectedInstructorStats: InstructorTermStats | null =
    selectedTerm?.instructor_stats.find((s) => s.instructor === selectedInstructor) ?? null;

  return (
    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
      <button onClick={toggle} className="text-xs font-medium text-blue-600 dark:text-blue-400">
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
              <div className="flex flex-wrap gap-2">
                <select
                  value={selectedTermKey ?? ""}
                  onChange={(e) => selectTerm(e.target.value)}
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-xs"
                >
                  {terms.map((t) => (
                    <option key={termKey(t)} value={termKey(t)}>
                      {termLabel(t)}
                    </option>
                  ))}
                </select>

                {selectedTerm && selectedTerm.instructor_stats.length > 0 && (
                  <select
                    value={selectedInstructor}
                    onChange={(e) => setSelectedInstructor(e.target.value)}
                    className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-xs"
                  >
                    <option value={OVERALL}>Overall</option>
                    {selectedTerm.instructor_stats.map((s) => (
                      <option key={s.instructor} value={s.instructor}>
                        {s.instructor}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedTerm && !selectedTerm.available && (
                <p className="mt-2 text-xs text-neutral-500">
                  Not reported for this term (likely privacy-suppressed - too few students).
                </p>
              )}

              {/* Overall: the term's blended stats + a comparison of that term's actual instructors */}
              {selectedTerm && selectedTerm.available && selectedInstructor === OVERALL && (
                <>
                  <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-2 text-xs sm:grid-cols-6">
                    <div>
                      <dt className="text-neutral-500">Average</dt>
                      <dd className="font-medium">{selectedTerm.avg}%</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Std dev</dt>
                      <dd className="font-medium">{selectedTerm.std_dev != null ? selectedTerm.std_dev : "not reported"}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">High</dt>
                      <dd className="font-medium">{selectedTerm.high}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Low</dt>
                      <dd className="font-medium">{selectedTerm.low}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Fail rate</dt>
                      <dd className="font-medium">{selectedTerm.fail_rate}%</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Enrolled</dt>
                      <dd className="font-medium">{selectedTerm.enrolled}</dd>
                    </div>
                  </dl>

                  {selectedTerm.distribution && <GradeDistributionChart distribution={selectedTerm.distribution} />}

                  {selectedTerm.instructor_stats.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-neutral-500 mb-1.5">
                        Instructors this term
                        {selectedTerm.best_instructor && " - compared against each other below"}
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-neutral-500">
                              <th className="font-normal pr-3 py-1">Instructor</th>
                              <th className="font-normal pr-3 py-1">Sections</th>
                              <th className="font-normal pr-3 py-1">Avg</th>
                              <th className="font-normal pr-3 py-1">Fail rate</th>
                              <th className="font-normal pr-3 py-1">Std dev</th>
                              <th className="font-normal py-1">Enrolled</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedTerm.instructor_stats.map((s) => (
                              <tr key={s.instructor} className="border-t border-neutral-100 dark:border-neutral-900">
                                <td className="pr-3 py-1">
                                  <span className="font-medium">{s.instructor}</span>
                                  {selectedTerm.best_instructor === s.instructor && (
                                    <span className="ml-1.5 inline-block rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 text-[10px]">
                                      Best pick this term
                                    </span>
                                  )}
                                </td>
                                <td className="pr-3 py-1">{s.sections.join(", ")}</td>
                                <td className="pr-3 py-1">{s.avg}%</td>
                                <td className="pr-3 py-1">{s.fail_rate}%</td>
                                <td className="pr-3 py-1">{s.std_dev != null ? s.std_dev : "-"}</td>
                                <td className="py-1">{s.enrolled}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {selectedTerm.best_instructor && (
                        <p className="mt-2 text-xs text-neutral-500">
                          Historical grade outcomes only, not a teaching-quality rating - self-selection, exam
                          difficulty, and TA support all affect these numbers too.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* A specific instructor: just their own combined numbers, no comparison/best-pick marking */}
              {selectedInstructorStats && (
                <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-2 text-xs sm:grid-cols-5">
                  <div>
                    <dt className="text-neutral-500">Average</dt>
                    <dd className="font-medium">{selectedInstructorStats.avg}%</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Std dev</dt>
                    <dd className="font-medium">
                      {selectedInstructorStats.std_dev != null ? selectedInstructorStats.std_dev : "not reported"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Fail rate</dt>
                    <dd className="font-medium">{selectedInstructorStats.fail_rate}%</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Enrolled</dt>
                    <dd className="font-medium">{selectedInstructorStats.enrolled}</dd>
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <dt className="text-neutral-500">
                      Section{selectedInstructorStats.sections.length !== 1 ? "s" : ""}
                    </dt>
                    <dd className="font-medium">{selectedInstructorStats.sections.join(", ")}</dd>
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
