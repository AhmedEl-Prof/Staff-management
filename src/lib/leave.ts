import type { LeaveType } from "@/types/database";

// Default yearly quotas (match the DB column defaults). Used when an employee
// has no explicit leave_balances row for the year yet.
export const DEFAULT_QUOTAS: Record<LeaveType, number> = {
  annual: 21,
  sick: 7,
  casual: 7,
};

export const LEAVE_TYPES: LeaveType[] = ["annual", "sick", "casual"];

export function currentYear(): number {
  return new Date().getUTCFullYear();
}

// Inclusive working-day count between two ISO dates, excluding the Egyptian
// weekend (Friday & Saturday). Returns 0 for an invalid/reversed range.
export function countLeaveDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  let days = 0;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay(); // 0 Sun … 6 Sat
    if (day !== 5 && day !== 6) days += 1;
  }
  return days;
}
