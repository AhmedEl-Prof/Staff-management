import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileRow } from "@/types/database";

// Returns the ids of departments the given user manages: either as the named
// department manager, or via a department_members row with role = 'manager'.
export async function getManagedDepartmentIds(
  userId: string,
): Promise<string[]> {
  const admin = createAdminClient();

  const [{ data: managed }, { data: memberships }] = await Promise.all([
    admin.from("departments").select("id").eq("manager_id", userId),
    admin
      .from("department_members")
      .select("department_id")
      .eq("user_id", userId)
      .eq("role", "manager"),
  ]);

  const ids = new Set<string>();
  managed?.forEach((d) => ids.add(d.id));
  memberships?.forEach((m) => ids.add(m.department_id));
  return [...ids];
}

// True if `caller` may manage `targetUserId`'s account: super admins manage
// everyone; team leaders manage members of departments they lead. Uses the
// admin client (bypasses RLS) — only call after authenticating the caller.
export async function canManageUser(
  caller: ProfileRow,
  targetUserId: string,
): Promise<boolean> {
  if (caller.role === "super_admin") return true;
  if (caller.role !== "team_leader") return false;
  if (caller.id === targetUserId) return true;

  const managedDeptIds = await getManagedDepartmentIds(caller.id);
  if (managedDeptIds.length === 0) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("department_members")
    .select("id")
    .eq("user_id", targetUserId)
    .in("department_id", managedDeptIds)
    .limit(1);

  return (data?.length ?? 0) > 0;
}
