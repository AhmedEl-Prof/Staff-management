"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { updateTaskStatus } from "./actions";
import type { TaskRow, TaskStatus, PriorityLevel } from "@/types/database";

const COLUMNS: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
];

const priorityVariant: Record<
  PriorityLevel,
  "muted" | "secondary" | "default" | "destructive"
> = {
  low: "muted",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

export function KanbanBoard({
  tasks,
  projectId,
  assigneeNames,
  canEdit,
}: {
  tasks: TaskRow[];
  projectId: string;
  assigneeNames: Record<string, string>;
  canEdit: boolean;
}) {
  const t = useTranslations("tasks");
  const tStatus = useTranslations("taskStatus");
  const tPriority = useTranslations("priority");
  const [pending, startTransition] = useTransition();

  const byStatus = (status: TaskStatus) =>
    tasks.filter((task) => task.status === status);

  function move(taskId: string, status: string) {
    startTransition(() => {
      const fd = new FormData();
      fd.set("project_id", projectId);
      fd.set("id", taskId);
      fd.set("status", status);
      void updateTaskStatus(fd);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {COLUMNS.map((status) => {
        const columnTasks = byStatus(status);
        return (
          <div
            key={status}
            className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{tStatus(status)}</span>
              <Badge variant="muted">{columnTasks.length}</Badge>
            </div>

            <div className="flex flex-col gap-2">
              {columnTasks.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {t("noTasks")}
                </p>
              ) : (
                columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-md border bg-card p-3 shadow-sm",
                      pending && "opacity-70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/projects/${projectId}/tasks/${task.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {task.title}
                      </Link>
                      {canEdit ? (
                        <Link
                          href={`/projects/${projectId}/tasks/${task.id}/edit`}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="edit"
                        >
                          <Pencil className="size-3.5" />
                        </Link>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={priorityVariant[task.priority]}>
                        {tPriority(task.priority)}
                      </Badge>
                      {task.due_date ? (
                        <span className="text-xs text-muted-foreground" dir="ltr">
                          {t("dueOn")}: {task.due_date}
                        </span>
                      ) : null}
                    </div>

                    {task.assigned_to ? (
                      <span className="text-xs text-muted-foreground">
                        {assigneeNames[task.assigned_to] ?? ""}
                      </span>
                    ) : null}

                    <Select
                      aria-label="move"
                      value={task.status}
                      disabled={pending}
                      onChange={(e) => move(task.id, e.target.value)}
                      className="h-8 text-xs"
                    >
                      {COLUMNS.map((s) => (
                        <option key={s} value={s}>
                          {tStatus(s)}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
