"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addDependency, type DependencyState } from "../relations-actions";

const initialState: DependencyState = { error: null };

export interface TaskOption {
  id: string;
  title: string;
}

export function DependencyPicker({
  projectId,
  taskId,
  options,
}: {
  projectId: string;
  taskId: string;
  options: TaskOption[];
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState(
    addDependency,
    initialState,
  );

  if (options.length === 0) return null;

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/40 p-4"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="task_id" value={taskId} />

      <div className="flex min-w-48 flex-1 flex-col gap-2">
        <Label htmlFor="depends_on_task_id">{t("selectDependency")}</Label>
        <Select
          id="depends_on_task_id"
          name="depends_on_task_id"
          required
          defaultValue=""
        >
          <option value="" disabled>
            {t("selectDependency")}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </Select>
        {state.error ? (
          <p className="text-xs text-destructive">
            {state.error === "selfDependencyError"
              ? t("selfDependencyError")
              : tc("none")}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? tc("saving") : tc("add")}
      </Button>
    </form>
  );
}
