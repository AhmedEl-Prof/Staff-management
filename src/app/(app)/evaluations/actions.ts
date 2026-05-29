"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageUser } from "@/lib/permissions";
import {
  computeEvaluation,
  kpiScoresToJson,
  periodRange,
} from "@/lib/evaluations";
import { notifyUser } from "@/lib/notifications";

const generateSchema = z.object({
  user_id: z.string().uuid(),
  period_type: z.enum(["weekly", "monthly"]),
  notes: z.string().trim().max(2000).optional(),
});

// Generates an evaluation for an employee for the current period: aggregates
// their KPI logs into a weighted score and stores a draft evaluation. Manager
// only (RLS: evaluations_manage -> manages_user), with an explicit
// canManageUser check for team-leader scoping.
export async function generateEvaluation(formData: FormData) {
  const caller = await requireRole(["super_admin", "team_leader"]);
  const parsed = generateSchema.safeParse({
    user_id: formData.get("user_id"),
    period_type: formData.get("period_type"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return;
  if (!(await canManageUser(caller.profile, parsed.data.user_id))) return;

  const { start, end } = periodRange(parsed.data.period_type);
  const { kpiScores, totalScore } = await computeEvaluation(
    parsed.data.user_id,
    parsed.data.period_type,
    start,
    end,
  );

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      user_id: parsed.data.user_id,
      evaluator_id: caller.id,
      period_type: parsed.data.period_type,
      period_start: start,
      period_end: end,
      total_score: totalScore,
      kpi_scores: kpiScoresToJson(kpiScores),
      notes: parsed.data.notes ?? null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) return;

  revalidatePath("/evaluations");
  redirect(`/evaluations/${data.id}`);
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "finalized", "sent"]),
});

// Transitions an evaluation's status. When set to "sent", notifies the
// employee that their evaluation is available.
export async function setEvaluationStatus(formData: FormData) {
  const caller = await requireRole(["super_admin", "team_leader"]);
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: evaluation } = await supabase
    .from("evaluations")
    .select("user_id")
    .eq("id", parsed.data.id)
    .single();
  if (!evaluation) return;
  if (!(await canManageUser(caller.profile, evaluation.user_id))) return;

  await supabase
    .from("evaluations")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (parsed.data.status === "sent" && evaluation.user_id !== caller.id) {
    await notifyUser({
      userId: evaluation.user_id,
      type: "evaluation",
      title: "تقييم أداء جديد متاح",
      message: "تم إرسال تقييم أدائك — يمكنك الاطلاع عليه الآن",
      link: `/evaluations/${parsed.data.id}`,
    });
  }

  revalidatePath(`/evaluations/${parsed.data.id}`);
  revalidatePath("/evaluations");
}
