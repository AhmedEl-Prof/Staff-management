import { createAdminClient } from "@/lib/supabase/admin";
import { cairoToday } from "@/lib/task-time";
import type { TaskRecurrence } from "@/types/database";

// Advances an ISO date by one recurrence interval. Monthly additions clamp
// naturally via the Date rollover (Jan 31 + 1 month → Mar 3 is acceptable for
// chore-style tasks; the alternative — silently snapping to month end — hides
// the drift).
export function nextDueDate(base: string, recurrence: TaskRecurrence): string {
  const d = new Date(`${base}T00:00:00Z`);
  if (recurrence === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// Spawns the next occurrence of a recurring task that just completed, and
// moves the recurrence flag onto the new instance so the chain continues from
// exactly one task (re-completing the old one can't fork a duplicate).
// No-op when the task has no recurrence.
export async function spawnNextOccurrence(taskId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: task } = await admin
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  if (!task || !task.recurrence) return;

  const base =
    task.due_date && task.due_date >= cairoToday()
      ? task.due_date
      : cairoToday();
  const due = nextDueDate(base, task.recurrence);

  const { error: insertErr } = await admin.from("tasks").insert({
    project_id: task.project_id,
    parent_task_id: task.parent_task_id,
    title: task.title,
    description: task.description,
    status: "todo",
    priority: task.priority,
    assigned_to: task.assigned_to,
    created_by: task.created_by,
    estimated_hours: task.estimated_hours,
    due_date: due,
    recurrence: task.recurrence,
  });
  // Only detach the old task once the new occurrence definitely exists.
  if (!insertErr) {
    await admin.from("tasks").update({ recurrence: null }).eq("id", taskId);
  }
}
