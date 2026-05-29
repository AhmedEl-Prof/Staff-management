"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageUser } from "@/lib/permissions";

const logSchema = z.object({
  user_id: z.string().uuid(),
  kpi_id: z.string().uuid(),
  value: z.coerce.number(),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
});

export type LogKpiState = { error: string | null; saved: boolean };

// Records a KPI value for an employee. Restricted to managers (RLS:
// kpi_logs_manage -> manages_user); we double-check canManageUser to keep a
// team leader from logging for someone outside their departments.
export async function logKpiValue(
  _prev: LogKpiState,
  formData: FormData,
): Promise<LogKpiState> {
  const caller = await requireRole(["super_admin", "team_leader"]);
  const parsed = logSchema.safeParse({
    user_id: formData.get("user_id"),
    kpi_id: formData.get("kpi_id"),
    value: formData.get("value"),
    period_start: formData.get("period_start"),
    period_end: formData.get("period_end"),
  });
  if (!parsed.success) return { error: "invalid", saved: false };

  if (!(await canManageUser(caller.profile, parsed.data.user_id))) {
    return { error: "notAllowed", saved: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("kpi_logs").insert({
    user_id: parsed.data.user_id,
    kpi_id: parsed.data.kpi_id,
    value: parsed.data.value,
    period_start: parsed.data.period_start,
    period_end: parsed.data.period_end,
  });
  if (error) return { error: "invalid", saved: false };

  revalidatePath("/kpis");
  return { error: null, saved: true };
}
