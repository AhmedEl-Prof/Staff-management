import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProjectContext } from "@/lib/project-context";
import { TaskForm } from "../task-form";
import { createTask } from "../actions";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireUser();
  const t = await getTranslations("tasks");

  const ctx = await getProjectContext(id, profile);
  if (!ctx) notFound();
  // Only project managers create tasks (RLS enforces too).
  if (!ctx.canManage) redirect(`/projects/${id}/tasks`);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("createTitle")}</h1>
      <TaskForm action={createTask} projectId={id} assignees={ctx.assignees} />
    </div>
  );
}
