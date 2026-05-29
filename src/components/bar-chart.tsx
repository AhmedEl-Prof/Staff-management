// Minimal dependency-free horizontal bar chart. Renders labeled rows with a
// proportional bar each — works cleanly in RTL and avoids pulling in a charting
// library for simple status breakdowns.

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

export function BarChart({ data }: { data: BarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex flex-col gap-3">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-sm text-muted-foreground">
            {d.label}
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
            <div
              className="flex h-full items-center justify-end rounded-md px-2 text-xs font-medium text-white"
              style={{
                width: `${Math.max((d.value / max) * 100, d.value > 0 ? 8 : 0)}%`,
                background: d.color ?? "var(--primary)",
                minWidth: d.value > 0 ? "1.5rem" : 0,
              }}
            >
              {d.value > 0 ? d.value : null}
            </div>
          </div>
          {d.value === 0 ? (
            <span className="w-6 text-xs text-muted-foreground">0</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
