import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
};

// Custom 404 for any unmatched URL. Renders inside the root layout, so the
// saved light/dark theme and fonts apply; Next adds the noindex tag and the
// 404 status itself. One way out - back to the home page - rather than a
// row of links.
export default function NotFound() {
  return (
    <main
      className="landing landing-glow flex-1 min-h-screen flex flex-col items-center justify-center px-gutter py-24 text-center bg-[var(--color-background)]"
      style={{ "--glow-strength": "22%" } as CSSProperties}
    >
      <p className="landing-mono text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-chart-accent)" }}>
        404
      </p>
      <h1 className="mt-4 text-h2 font-black tracking-tight">This page doesn&apos;t exist</h1>
      <p className="mt-4 max-w-md text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed">
        The link might be broken, or the page may have moved. Your saved terms are still in your browser.
      </p>
      <Link
        href="/"
        className="mt-10 inline-flex items-center justify-center gap-2 min-h-11 bg-accent text-on-accent px-6 py-2.5 text-sm font-bold hover:opacity-85 transition-opacity"
      >
        Back to CrunchCast
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </main>
  );
}
