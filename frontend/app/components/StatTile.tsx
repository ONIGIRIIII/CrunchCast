/** Small labeled stat box with a colored dot indicator - shared by the
 * term-level hero stats and the per-course "View by term" stat grids, so
 * both read as the same dashboard language. `dotColor` is a raw CSS color
 * (hex) rather than a Tailwind class, since callers need to plug in either
 * a fixed severity/category color or a per-course accent color. */
export default function StatTile({
  label,
  value,
  dotColor,
}: {
  label: string;
  value: string | number;
  dotColor: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--color-hover-surface)]/70 border border-[var(--color-border)] px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-subtle)] mb-1">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
        {label}
      </div>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}
