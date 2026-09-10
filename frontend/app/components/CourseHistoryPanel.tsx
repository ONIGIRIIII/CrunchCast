"use client";

import { useMemo, useState } from "react";
import { ApiError, getCourseHistory, type CourseTermStats, type SectionStats } from "@/lib/api";
import GradeDistributionChart from "./GradeDistributionChart";
import StatTile from "./StatTile";

const OVERALL = "__overall__";

function termKey(t: CourseTermStats) {
  return `${t.year}${t.session}`;
}

function termLabel(t: CourseTermStats) {
  return `${t.year}${t.session} (${t.session_label})`;
}

export default function CourseHistoryPanel({
  subject,
  course,
  accentHex,
}: {
  subject: string;
  course: string;
  accentHex: string;
}) {
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<CourseTermStats[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTermKey, setSelectedTermKey] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>(OVERALL);

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
    setSelectedSection(OVERALL); // switching terms resets the section picker back to "Overall"
  }

  const selectedSectionStats: SectionStats | null =
    selectedTerm?.sections.find((s) => s.section === selectedSection) ?? null;

  return (
    <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
      <button
        onClick={toggle}
        className="text-sm font-medium text-blue-400 hover:text-blue-300"
      >
        {open ? "Hide" : "View"} by term {open ? "▴" : "▾"}
      </button>

      {open && (
        <div className="mt-4 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-hover-surface)]/40 p-4">
          {loading && <p className="text-sm text-[var(--color-text-subtle)]">Loading...</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {terms && terms.length === 0 && (
            <p className="text-sm text-[var(--color-text-subtle)]">No term-by-term data for this course.</p>
          )}

          {terms && terms.length > 0 && (
            <>
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-text-subtle)] mb-1">Term</label>
                  <select
                    value={selectedTermKey ?? ""}
                    onChange={(e) => selectTerm(e.target.value)}
                    className="rounded-md border border-[var(--color-border-strong)] bg-transparent px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  >
                    {terms.map((t) => (
                      <option key={termKey(t)} value={termKey(t)}>
                        {termLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTerm && selectedTerm.sections.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--color-text-subtle)] mb-1">Section</label>
                    <select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="rounded-md border border-[var(--color-border-strong)] bg-transparent px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    >
                      <option value={OVERALL}>Overall</option>
                      {selectedTerm.sections.map((s) => (
                        <option key={s.section} value={s.section}>
                          Section {s.section}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {selectedTerm && !selectedTerm.available && (
                <p className="mt-3 text-sm text-[var(--color-text-subtle)]">
                  Not reported for this term (likely privacy-suppressed - too few students).
                </p>
              )}

              {/* Overall: the term's blended stats + a comparison of that term's actual instructors */}
              {selectedTerm && selectedTerm.available && selectedSection === OVERALL && (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                    <StatTile label="Average" value={`${selectedTerm.avg}%`} dotColor={accentHex} />
                    <StatTile label="Std dev" value={selectedTerm.std_dev ?? "-"} dotColor={accentHex} />
                    <StatTile label="High" value={selectedTerm.high ?? "-"} dotColor={accentHex} />
                    <StatTile label="Low" value={selectedTerm.low ?? "-"} dotColor={accentHex} />
                    <StatTile label="Fail rate" value={`${selectedTerm.fail_rate}%`} dotColor={accentHex} />
                    <StatTile label="Enrolled" value={selectedTerm.enrolled ?? "-"} dotColor={accentHex} />
                  </div>

                  {selectedTerm.distribution && (
                    <GradeDistributionChart distribution={selectedTerm.distribution} accentHex={accentHex} />
                  )}

                  {selectedTerm.instructor_stats.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-[var(--color-text-subtle)] mb-2">
                        Instructors this term
                        {selectedTerm.best_instructor && " - compared against each other below"}
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[var(--color-text-subtle)] bg-[var(--color-hover-surface)]/60">
                              <th className="font-normal pl-3 pr-3 py-2">Instructor</th>
                              <th className="font-normal pr-3 py-2">Sections</th>
                              <th className="font-normal pr-3 py-2">Avg</th>
                              <th className="font-normal pr-3 py-2">Fail rate</th>
                              <th className="font-normal pr-3 py-2">Std dev</th>
                              <th className="font-normal pr-3 py-2">Enrolled</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedTerm.instructor_stats.map((s) => (
                              <tr
                                key={s.instructor}
                                className="border-t border-[var(--color-border)] hover:bg-[var(--color-hover-surface)]/60 transition-colors"
                              >
                                <td className="pl-3 pr-3 py-2">
                                  <span className="font-medium">{s.instructor}</span>
                                  {selectedTerm.best_instructor === s.instructor && (
                                    <span className="ml-1.5 inline-block rounded-full bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 text-[10px]">
                                      Best pick this term
                                    </span>
                                  )}
                                </td>
                                <td className="pr-3 py-2">{s.sections.join(", ")}</td>
                                <td className="pr-3 py-2">{s.avg}%</td>
                                <td className="pr-3 py-2">{s.fail_rate}%</td>
                                <td className="pr-3 py-2">{s.std_dev != null ? s.std_dev : "-"}</td>
                                <td className="pr-3 py-2">{s.enrolled}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {selectedTerm.best_instructor && (
                        <p className="mt-2.5 text-xs text-[var(--color-text-subtle)]">
                          Historical grade outcomes only, not a teaching-quality rating - self-selection, exam
                          difficulty, and TA support all affect these numbers too.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* A specific section: that section's own numbers, plus who taught it - no comparison/best-pick marking */}
              {selectedSectionStats && (
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  <StatTile label="Average" value={`${selectedSectionStats.avg}%`} dotColor={accentHex} />
                  <StatTile
                    label="Std dev"
                    value={selectedSectionStats.std_dev ?? "-"}
                    dotColor={accentHex}
                  />
                  <StatTile label="Fail rate" value={`${selectedSectionStats.fail_rate}%`} dotColor={accentHex} />
                  <StatTile label="Enrolled" value={selectedSectionStats.enrolled} dotColor={accentHex} />
                  <div className="col-span-3 sm:col-span-1">
                    <StatTile
                      label={`Instructor${selectedSectionStats.instructors.length !== 1 ? "s" : ""}`}
                      value={
                        selectedSectionStats.instructors.length > 0
                          ? selectedSectionStats.instructors.join(", ")
                          : "-"
                      }
                      dotColor={accentHex}
                    />
                  </div>
                </div>
              )}

              {selectedSectionStats?.distribution && (
                <GradeDistributionChart distribution={selectedSectionStats.distribution} accentHex={accentHex} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
