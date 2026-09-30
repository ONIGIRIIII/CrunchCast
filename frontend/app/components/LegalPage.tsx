import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_LAST_UPDATED } from "@/lib/site";

/** Shared shell for the privacy policy and terms pages: a plain header back
 * to the home page, a readable single column in the landing page's type and
 * colors, and a footer linking the two documents. Server component - no
 * client JS beyond what the root layout already loads. */
export default function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="landing min-h-screen flex flex-col bg-[var(--color-background)]">
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto px-gutter h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-black tracking-tight hover:opacity-85 transition-opacity">
            <BrandMark />
            CrunchCast
          </Link>
          <Link
            href="/"
            className="inline-flex items-center min-h-11 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-foreground)] transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-gutter py-16 sm:py-20">
        <h1 className="text-h2 font-black tracking-tight">{title}</h1>
        <p className="landing-mono mt-3 text-xs text-[var(--color-text-subtle)]">Last updated {LEGAL_LAST_UPDATED}</p>
        <div className="mt-8 text-base text-[var(--color-foreground)] leading-relaxed">{intro}</div>
        <div className="mt-4">{children}</div>
      </main>

      <footer className="border-t border-[var(--color-border)]">
        <nav
          aria-label="Legal"
          className="max-w-3xl mx-auto px-gutter py-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--color-text-muted)]"
        >
          <Link href="/" className="inline-flex items-center min-h-11 hover:text-[var(--color-foreground)] transition-colors">
            Home
          </Link>
          <Link href="/privacy" className="inline-flex items-center min-h-11 hover:text-[var(--color-foreground)] transition-colors">
            Privacy policy
          </Link>
          <Link href="/terms" className="inline-flex items-center min-h-11 hover:text-[var(--color-foreground)] transition-colors">
            Terms of use
          </Link>
        </nav>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm text-[var(--color-text-muted)] leading-relaxed">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2 list-disc pl-5 marker:text-[var(--color-text-subtle)]">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** Inline link in legal copy - underlined so it's distinguishable from body
 * text without relying on color alone. */
export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:/.test(href);
  return (
    <a
      href={href}
      className="text-[var(--color-foreground)] underline underline-offset-2 decoration-[var(--color-border-strong)] hover:decoration-[var(--color-chart-accent)] transition-colors"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="-2 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M14.74 4.48A8 8 0 1 0 14.74 19.52" stroke="var(--color-foreground)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M13.2 8.71A3.5 3.5 0 1 0 13.2 15.29" stroke="var(--color-chart-accent)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
