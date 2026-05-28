import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";
import type { ProfileRow, ProjectRow } from "@/types/database";

export interface AssigneeOption {
  id: string;
  label: string;
}

export interface ProjectContext {
  project: ProjectRow;
  canManage: boolean;
  assignees: AssigneeOption[];
}

// Loads a project the caller can access (RLS-scoped), whether they manage it,
// and the list of assignable members. Returns null if the project is not
// accessible / does not exist.
export async function getProjectContext(
  projectId: string,
  caller: ProfileRow,
): Promise<ProjectContext | null> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (!project) return null;

  const canManage =
    caller.role === "super_admin" ||
    (caller.role === "team_leader" &&
      (await getManagedDepartmentIds(caller.id)).includes(
        project.department_id,
      ));

  // Assignees = current project members (names via admin client).
  const { data: memberRows } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  const memberIds = (memberRows ?? []).map((m) => m.user_id);

  let assignees: AssigneeOption[] = [];
  if (memberIds.length) {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, arabic_name, full_name")
      .in("id", memberIds);
    assignees = (profiles ?? []).map((p) => ({
      id: p.id,
      label: p.arabic_name || p.full_name || p.id,
    }));
  }

  return { project: project as ProjectRow, canManage, assignees };
}
