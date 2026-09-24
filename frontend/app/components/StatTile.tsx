/** Small labeled stat cell - shared by the term-level hero stats and the
 * per-course "View by term" stat grids, so both read as the same language.
 * Callers arrange these in a bordered/divided grid; this component itself
 * is just a flat padded cell with no border/background of its own. */
export default function StatTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
        {label}
      </p>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}
