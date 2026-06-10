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
  if (caller.profile.role === "super_admin") return true;

  const { data: pm } = await admin
    .from("project_members")
    .select("id")
    .eq("project_id", task.project_id)
    .eq("user_id", caller.id)
    .limit(1);
  if ((pm?.length ?? 0) > 0) return true;

  const { data: proj } = await admin
    .from("projects")
    .select("department_id")
    .eq("id", task.project_id)
    .maybeSingle();
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
