"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectFormState } from "./actions";
import type {
  ProjectRow,
  ProjectStatus,
  PriorityLevel,
} from "@/types/database";

const STATUSES: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
];
const PRIORITIES: PriorityLevel[] = ["low", "medium", "high", "urgent"];

export interface DepartmentOption {
  id: string;
  label: string;
}

// Submit button that reflects the pending state of the enclosing form so a slow
// save can't be double-submitted and the user gets immediate feedback.
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {label}
    </Button>
  );
}

export function ProjectForm({
  action,
  project,
  departments,
}: {
  action: (
    prev: ProjectFormState,
    formData: FormData,
  ) => Promise<ProjectFormState>;
  project?: ProjectRow;
  departments: DepartmentOption[];
}) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const tStatus = useTranslations("projectStatus");
  const tPriority = useTranslations("priority");

  const [state, formAction] = useActionState<ProjectFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name_ar">{t("nameAr")}</Label>
          <Input id="name_ar" name="name_ar" defaultValue={project?.name_ar ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" name="name" dir="ltr" defaultValue={project?.name ?? ""} required />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={project?.description ?? ""}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="client_name">{t("client")}</Label>
          <Input
            id="client_name"
            name="client_name"
            defaultValue={project?.client_name ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="department_id">{t("department")}</Label>
          <Select
            id="department_id"
            name="department_id"
            required
            defaultValue={project?.department_id ?? ""}
          >
            <option value="" disabled>
              {t("department")}
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">{t("status")}</Label>
          <Select
            id="status"
            name="status"
            defaultValue={project?.status ?? "planning"}
          >
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
            defaultValue={project?.priority ?? "medium"}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {tPriority(p)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="start_date">{t("startDate")}</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            dir="ltr"
            defaultValue={project?.start_date ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="end_date">{t("endDate")}</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            dir="ltr"
            defaultValue={project?.end_date ?? ""}
          />
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {state.error === "invalid" ? t("invalidError") : t("saveError")}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton label={tc("save")} />
        <Link href="/projects" className={buttonVariants({ variant: "ghost" })}>
          {tc("cancel")}
        </Link>
      </div>
    </form>
  );
}
