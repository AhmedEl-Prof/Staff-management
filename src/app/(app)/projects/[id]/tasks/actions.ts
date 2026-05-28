"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  });
}

export async function createTask(formData: FormData) {
  const caller = await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  const parsed = parseTask(formData);
  if (!projectId || !parsed.success) return;

  const supabase = await createClient();
  await supabase.from("tasks").insert({
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
    completed_at: parsed.data.status === "done" ? new Date().toISOString() : null,
  });

  revalidatePath(`/projects/${projectId}/tasks`);
  redirect(`/projects/${projectId}/tasks`);
}

export async function updateTask(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  const id = String(formData.get("id") ?? "");
  const parsed = parseTask(formData);
  if (!projectId || !id || !parsed.success) return;

  const supabase = await createClient();
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
      completed_at:
        parsed.data.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);

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
  await supabase
    .from("tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  revalidatePath(`/projects/${projectId}/tasks`);
}
