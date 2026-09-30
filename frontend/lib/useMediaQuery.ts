import { useSyncExternalStore } from "react";

/** Live `window.matchMedia(query).matches`. Renders as `serverDefault` on
 * the server and during hydration, then switches to the real value - no
 * hydration mismatch, and it follows resizes/rotations afterwards. */
export function useMediaQuery(query: string, serverDefault = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverDefault
  );
}
