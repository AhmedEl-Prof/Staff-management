import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProjectContext } from "@/lib/project-context";
import { TaskForm } from "../../task-form";
import { updateTask } from "../../actions";
import type { TaskRow } from "@/types/database";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const { profile } = await requireUser();
  const t = await getTranslations("tasks");

  const ctx = await getProjectContext(id, profile);
  if (!ctx) notFound();

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("project_id", id)
    .single();
  if (!task) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("editTitle")}</h1>
      <TaskForm
        action={updateTask}
        projectId={id}
        task={task as TaskRow}
        assignees={ctx.assignees}
      />
    </div>
  );
}
