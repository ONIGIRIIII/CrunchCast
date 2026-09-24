"use client";

import { useRef, useState } from "react";

/** Right-hand half of "Add a Course" - lets a student drop in a screenshot
 * of their UBC Workday schedule instead of typing courses in one at a time.
 * Extraction (reading course codes out of the image) isn't wired up yet -
 * this is just the upload/preview UI, with the action button stubbed out
 * until that's built. */
export default function WorkdayUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File | null) {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
    setFile(f);
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`h-48 border-2 border-dashed flex flex-col items-center justify-center text-center gap-2 p-6 cursor-pointer transition-colors ${
          dragOver ? "border-accent" : "border-[var(--color-border-strong)] hover:bg-[var(--color-hover-surface)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a served asset
          <img src={previewUrl} alt="Workday schedule screenshot" className="max-h-40 object-contain" />
        ) : (
          <>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-[var(--color-text-subtle)]">
              <path
                d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-sm font-bold">Drop a Workday screenshot here</p>
            <p className="text-xs text-[var(--color-text-subtle)]">or click to browse - PNG or JPG</p>
          </>
        )}
      </div>

      {file && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--color-text-subtle)] truncate">{file.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFile(null);
            }}
            className="text-xs font-semibold text-[var(--color-text-subtle)] hover:text-[var(--color-foreground)] transition-colors shrink-0"
          >
            Remove
          </button>
        </div>
      )}

      <button
        disabled={!file}
        title="Reading courses from a screenshot is coming soon"
        className="self-start flex items-center gap-2 bg-accent text-on-accent px-5 py-2.5 text-sm font-bold disabled:opacity-40 hover:opacity-85 transition-opacity"
      >
        Extract courses
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
