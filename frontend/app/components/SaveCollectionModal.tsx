"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  courseCount: number;
  onClose: () => void;
  onSave: (name: string) => void;
}

const MAX_NAME = 60;

export default function SaveCollectionModal({ open, courseCount, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  // Set on the first save attempt, so an empty name gets an explanation
  // instead of a silently disabled button - but not before the user has
  // even started typing.
  const [attempted, setAttempted] = useState(false);

  if (!open) return null;

  const trimmed = name.trim();
  const showError = attempted && !trimmed;

  function close() {
    setName("");
    setAttempted(false);
    onClose();
  }

  function save() {
    if (!trimmed) {
      setAttempted(true);
      return;
    }
    setName("");
    setAttempted(false);
    onSave(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 sm:py-10 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-term-title"
        className="relative w-full max-w-sm bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] p-5 sm:p-6"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 id="save-term-title" className="text-base font-bold">Save this term</h2>
          <button
            onClick={close}
            aria-label="Close"
            className="tap-target w-6 h-6 max-md:-mr-2 flex items-center justify-center text-sm text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)]"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-subtle)] mb-4">
          Saves these {courseCount} course{courseCount !== 1 && "s"} under a name so you can come back to it
          later. Saved only in this browser.
        </p>
        <label className="block text-xs font-medium text-[var(--color-text-subtle)] mb-1.5" htmlFor="collection-name">
          Name
        </label>
        <input
          id="collection-name"
          autoFocus
          required
          placeholder="e.g. Fall 2026 plan A"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          maxLength={MAX_NAME}
          aria-invalid={showError || undefined}
          aria-describedby="collection-name-help"
          className={`w-full border bg-transparent px-3 py-2.5 text-base sm:text-sm focus:outline focus:outline-2 focus:outline-accent focus:-outline-offset-1 ${
            showError ? "border-severity-hard" : "border-[var(--color-border-strong)]"
          }`}
        />
        <div id="collection-name-help" className="mt-1.5 flex items-start justify-between gap-3 text-xs">
          <p aria-live="polite" className="text-severity-hard">
            {showError ? "Give this term a name." : ""}
          </p>
          <p className="shrink-0 text-[var(--color-text-subtle)] tabular-nums">
            {name.length}/{MAX_NAME}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 mt-4">
          <button onClick={close} className="tap-target px-2 text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)]">
            Cancel
          </button>
          <button
            onClick={save}
            className="tap-target bg-[var(--color-chart-accent)] text-on-chart-accent px-4 py-2 text-sm font-bold hover:opacity-85 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
