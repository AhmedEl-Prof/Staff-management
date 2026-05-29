"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notifyMany, notifyUser } from "@/lib/notifications";

// ---------- Subtasks ----------
// A subtask is just a task row with parent_task_id set. RLS (tasks_insert)
// allows project managers to create them; this action also captures the
// parent's project_id automatically.

const subtaskSchema = z.object({
  project_id: z.string().uuid(),
  parent_task_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
});

export async function createSubtask(formData: FormData) {
  const caller = await requireUser();
  const parsed = subtaskSchema.safeParse({
    project_id: formData.get("project_id"),
    parent_task_id: formData.get("parent_task_id"),
    title: formData.get("title"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("tasks").insert({
    project_id: parsed.data.project_id,
    parent_task_id: parsed.data.parent_task_id,
    title: parsed.data.title,
    status: "todo",
    priority: "medium",
    created_by: caller.id,
  });

  revalidatePath(`/projects/${parsed.data.project_id}/tasks/${parsed.data.parent_task_id}`);
}

// ---------- Dependencies ----------

const dependencySchema = z.object({
  project_id: z.string().uuid(),
  task_id: z.string().uuid(),
  depends_on_task_id: z.string().uuid(),
});

export type DependencyState = { error: string | null };

export async function addDependency(
  _prev: DependencyState,
  formData: FormData,
): Promise<DependencyState> {
  await requireUser();
  const parsed = dependencySchema.safeParse({
    project_id: formData.get("project_id"),
    task_id: formData.get("task_id"),
    depends_on_task_id: formData.get("depends_on_task_id"),
  });
  if (!parsed.success) return { error: "invalid" };
  if (parsed.data.task_id === parsed.data.depends_on_task_id) {
    return { error: "selfDependencyError" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_dependencies")
    .insert({
      task_id: parsed.data.task_id,
      depends_on_task_id: parsed.data.depends_on_task_id,
    });

  if (error) return { error: "invalid" };

  revalidatePath(
    `/projects/${parsed.data.project_id}/tasks/${parsed.data.task_id}`,
  );
  return { error: null };
}

export async function removeDependency(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("task_dependencies").delete().eq("id", id);

  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

// ---------- Comments & Mentions ----------
// `mentions` is an array of profile UUIDs extracted from @-tokens in the
// comment body. We notify each mentioned user + the task's current assignee.

const commentSchema = z.object({
  project_id: z.string().uuid(),
  task_id: z.string().uuid(),
  content: z.string().trim().min(1).max(4000),
  mentions: z.array(z.string().uuid()).max(50).default([]),
});

export async function addComment(formData: FormData) {
  const caller = await requireUser();
  const mentionsRaw = formData.getAll("mentions").map(String);

  const parsed = commentSchema.safeParse({
    project_id: formData.get("project_id"),
    task_id: formData.get("task_id"),
    content: formData.get("content"),
    mentions: mentionsRaw,
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("task_comments").insert({
    task_id: parsed.data.task_id,
    user_id: caller.id,
    content: parsed.data.content,
    mentions: parsed.data.mentions,
  });

  // Look up the task title + assignee for the notification body.
  const { data: task } = await supabase
    .from("tasks")
    .select("title, assigned_to")
    .eq("id", parsed.data.task_id)
    .single();

  const link = `/projects/${parsed.data.project_id}/tasks/${parsed.data.task_id}`;
  const snippet =
    parsed.data.content.length > 140
      ? parsed.data.content.slice(0, 140) + "…"
      : parsed.data.content;

  // Mentioned users get a "mention" notification.
  await notifyMany(
    parsed.data.mentions,
    {
      type: "mention",
      title: `إشارة في تاسك: ${task?.title ?? ""}`,
      message: snippet,
      link,
    },
    caller.id,
  );

  // The assignee gets a "task_assigned" notification (commented on your task),
  // unless they were already covered by the mention list or are the commenter.
  if (
    task?.assigned_to &&
    task.assigned_to !== caller.id &&
    !parsed.data.mentions.includes(task.assigned_to)
  ) {
    await notifyUser({
      userId: task.assigned_to,
      type: "task_assigned",
      title: `تعليق جديد على تاسكك: ${task.title}`,
      message: snippet,
      link,
    });
  }

  revalidatePath(link);
}

export async function deleteComment(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("task_comments").delete().eq("id", id);

  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}
