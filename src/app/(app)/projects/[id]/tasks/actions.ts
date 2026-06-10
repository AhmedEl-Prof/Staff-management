"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notifyUser } from "@/lib/notifications";
import { awardTaskCompletion } from "@/lib/gamification";
import { spawnNextOccurrence } from "@/lib/recurrence";

// Task writes are governed by RLS:
//   tasks_insert / tasks_delete  -> manages_project (super admin / team leader)
//   tasks_update                 -> manages_project OR assigned_to = self
// so the assignee can move their own task across the board, while managers can
// edit any task in their projects.

const TASK_STATUSES = [
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
] as const;

const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assigned_to: z.string().uuid().optional(),
  estimated_hours: z.coerce.number().min(0).max(9999).optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  recurrence: z.enum(["daily", "weekly", "monthly"]).optional(),
});

function parseTask(formData: FormData) {
  return taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    status: formData.get("status"),
    priority: formData.get("priority"),
    assigned_to: formData.get("assigned_to") || undefined,
    estimated_hours: formData.get("estimated_hours") || undefined,
    start_date: formData.get("start_date") || undefined,
    due_date: formData.get("due_date") || undefined,
    recurrence: formData.get("recurrence") || undefined,
  });
}

export async function createTask(formData: FormData) {
  const caller = await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  const parsed = parseTask(formData);
  if (!projectId || !parsed.success) return;

  const supabase = await createClient();
  const { data: inserted } = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      assigned_to: parsed.data.assigned_to ?? null,
      created_by: caller.id,
      estimated_hours: parsed.data.estimated_hours ?? null,
      start_date: parsed.data.start_date ?? null,
      due_date: parsed.data.due_date ?? null,
      recurrence: parsed.data.recurrence ?? null,
      completed_at: parsed.data.status === "done" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (
    inserted &&
    parsed.data.assigned_to &&
    parsed.data.assigned_to !== caller.id
  ) {
    await notifyUser({
      userId: parsed.data.assigned_to,
      type: "task_assigned",
      title: "تم إسناد تاسك جديد لك",
      message: parsed.data.title,
      link: `/projects/${projectId}/tasks/${inserted.id}`,
    });
  }

  revalidatePath(`/projects/${projectId}/tasks`);
  redirect(`/projects/${projectId}/tasks`);
}

export async function updateTask(formData: FormData) {
  const caller = await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  const id = String(formData.get("id") ?? "");
  const parsed = parseTask(formData);
  if (!projectId || !id || !parsed.success) return;

  const supabase = await createClient();
  // Capture the previous state so we only notify on assignee change and only
  // award completion points on the todo→done transition.
  const { data: prev } = await supabase
    .from("tasks")
    .select("assigned_to, status, due_date")
    .eq("id", id)
    .single();

  const completedAt =
    parsed.data.status === "done" ? new Date().toISOString() : null;

  await supabase
    .from("tasks")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      assigned_to: parsed.data.assigned_to ?? null,
      estimated_hours: parsed.data.estimated_hours ?? null,
      start_date: parsed.data.start_date ?? null,
      due_date: parsed.data.due_date ?? null,
      recurrence: parsed.data.recurrence ?? null,
      completed_at: completedAt,
    })
    .eq("id", id);

  const newAssignee = parsed.data.assigned_to ?? null;
  if (
    newAssignee &&
    newAssignee !== prev?.assigned_to &&
    newAssignee !== caller.id
  ) {
    await notifyUser({
      userId: newAssignee,
      type: "task_assigned",
      title: "تم إسناد تاسك لك",
      message: parsed.data.title,
      link: `/projects/${projectId}/tasks/${id}`,
    });
  }

  // Award completion points when a task newly transitions into "done".
  if (parsed.data.status === "done" && prev?.status !== "done") {
    await awardTaskCompletion({
      id,
      assigned_to: newAssignee,
      due_date: parsed.data.due_date ?? null,
      completed_at: completedAt,
    });
    await spawnNextOccurrence(id);
  }

  revalidatePath(`/projects/${projectId}/tasks`);
  redirect(`/projects/${projectId}/tasks`);
}

export async function deleteTask(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!projectId || !id) return;

  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", id);

  revalidatePath(`/projects/${projectId}/tasks`);
}

// Lightweight status change used by the Kanban board to move a card between
// columns without opening the full edit form.
export async function updateTaskStatus(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  const id = String(formData.get("id") ?? "");
  const statusValue = String(formData.get("status") ?? "");
  if (
    !projectId ||
    !id ||
    !(TASK_STATUSES as readonly string[]).includes(statusValue)
  ) {
    return;
  }
  const status = statusValue as (typeof TASK_STATUSES)[number];

  const supabase = await createClient();
  const { data: prev } = await supabase
    .from("tasks")
    .select("assigned_to, status, due_date")
    .eq("id", id)
    .single();

  const completedAt = status === "done" ? new Date().toISOString() : null;
  await supabase
    .from("tasks")
    .update({ status, completed_at: completedAt })
    .eq("id", id);

  // Award completion points on the transition into "done".
  if (status === "done" && prev?.status !== "done") {
    await awardTaskCompletion({
      id,
      assigned_to: prev?.assigned_to ?? null,
      due_date: prev?.due_date ?? null,
      completed_at: completedAt,
    });
    await spawnNextOccurrence(id);
  }

  revalidatePath(`/projects/${projectId}/tasks`);
}
