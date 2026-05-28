import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getManagedDepartmentIds } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteForm, type DepartmentOption } from "./invite-form";
import type { AppRole } from "@/types/database";

export default async function NewEmployeePage() {
  const caller = await requireRole(["super_admin", "team_leader"]);
  const t = await getTranslations("employees");
  const admin = createAdminClient();

  const isSuperAdmin = caller.profile.role === "super_admin";

  // Super admins may assign any role and any department; team leaders may only
  // invite team members into departments they manage.
  const roleOptions: AppRole[] = isSuperAdmin
    ? ["super_admin", "team_leader", "team_member"]
    : ["team_member"];

  let departments: DepartmentOption[] = [];
  if (isSuperAdmin) {
    const { data } = await admin
      .from("departments")
      .select("id, name_ar, name")
      .order("name_ar");
    departments = (data ?? []).map((d) => ({
      id: d.id,
      label: d.name_ar || d.name,
    }));
  } else {
    const managedIds = await getManagedDepartmentIds(caller.id);
    if (managedIds.length) {
      const { data } = await admin
        .from("departments")
        .select("id, name_ar, name")
        .in("id", managedIds)
        .order("name_ar");
      departments = (data ?? []).map((d) => ({
        id: d.id,
        label: d.name_ar || d.name,
      }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("inviteTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("inviteSubtitle")}</p>
      </div>
      <InviteForm roleOptions={roleOptions} departments={departments} />
    </div>
  );
}
