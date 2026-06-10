"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canLogTask } from "@/lib/task-time";

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
