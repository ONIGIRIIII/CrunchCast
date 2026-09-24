"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  courseCount: number;
  onClose: () => void;
  onSave: (name: string) => void;
}

export default function SaveCollectionModal({ open, courseCount, onClose, onSave }: Props) {
  const [name, setName] = useState("");

  if (!open) return null;

  function close() {
    setName("");
    onClose();
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName("");
    onSave(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative w-full max-w-sm bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold">Save this term</h2>
          <button
            onClick={close}
            aria-label="Close"
            className="w-6 h-6 flex items-center justify-center text-sm text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-surface)]"
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
          placeholder="e.g. Fall 2026 plan A"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          maxLength={60}
          className="w-full border border-[var(--color-border-strong)] bg-transparent px-3 py-2.5 text-sm focus:outline focus:outline-2 focus:outline-accent focus:-outline-offset-1"
        />
        <div className="flex items-center justify-end gap-3 mt-5">
          <button onClick={close} className="text-xs text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)]">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!name.trim()}
            className="bg-[var(--color-chart-accent)] text-white px-4 py-2 text-sm font-bold disabled:opacity-40 hover:opacity-85 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
