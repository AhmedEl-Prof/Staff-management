import { createAdminClient } from "@/lib/supabase/admin";

export interface EmployeeOption {
  id: string;
  label: string;
}

// Loads active employees of one organization as { id, label } options for
// assignment dropdowns (department managers, project members, etc.). Uses the
// admin client to list across users; callers must already be authorized and
// pass their own org id.
export async function getEmployeeOptions(
  orgId: string,
): Promise<EmployeeOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, arabic_name, full_name, is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("arabic_name");

  return (data ?? []).map((p) => ({
    id: p.id,
    label: p.arabic_name || p.full_name || p.id,
  }));
}
