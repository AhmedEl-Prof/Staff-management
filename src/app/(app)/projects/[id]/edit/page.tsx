import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAssignableDepartments } from "@/lib/department-options";
import { ProjectForm } from "../../project-form";
import { updateProject } from "../../actions";
import type { ProjectRow } from "@/types/database";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const caller = await requireRole(["super_admin", "team_leader"]);
  const { id } = await params;
  const t = await getTranslations("projects");

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const departments = await getAssignableDepartments(caller.profile);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("editTitle")}</h1>
      <ProjectForm
        action={updateProject}
        project={project as ProjectRow}
        departments={departments}
      />
    </div>
  );
}
