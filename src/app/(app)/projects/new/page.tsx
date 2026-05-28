import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getAssignableDepartments } from "@/lib/department-options";
import { ProjectForm } from "../project-form";
import { createProject } from "../actions";

export default async function NewProjectPage() {
  const caller = await requireRole(["super_admin", "team_leader"]);
  const t = await getTranslations("projects");
  const departments = await getAssignableDepartments(caller.profile);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("createTitle")}</h1>
      <ProjectForm action={createProject} departments={departments} />
    </div>
  );
}
