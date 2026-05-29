import { createAdminClient } from "@/lib/supabase/admin";
import type { EvaluationPeriodType, Json } from "@/types/database";

// Per-KPI line in an evaluation's kpi_scores breakdown.
export interface KpiScoreLine {
  kpi_id: string;
  name: string;
  name_ar: string | null;
  unit: string | null;
  weight: number;
  // Sum of logged values for this KPI in the period.
  value: number;
  // value * weight — the KPI's contribution to total_score.
  weighted: number;
}

export interface ComputedEvaluation {
  kpiScores: KpiScoreLine[];
  totalScore: number;
}

// Date helpers for period boundaries (UTC dates, ISO yyyy-mm-dd).
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Returns [start, end] (inclusive) for the period containing `ref`.
//  - weekly : Saturday → Friday (the work week used across the app)
//  - monthly: 1st → last day of the month
export function periodRange(
  type: EvaluationPeriodType,
  ref: Date = new Date(),
): { start: string; end: string } {
  if (type === "weekly") {
    const day = ref.getUTCDay(); // 0=Sun … 6=Sat
    // Days since the most recent Saturday.
    const sinceSaturday = (day + 1) % 7;
    const start = new Date(ref);
    start.setUTCDate(ref.getUTCDate() - sinceSaturday);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { start: isoDate(start), end: isoDate(end) };
  }
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
  return { start: isoDate(start), end: isoDate(end) };
}

// Aggregates a user's KPI logs for the period into a weighted score breakdown.
// The KPI catalogue is scoped to the user's departments (plus global KPIs with
// department_id = null). Returns zeroed lines for KPIs with no logs so the
// evaluation shows the full expected set.
export async function computeEvaluation(
  userId: string,
  periodType: EvaluationPeriodType,
  start: string,
  end: string,
): Promise<ComputedEvaluation> {
  const admin = createAdminClient();

  // Departments the user belongs to.
  const { data: memberships } = await admin
    .from("department_members")
    .select("department_id")
    .eq("user_id", userId);
  const deptIds = (memberships ?? []).map((m) => m.department_id);

  // KPI catalogue: matching period, and either global or in the user's depts.
  const { data: allDefs } = await admin
    .from("kpi_definitions")
    .select("id, name, name_ar, unit, weight, period, department_id")
    .eq("period", periodType);
  const defs = (allDefs ?? []).filter(
    (d) => d.department_id === null || deptIds.includes(d.department_id),
  );

  // Logged values for the period.
  const { data: logs } = await admin
    .from("kpi_logs")
    .select("kpi_id, value")
    .eq("user_id", userId)
    .gte("period_start", start)
    .lte("period_end", end);

  const valueByKpi = new Map<string, number>();
  for (const log of logs ?? []) {
    valueByKpi.set(log.kpi_id, (valueByKpi.get(log.kpi_id) ?? 0) + log.value);
  }

  const kpiScores: KpiScoreLine[] = defs.map((d) => {
    const value = valueByKpi.get(d.id) ?? 0;
    const weight = d.weight ?? 1;
    return {
      kpi_id: d.id,
      name: d.name,
      name_ar: d.name_ar,
      unit: d.unit,
      weight,
      value,
      weighted: Math.round(value * weight * 100) / 100,
    };
  });

  const totalScore =
    Math.round(kpiScores.reduce((sum, l) => sum + l.weighted, 0) * 100) / 100;

  return { kpiScores, totalScore };
}

// Serializes the breakdown for the evaluations.kpi_scores jsonb column.
export function kpiScoresToJson(lines: KpiScoreLine[]): Json {
  return lines as unknown as Json;
}
