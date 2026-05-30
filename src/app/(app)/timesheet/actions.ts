"use server";

import { revalidatePath } from "next/cache";
import { requireUser, type SessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";

// True if the caller may log time against the given task: it's assigned to
// them, they're a member of its project, or they manage its department.
async function canLogTask(caller: SessionUser, taskId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: task } = await admin
    .from("tasks")
    .select("assigned_to, project_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return false;
  if (task.assigned_to === caller.id) return true;
  if (caller.profile.role === "super_admin") return true;

  const { data: pm } = await admin
    .from("project_members")
    .select("id")
    .eq("project_id", task.project_id)
    .eq("user_id", caller.id)
    .limit(1);
  if ((pm?.length ?? 0) > 0) return true;

  const { data: proj } = await admin
    .from("projects")
    .select("department_id")
    .eq("id", task.project_id)
    .maybeSingle();
  if (proj) {
    const managed = await getManagedDepartmentIds(caller.id);
    if (managed.includes(proj.department_id)) return true;
  }
  return false;
}

export async function addTimeLog(formData: FormData) {
  const caller = await requireUser();
  const taskId = String(formData.get("task_id") ?? "");
  const loggedDate = String(formData.get("logged_date") ?? "");
  const hours = Number(formData.get("hours"));
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!taskId || !loggedDate || !Number.isFinite(hours) || hours <= 0) return;
  if (hours > 24) return;
  if (!(await canLogTask(caller, taskId))) return;

  const admin = createAdminClient();
  await admin.from("time_logs").insert({
    task_id: taskId,
    user_id: caller.id,
    hours,
    description,
    logged_date: loggedDate,
  });

  revalidatePath("/timesheet");
}

export async function deleteTimeLog(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  // Owners delete their own entries; super admins can delete any.
  let q = admin.from("time_logs").delete().eq("id", id);
  if (caller.profile.role !== "super_admin") q = q.eq("user_id", caller.id);
  await q;

  revalidatePath("/timesheet");
}
