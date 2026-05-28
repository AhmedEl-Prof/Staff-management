import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, ListChecks } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";
import { getEmployeeOptions } from "@/lib/employee-options";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  deleteProject,
  addProjectMember,
  removeProjectMember,
} from "../actions";

const PROJECT_ROLES = ["lead", "member", "observer"] as const;

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireUser();
  const t = await getTranslations("projects");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("projectStatus");
  const tPriority = await getTranslations("priority");
  const tRole = await getTranslations("projectRole");
  const tTasks = await getTranslations("tasks");

  // RLS: returns the project only if the caller can access it.
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const canManage =
    profile.role === "super_admin" ||
    (profile.role === "team_leader" &&
      (await getManagedDepartmentIds(profile.id)).includes(
        project.department_id,
      ));

  const admin = createAdminClient();
  const { data: dept } = await admin
    .from("departments")
    .select("name_ar, name")
    .eq("id", project.department_id)
    .single();

  const { data: memberRows } = await supabase
    .from("project_members")
    .select("id, user_id, role")
    .eq("project_id", id);
  const members = memberRows ?? [];
  const employees = await getEmployeeOptions();
  const nameById = new Map(employees.map((e) => [e.id, e.label]));

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{project.name_ar || project.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {dept?.name_ar || dept?.name || "—"}
            </Badge>
            <Badge variant="outline">{tStatus(project.status)}</Badge>
            <Badge variant="outline">{tPriority(project.priority)}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${id}/tasks`}
            className={buttonVariants({
              size: "sm",
              className: "gap-2",
            })}
          >
            <ListChecks className="size-4" />
            {tTasks("title")}
          </Link>
          {canManage ? (
            <>
              <Link
                href={`/projects/${id}/edit`}
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "gap-2",
                })}
              >
                <Pencil className="size-4" />
                {tc("edit")}
              </Link>
              <ConfirmDelete
                action={deleteProject}
                hidden={{ id }}
                message={t("deleteConfirm")}
              />
            </>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
        <Field label={t("client")} value={project.client_name} />
        <Field label={t("startDate")} value={project.start_date} />
        <Field label={t("endDate")} value={project.end_date} />
        <Field label={t("description")} value={project.description} full />
      </dl>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("members")}</h2>

        <div className="flex flex-col gap-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMembers")}</p>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {nameById.get(m.user_id) ?? m.user_id}
                  </span>
                  <Badge variant="secondary">{tRole(m.role)}</Badge>
                </div>
                {canManage ? (
                  <ConfirmDelete
                    action={removeProjectMember}
                    hidden={{ id: m.id, project_id: id }}
                    message={tc("delete")}
                    label={tc("remove")}
                  />
                ) : null}
              </div>
            ))
          )}
        </div>

        {canManage ? (
          <form
            action={addProjectMember}
            className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/40 p-4"
          >
            <input type="hidden" name="project_id" value={id} />
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <Label htmlFor="user_id">{t("selectEmployee")}</Label>
              <Select id="user_id" name="user_id" required defaultValue="">
                <option value="" disabled>
                  {t("selectEmployee")}
                </option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex w-40 flex-col gap-2">
              <Label htmlFor="role">{t("memberRole")}</Label>
              <Select id="role" name="role" defaultValue="member">
                {PROJECT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tRole(r)}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">{tc("add")}</Button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: string | null;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
