"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addTimeLog } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {label}
    </Button>
  );
}

export function TimeLogForm({
  tasks,
  weekStart,
  weekEnd,
  defaultDate,
}: {
  tasks: { id: string; label: string }[];
  weekStart: string;
  weekEnd: string;
  defaultDate: string;
}) {
  const t = useTranslations("timesheet");

  if (tasks.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noTasks")}</p>;
  }

  return (
    <form
      action={addTimeLog}
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/40 p-4"
    >
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <Label htmlFor="task_id">{t("task")}</Label>
        <Select id="task_id" name="task_id" required defaultValue="">
          <option value="" disabled>
            {t("selectTask")}
          </option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-40 flex-col gap-2">
        <Label htmlFor="logged_date">{t("date")}</Label>
        <Input
          id="logged_date"
          name="logged_date"
          type="date"
          dir="ltr"
          required
          min={weekStart}
          max={weekEnd}
          defaultValue={defaultDate}
        />
      </div>
      <div className="flex w-28 flex-col gap-2">
        <Label htmlFor="hours">{t("hours")}</Label>
        <Input
          id="hours"
          name="hours"
          type="number"
          min="0.25"
          max="24"
          step="0.25"
          dir="ltr"
          required
        />
      </div>
      <div className="flex min-w-48 flex-1 flex-col gap-2">
        <Label htmlFor="description">{t("note")}</Label>
        <Input id="description" name="description" />
      </div>
      <SubmitButton label={t("logTime")} />
    </form>
  );
}
