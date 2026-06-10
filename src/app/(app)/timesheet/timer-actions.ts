"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canLogTask, cairoToday } from "@/lib/task-time";

// Live task timer: one running timer per user (task_timers PK = user_id).
// Stopping turns the elapsed time into a regular time_logs row, so the
// timesheet, workload and reports all see timer-tracked hours exactly like
// manually logged ones.

const idSchema = z.string().uuid();

// Converts the caller's running timer (if any) into a time log and clears it.
// Returns true if something was logged. Sub-minute runs are logged as 0.02h
// (~1 minute) so an accidental start/stop still leaves a visible trace.
async function flushTimer(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: timer } = await admin
    .from("task_timers")
    .select("task_id, started_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!timer) return false;

  const elapsedH =
    (Date.now() - new Date(timer.started_at).getTime()) / 3_600_000;
  // Guard against clock weirdness / forgotten timers: clamp to (0.02h, 24h].
  const hours = Math.min(24, Math.max(0.02, Math.round(elapsedH * 100) / 100));

  await admin.from("time_logs").insert({
    task_id: timer.task_id,
    user_id: userId,
    hours,
    description: null,
    logged_date: cairoToday(),
  });
  await admin.from("task_timers").delete().eq("user_id", userId);
  return true;
}

// Starts a timer on the given task. If a timer is already running (on this or
// another task) it is stopped & logged first, so the user never tracks two
// things at once and never loses time.
export async function startTimer(formData: FormData) {
  const caller = await requireUser();
  const parsed = idSchema.safeParse(formData.get("task_id"));
  if (!parsed.success) return;
  const taskId = parsed.data;
  if (!(await canLogTask(caller, taskId))) return;

  await flushTimer(caller.id);

  const admin = createAdminClient();
  await admin.from("task_timers").insert({
    user_id: caller.id,
    task_id: taskId,
  });

  revalidatePath("/timesheet");
}

// Stops the caller's running timer and logs the elapsed time.
export async function stopTimer() {
  const caller = await requireUser();
  await flushTimer(caller.id);
  revalidatePath("/timesheet");
}
