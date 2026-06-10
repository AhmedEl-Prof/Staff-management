import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";
import type { ProfileRow } from "@/types/database";

export interface DepartmentOption {
  id: string;
  label: string;
}

// Departments the caller may create/move projects into: all for super admins,
// only managed departments for team leaders, none otherwise.
export async function getAssignableDepartments(
  caller: ProfileRow,
): Promise<DepartmentOption[]> {
  const admin = createAdminClient();

  if (caller.role === "super_admin") {
    const { data } = await admin
      .from("departments")
      .select("id, name_ar, name")
      .eq("org_id", caller.org_id)
      .order("name_ar");
    return (data ?? []).map((d) => ({ id: d.id, label: d.name_ar || d.name }));
  }

  if (caller.role !== "team_leader") return [];

  const managedIds = await getManagedDepartmentIds(caller.id);
  if (managedIds.length === 0) return [];

  const { data } = await admin
    .from("departments")
    .select("id, name_ar, name")
    .in("id", managedIds)
    .order("name_ar");
  return (data ?? []).map((d) => ({ id: d.id, label: d.name_ar || d.name }));
}
