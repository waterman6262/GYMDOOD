/** Horizontal bars scaled to the largest value; plain CSS, no chart library. */
export function Bars({ rows }: { rows: { label: string; value: number; display?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.label} data-testid="bar" className="grid grid-cols-[5.5rem_1fr_5.5rem] items-center gap-2 text-sm">
          <span className="text-slate-600">{r.label}</span>
          <span className="h-4 rounded bg-slate-100">
            <span className="block h-4 rounded bg-indigo-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{r.display ?? r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p data-testid={testId} className="text-2xl font-bold tabular-nums">
        {value}
      </p>
    </div>
  );
}
