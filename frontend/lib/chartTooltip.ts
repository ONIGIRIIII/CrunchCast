import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";

/** Horizontal anchoring for a chart's hover/tap tooltip, given the point's
 * x position as a 0-100 percentage across the plot. Centered over the point
 * in the middle of the chart, but pinned to start/end at the point near
 * either edge - a centered tooltip over the first/last point would hang
 * half its width outside the chart, and off-screen on a phone. */
export function tooltipAlignClass(xPct: number): string {
  if (xPct < 25) return "-translate-x-2";
  if (xPct > 75) return "-translate-x-[calc(100%-0.5rem)]";
  return "-translate-x-1/2";
}

/** Touch devices have no hover-out, so a tapped-open tooltip would stay up
 * forever - clear it on any pointerdown outside the chart's own root. */
export function useDismissTooltipOnOutsidePointer(
  rootRef: RefObject<HTMLElement | null>,
  hovered: number | null,
  setHovered: Dispatch<SetStateAction<number | null>>
) {
  useEffect(() => {
    if (hovered == null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setHovered(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [rootRef, hovered, setHovered]);
}

/** Horizontal anchoring for an x-axis label under point `i` of `n` - centered
 * under its point. The first label can stay centered too (the y-axis column
 * to its left gives it room), but the last is shifted most of the way left
 * so it doesn't hang past the chart's right edge. Pinning either end label
 * fully to its point instead would push it into its neighbor on a phone. */
export function labelAlignClass(i: number, n: number): string {
  if (i === n - 1) return "-translate-x-3/4";
  return "-translate-x-1/2";
}
