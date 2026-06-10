import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProjectContext } from "@/lib/project-context";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/confirm-delete";
import { cn } from "@/lib/utils";
import { KanbanBoard } from "./kanban-board";
import { CalendarView } from "./calendar-view";
import { cairoToday } from "@/lib/task-time";
import { ProjectTasksRealtime } from "./realtime";
import { deleteTask } from "./actions";
import type { TaskRow } from "@/types/database";

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const { id } = await params;
  const { view, month } = await searchParams;
  const { profile } = await requireUser();
  const t = await getTranslations("tasks");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("taskStatus");
  const tPriority = await getTranslations("priority");

  const ctx = await getProjectContext(id, profile);
  if (!ctx) notFound();

  const supabase = await createClient();
  const { data: taskRows } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });
  const tasks = (taskRows ?? []) as TaskRow[];

  const assigneeNames: Record<string, string> = Object.fromEntries(
    ctx.assignees.map((a) => [a.id, a.label]),
  );

  const activeView =
    view === "list" ? "list" : view === "calendar" ? "calendar" : "board";
  const locale = await getLocale();
  const today = cairoToday();
  const activeMonth =
    month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {ctx.project.name_ar || ctx.project.name}
          </h1>
          <Link
            href={`/projects/${id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
          >
            <ArrowRight className="size-3.5" />
            {t("backToProject")}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-md border p-0.5">
            <Link
              href={`/projects/${id}/tasks?view=board`}
              className={cn(
                "rounded px-3 py-1 text-sm",
                activeView === "board"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {t("boardView")}
            </Link>
            <Link
              href={`/projects/${id}/tasks?view=list`}
              className={cn(
                "rounded px-3 py-1 text-sm",
                activeView === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {t("listView")}
            </Link>
            <Link
              href={`/projects/${id}/tasks?view=calendar`}
              className={cn(
                "rounded px-3 py-1 text-sm",
                activeView === "calendar"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {t("calendarView")}
            </Link>
          </div>

          {ctx.canManage ? (
            <Link
              href={`/projects/${id}/tasks/new`}
              className={buttonVariants({ className: "gap-2" })}
            >
              <Plus className="size-4" />
              {t("create")}
            </Link>
          ) : null}
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : activeView === "board" ? (
        <KanbanBoard
          tasks={tasks}
          projectId={id}
          assigneeNames={assigneeNames}
          canEdit={ctx.canManage}
        />
      ) : activeView === "calendar" ? (
        <CalendarView
          tasks={tasks}
          projectId={id}
          month={activeMonth}
          today={today}
          locale={locale}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("titleField")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("priority")}</TableHead>
                <TableHead>{t("assignee")}</TableHead>
                <TableHead>{t("dueDate")}</TableHead>
                {ctx.canManage ? (
                  <TableHead className="text-end">{tc("actions")}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/projects/${id}/tasks/${task.id}`}
                      className="hover:underline"
                    >
                      {task.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{tStatus(task.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tPriority(task.priority)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {task.assigned_to
                      ? (assigneeNames[task.assigned_to] ?? "—")
                      : t("unassigned")}
                  </TableCell>
                  <TableCell className="text-sm" dir="ltr">
                    {task.due_date || "—"}
                  </TableCell>
                  {ctx.canManage ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/projects/${id}/tasks/${task.id}/edit`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          {tc("edit")}
                        </Link>
                        <ConfirmDelete
                          action={deleteTask}
                          hidden={{ id: task.id, project_id: id }}
                          message={t("deleteConfirm")}
                        />
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProjectTasksRealtime projectId={id} />
    </div>
  );
}
