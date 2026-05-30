// Pure date helpers for the weekly timesheet. The work week starts on Saturday
// (Egypt), so a week is Sat → Fri.

function parse(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, n: number): string {
  const d = parse(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

// The Saturday on or before the given date (defaults to today).
export function weekStart(dateStr?: string): string {
  const base =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? parse(dateStr)
      : parse(new Date().toISOString().slice(0, 10));
  const day = base.getUTCDay(); // 0 Sun … 6 Sat
  const sinceSaturday = (day + 1) % 7; // Sat→0, Sun→1, … Fri→6
  base.setUTCDate(base.getUTCDate() - sinceSaturday);
  return iso(base);
}

// The seven ISO dates of the week beginning at `start`.
export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function weekEnd(start: string): string {
  return addDays(start, 6);
}
