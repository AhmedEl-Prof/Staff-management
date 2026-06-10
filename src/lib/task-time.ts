import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";

// True if the caller may log time against the given task: it's assigned to
// them, they're a member of its project, or they manage its department.
// Shared by the manual timesheet form and the live task timer.
export async function canLogTask(
  caller: SessionUser,
  taskId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: task } = await admin
    .from("tasks")
    .select("assigned_to, project_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return false;
  if (task.assigned_to === caller.id) return true;

  const { data: proj } = await admin
    .from("projects")
    .select("department_id")
    .eq("id", task.project_id)
    .maybeSingle();

  // Super admins: any task inside their own organization.
  if (caller.profile.role === "super_admin") {
    if (!proj) return false;
    const { data: dept } = await admin
      .from("departments")
      .select("org_id")
      .eq("id", proj.department_id)
      .maybeSingle();
    return dept?.org_id === caller.profile.org_id;
  }

  const { data: pm } = await admin
    .from("project_members")
    .select("id")
    .eq("project_id", task.project_id)
    .eq("user_id", caller.id)
    .limit(1);
  if ((pm?.length ?? 0) > 0) return true;

  if (proj) {
    const managed = await getManagedDepartmentIds(caller.id);
    if (managed.includes(proj.department_id)) return true;
  }
  return false;
}

// Today's date in the company timezone (Africa/Cairo), as YYYY-MM-DD.
export function cairoToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}
