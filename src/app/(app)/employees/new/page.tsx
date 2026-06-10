import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getManagedDepartmentIds, isCompanyWide } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteForm, type DepartmentOption } from "./invite-form";
import type { AppRole } from "@/types/database";

export default async function NewEmployeePage() {
  const caller = await requireRole(["super_admin", "team_leader", "hr"]);
  const t = await getTranslations("employees");
  const admin = createAdminClient();

  const isSuperAdmin = caller.profile.role === "super_admin";
  // Super admins and HR pick from all departments; HR can assign any role
  // except super_admin; team leaders only add team members in their depts.
  const companyWide = isCompanyWide(caller.profile.role);

  const roleOptions: AppRole[] = isSuperAdmin
    ? ["super_admin", "team_leader", "team_member", "hr"]
    : caller.profile.role === "hr"
      ? ["team_leader", "team_member", "hr"]
      : ["team_member"];

  let departments: DepartmentOption[] = [];
  if (companyWide) {
    const { data } = await admin
      .from("departments")
      .select("id, name_ar, name")
      .eq("org_id", caller.profile.org_id)
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
