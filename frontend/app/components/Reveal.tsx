"use client";

import type { ReactNode } from "react";
import { useRevealOnce } from "@/lib/useRevealOnce";

/** Fades/rises its children in the first time they scroll into view - the
 * same entrance SignalCards' cards use, for landing page blocks that don't
 * need their own `shown` state. Shows immediately under reduced motion. */
export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const [ref, shown] = useRevealOnce<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-[opacity,translate] duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
