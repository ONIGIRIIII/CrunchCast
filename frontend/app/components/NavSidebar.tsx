"use client";

import { useState } from "react";
import type { SavedCollection } from "@/lib/savedCollections";
import type { Theme } from "@/lib/theme";

// Props for the left nav: saved-collection data + handlers passed down from
// CourseBuilder (the state owner), plus personalization and theme state.
interface Props {
  collections: SavedCollection[];
  activeId: string | null;
  onSelect: (collection: SavedCollection) => void;
  onDelete: (id: string) => void;
  personalized: boolean;
  onOpenQuiz: () => void;
  onClearPersonalization: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

/** Full-height left nav, in the spirit of a chat app's sidebar: branding,
 * personalization status, and a collapsible "saved terms" list (collapsed
 * by default so it doesn't dominate the nav) - plus a theme toggle and the
 * site's one-line disclaimer pinned to the bottom. */
export default function NavSidebar({
  collections,
  activeId,
  onSelect,
  onDelete,
  personalized,
  onOpenQuiz,
  onClearPersonalization,
  theme,
  onToggleTheme,
}: Props) {
  // Saved terms list is collapsed by default; only local UI state (not
  // persisted) since it doesn't need to survive a page reload.
  const [savedExpanded, setSavedExpanded] = useState(false);

  return (
    // Fixed-width column, pinned full-height and sticky so it stays in view
    // while the main content scrolls.
    <aside className="w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col h-screen sticky top-0">
      {/* Header row: logo + product name on the left, theme toggle on the right */}
      <div className="flex items-center justify-between gap-2.5 px-4 py-4 border-b border-[var(--color-border)] shrink-0">
        {/* Logo mark (blue square with "C") + wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
            C
          </div>
          <span className="font-semibold text-sm">CrunchCast</span>
        </div>
        {/* Dark/light theme toggle - shows the icon for the mode you'd switch TO */}
        <button
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] w-8 h-8 flex items-center justify-center text-sm hover:bg-[var(--color-hover-surface)] transition-colors shrink-0"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Personalization section: opens the quiz, or shows a "retake"/"clear"
          pair once the student has already personalized their score */}
      <div className="px-4 py-3.5 border-b border-[var(--color-border)] shrink-0">
        <p className="text-xs font-medium text-[var(--color-text-subtle)] mb-2">Personalization</p>
        {personalized ? (
          <div className="flex items-center justify-between gap-2">
            {/* Re-opens the quiz so answers can be changed */}
            <button
              onClick={onOpenQuiz}
              className="flex-1 text-left rounded-md border border-blue-800 bg-blue-950 text-blue-300 px-3 py-2 text-sm font-medium hover:bg-blue-900 transition-colors"
            >
              Personalized ✓ (retake)
            </button>
            {/* Drops the saved weights, reverting to the objective difficulty score */}
            <button
              onClick={onClearPersonalization}
              aria-label="Clear personalization"
              className="text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)] shrink-0"
            >
              clear
            </button>
          </div>
        ) : (
          // Not personalized yet - single CTA to start the quiz
          <button
            onClick={onOpenQuiz}
            className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-hover-surface)] transition-colors"
          >
            Personalize your score
          </button>
        )}
      </div>

      {/* Saved terms: scrollable middle section (flex-1) so a long list of
          saved terms scrolls independently of the header/footer */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {/* Collapse/expand toggle - shows the saved-term count and a caret */}
        <button
          onClick={() => setSavedExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-1.5 py-1.5 rounded-md text-xs font-medium text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-hover-surface)] transition-colors"
        >
          <span>Saved terms{collections.length > 0 && ` (${collections.length})`}</span>
          <span>{savedExpanded ? "▾" : "▸"}</span>
        </button>

        {savedExpanded && (
          <div className="mt-1">
            {collections.length === 0 ? (
              // Empty state - explains where the "Save this term" action lives
              <p className="text-xs text-[var(--color-text-subtle)] px-1.5 py-1">
                No saved terms yet. Predict a term, then hit &quot;Save this term&quot; to keep it here.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {collections.map((c) => {
                  // Highlight whichever saved term is currently loaded
                  const active = c.id === activeId;
                  // Comma-joined course list shown as a subtitle, e.g. "CPSC 110, MATH 100"
                  const preview = c.courses.map((course) => `${course.subject} ${course.course}`).join(", ");
                  return (
                    <li key={c.id}>
                      {/* Clicking the row loads that saved term's courses */}
                      <div
                        className={`group flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                          active
                            ? "bg-blue-950 border border-blue-800"
                            : "hover:bg-[var(--color-hover-surface)]"
                        }`}
                        onClick={() => onSelect(c)}
                      >
                        <div className="min-w-0">
                          {/* Saved-term name (user-chosen at save time) */}
                          <p
                            className={`text-sm font-medium truncate ${
                              active ? "text-blue-300" : "text-[var(--color-foreground)]"
                            }`}
                          >
                            {c.name}
                          </p>
                          {/* Course count + preview of which courses it contains */}
                          <p className="text-xs text-[var(--color-text-subtle)] truncate">
                            {c.courses.length} course{c.courses.length !== 1 && "s"}
                            {preview && ` · ${preview}`}
                          </p>
                        </div>
                        {/* Delete button - only visible on row hover; stopPropagation
                            keeps this click from also triggering onSelect above */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(c.id);
                          }}
                          aria-label={`Delete ${c.name}`}
                          className="shrink-0 rounded-full w-5 h-5 flex items-center justify-center text-xs text-[var(--color-text-subtle)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-border)] transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Footer: fixed disclaimer about the data source, pinned to the bottom */}
      <div className="px-4 py-3 border-t border-[var(--color-border)] shrink-0">
        <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
          Historical UBC grade data (2016W and earlier) - a difficulty proxy, not a workload measurement.
        </p>
      </div>
    </aside>
  );
}
