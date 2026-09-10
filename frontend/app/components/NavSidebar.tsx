"use client";

import { useState } from "react";
import type { SavedCollection } from "@/lib/savedCollections";
import type { Theme } from "@/lib/theme";

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
  const [savedExpanded, setSavedExpanded] = useState(false);

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--color-border)] shrink-0">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
          C
        </div>
        <span className="font-semibold text-sm">CrunchCast</span>
      </div>

      <div className="px-4 py-3.5 border-b border-[var(--color-border)] shrink-0">
        <p className="text-xs font-medium text-[var(--color-text-subtle)] mb-2">Personalization</p>
        {personalized ? (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onOpenQuiz}
              className="flex-1 text-left rounded-md border border-blue-800 bg-blue-950 text-blue-300 px-3 py-2 text-sm font-medium hover:bg-blue-900 transition-colors"
            >
              Personalized ✓ (retake)
            </button>
            <button
              onClick={onClearPersonalization}
              aria-label="Clear personalization"
              className="text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)] shrink-0"
            >
              clear
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenQuiz}
            className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-hover-surface)] transition-colors"
          >
            Personalize your score
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
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
              <p className="text-xs text-[var(--color-text-subtle)] px-1.5 py-1">
                No saved terms yet. Predict a term, then hit &quot;Save this term&quot; to keep it here.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {collections.map((c) => {
                  const active = c.id === activeId;
                  const preview = c.courses.map((course) => `${course.subject} ${course.course}`).join(", ");
                  return (
                    <li key={c.id}>
                      <div
                        className={`group flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                          active
                            ? "bg-blue-950 border border-blue-800"
                            : "hover:bg-[var(--color-hover-surface)]"
                        }`}
                        onClick={() => onSelect(c)}
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              active ? "text-blue-300" : "text-[var(--color-foreground)]"
                            }`}
                          >
                            {c.name}
                          </p>
                          <p className="text-xs text-[var(--color-text-subtle)] truncate">
                            {c.courses.length} course{c.courses.length !== 1 && "s"}
                            {preview && ` · ${preview}`}
                          </p>
                        </div>
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

      <div className="px-4 py-3 border-t border-[var(--color-border)] shrink-0 flex flex-col gap-3">
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-hover-surface)] transition-colors"
        >
          {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
        </button>
        <p className="text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
          Historical UBC grade data (2016W and earlier) - a difficulty proxy, not a workload measurement.
        </p>
      </div>
    </aside>
  );
}
