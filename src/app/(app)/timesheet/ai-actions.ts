"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateText, aiConfigured, type AiState } from "@/lib/ai";
import { weekStart, weekEnd } from "@/lib/timesheet";

const SYSTEM = `You are a friendly productivity assistant for an employee at a marketing/creative agency.
Write a short weekly digest addressed directly to the employee ("you" / "أنت").
Reply in the same language as the data labels (default to Arabic).
Structure:
1. One encouraging line highlighting the week.
2. "أنجزت / Done" — bullets of completed tasks (skip if none).
3. "ملاحظات / Notes" — at most two practical suggestions based on the numbers (e.g. logged hours vs capacity, overdue tasks).
Keep it under ~120 words. Do not invent tasks. Output only the digest — no preamble.`;

export async function weeklyDigest(): Promise<AiState> {
  const { id: userId, profile } = await requireUser();
  if (!aiConfigured()) return { error: "no_ai" };

  const start = weekStart();
  const end = weekEnd(start);
  const today = new Date().toISOString().slice(0, 10);
  const admin = createAdminClient();

  const [{ data: logs }, { data: doneTasks }, { count: openCount }, { data: overdue }] =
    await Promise.all([
      admin
        .from("time_logs")
        .select("hours")
        .eq("user_id", userId)
        .gte("logged_date", start)
        .lte("logged_date", end),
      admin
        .from("tasks")
        .select("title")
        .eq("assigned_to", userId)
        .eq("status", "done")
        .gte("completed_at", start)
        .lte("completed_at", `${end}T23:59:59`),
      admin
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .in("status", ["todo", "in_progress", "review"]),
      admin
        .from("tasks")
        .select("id")
        .eq("assigned_to", userId)
        .in("status", ["todo", "in_progress", "review"])
        .lt("due_date", today),
    ]);

  const loggedHours = (logs ?? []).reduce((s, l) => s + Number(l.hours), 0);
  const capacity = Number(profile.weekly_hours) || 40;
  const done = (doneTasks ?? []).map((t) => t.title);
  const openTasks = openCount ?? 0;
  const overdueCount = (overdue ?? []).length;

  if (loggedHours === 0 && done.length === 0 && openTasks === 0) {
    return { error: "no_data" };
  }

  const prompt = [
    `Week: ${start} to ${end}`,
    `Logged hours: ${loggedHours} of ${capacity} weekly capacity`,
    `Tasks completed this week (${done.length}): ${done.length ? done.join("; ") : "none"}`,
    `Open tasks: ${openTasks} (overdue: ${overdueCount})`,
  ].join("\n");

  try {
    const text = await generateText({ system: SYSTEM, prompt });
    return { text };
  } catch (error) {
    console.error("weeklyDigest failed", error);
    return { error: "failed" };
  }
}
