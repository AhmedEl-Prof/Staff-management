import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BonusItemRow,
  BonusAwardRow,
  BonusPeriodRow,
  BonusStatus,
} from "@/types/database";

// The earned amount for one bonus item: a fraction of its max payout, scaled by
// how much was achieved (0–100%). Rounded to whole EGP.
export function computeAmount(
  achievementPercent: number,
  maxAmount: number | null,
): number {
  if (!maxAmount || maxAmount <= 0) return 0;
  const pct = Math.min(100, Math.max(0, achievementPercent || 0));
  return Math.round((pct / 100) * maxAmount);
}

// Normalises a "YYYY-MM" (or undefined) to the first day of that month as
// "YYYY-MM-01". Defaults to the current month.
export function monthStart(month?: string): string {
  const now = new Date();
  const ym =
    month && /^\d{4}-\d{2}$/.test(month)
      ? month
      : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${ym}-01`;
}

// The "YYYY-MM" form for an input[type=month], from a date/period string.
export function monthValue(period: string): string {
  return period.slice(0, 7);
}

export interface DeptEmployee {
  id: string;
  label: string;
}

// Active members of a department (for the manager's bonus sheet).
export async function getDepartmentEmployees(
  departmentId: string,
): Promise<DeptEmployee[]> {
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("department_members")
    .select("user_id")
    .eq("department_id", departmentId);
  const ids = [...new Set((members ?? []).map((m) => m.user_id))];
  if (ids.length === 0) return [];

  const { data } = await admin
    .from("profiles")
    .select("id, arabic_name, full_name")
    .in("id", ids)
    .eq("is_active", true)
    .order("arabic_name");
  return (data ?? []).map((p) => ({
    id: p.id,
    label: p.arabic_name || p.full_name || p.id,
  }));
}

export interface BonusSheetLine {
  item: BonusItemRow;
  achievementPercent: number;
  amount: number;
}

export interface BonusSheet {
  lines: BonusSheetLine[];
  total: number;
  maxTotal: number;
  status: BonusStatus;
}

// Merges a department's bonus structure with an employee's recorded awards for a
// month into a ready-to-render sheet. Works with any read client (admin for a
// manager view, the RLS-scoped client for an employee's own view).
export function buildBonusSheet(
  items: BonusItemRow[],
  awards: BonusAwardRow[],
  period: BonusPeriodRow | null,
): BonusSheet {
  const byItem = new Map(awards.map((a) => [a.bonus_item_id, a]));
  const lines = items.map((item) => {
    const award = byItem.get(item.id);
    const achievementPercent = Number(award?.achievement_percent ?? 0);
    return {
      item,
      achievementPercent,
      amount: award
        ? Number(award.amount)
        : computeAmount(achievementPercent, item.max_amount),
    };
  });
  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0),
    maxTotal: items.reduce((sum, i) => sum + (Number(i.max_amount) || 0), 0),
    status: period?.status ?? "draft",
  };
}
