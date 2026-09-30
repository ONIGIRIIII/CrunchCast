import { useEffect, useRef, useState } from "react";

/** Flips to true once, the first time the element is `threshold` on screen -
 * drives the landing page's scroll-in animations (SignalCards, MethodCards,
 * ExampleCourses, Reveal). Never flips back, so nothing re-animates on
 * scroll up. */
export function useRevealOnce<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, shown] as const;
}
