"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  TaskRow,
  TaskStatus,
  PriorityLevel,
  TaskRecurrence,
} from "@/types/database";

const STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
];
const PRIORITIES: PriorityLevel[] = ["low", "medium", "high", "urgent"];
const RECURRENCES: TaskRecurrence[] = ["daily", "weekly", "monthly"];

export interface AssigneeOption {
  id: string;
  label: string;
}

export function TaskForm({
  action,
  projectId,
  task,
  assignees,
}: {
  action: (formData: FormData) => void | Promise<void>;
  projectId: string;
  task?: TaskRow;
  assignees: AssigneeOption[];
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const tStatus = useTranslations("taskStatus");
  const tPriority = useTranslations("priority");
  const tRecurrence = useTranslations("recurrence");

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="project_id" value={projectId} />
      {task ? <input type="hidden" name="id" value={task.id} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">{t("titleField")}</Label>
        <Input id="title" name="title" defaultValue={task?.title ?? ""} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={task?.description ?? ""}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">{t("status")}</Label>
          <Select id="status" name="status" defaultValue={task?.status ?? "todo"}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="priority">{t("priority")}</Label>
          <Select
            id="priority"
            name="priority"
            defaultValue={task?.priority ?? "medium"}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {tPriority(p)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="assigned_to">{t("assignee")}</Label>
        <Select
          id="assigned_to"
          name="assigned_to"
          defaultValue={task?.assigned_to ?? ""}
        >
          <option value="">{t("unassigned")}</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="estimated_hours">{t("estimatedHours")}</Label>
          <Input
            id="estimated_hours"
            name="estimated_hours"
            type="number"
            min={0}
            step="0.5"
            dir="ltr"
            defaultValue={task?.estimated_hours ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="start_date">{t("startDate")}</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            dir="ltr"
            defaultValue={task?.start_date ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="due_date">{t("dueDate")}</Label>
          <Input
            id="due_date"
            name="due_date"
            type="date"
            dir="ltr"
            defaultValue={task?.due_date ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="recurrence">{t("recurrence")}</Label>
        <Select
          id="recurrence"
          name="recurrence"
          defaultValue={task?.recurrence ?? ""}
        >
          <option value="">{tRecurrence("none")}</option>
          {RECURRENCES.map((r) => (
            <option key={r} value={r}>
              {tRecurrence(r)}
            </option>
          ))}
        </Select>
        <span className="text-muted-foreground text-xs">
          {t("recurrenceHint")}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit">{tc("save")}</Button>
        <Link
          href={`/projects/${projectId}/tasks`}
          className={buttonVariants({ variant: "ghost" })}
        >
          {tc("cancel")}
        </Link>
      </div>
    </form>
  );
}
