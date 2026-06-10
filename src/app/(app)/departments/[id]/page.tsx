import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmployeeOptions } from "@/lib/employee-options";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import { DepartmentForm } from "../department-form";
import {
  updateDepartment,
  addDepartmentMember,
  removeDepartmentMember,
} from "../actions";
import type { DepartmentRow } from "@/types/database";

export default async function EditDepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireRole(["super_admin"]);
  const { id } = await params;
  const t = await getTranslations("departments");
  const tRoles = await getTranslations("roles");
  const tc = await getTranslations("common");
  const admin = createAdminClient();

  const { data: department } = await admin
    .from("departments")
    .select("*")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .single();
  if (!department) notFound();

  const employees = await getEmployeeOptions(profile.org_id);
  const nameById = new Map(employees.map((e) => [e.id, e.label]));

  const { data: memberRows } = await admin
    .from("department_members")
    .select("id, user_id, role")
    .eq("department_id", id);
  const members = memberRows ?? [];

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t("editTitle")}</h1>
      </div>

      <DepartmentForm
        action={updateDepartment}
        department={department as DepartmentRow}
        employees={employees}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("members")}</h2>

        <div className="flex flex-col gap-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {nameById.get(m.user_id) ?? m.user_id}
                  </span>
                  <Badge variant="secondary">
                    {m.role === "manager"
                      ? tRoles("team_leader")
                      : tRoles("team_member")}
                  </Badge>
                </div>
                <ConfirmDelete
                  action={removeDepartmentMember}
                  hidden={{ id: m.id, department_id: id }}
                  message={tc("delete")}
                  label={tc("remove")}
                />
              </div>
            ))
          )}
        </div>

        <form
          action={addDepartmentMember}
          className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/40 p-4"
        >
          <input type="hidden" name="department_id" value={id} />
          <div className="flex min-w-48 flex-1 flex-col gap-2">
            <Label htmlFor="user_id">{t("selectEmployee")}</Label>
            <Select id="user_id" name="user_id" required defaultValue="">
              <option value="" disabled>
                {t("selectEmployee")}
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex w-40 flex-col gap-2">
            <Label htmlFor="role">{t("manager")}</Label>
            <Select id="role" name="role" defaultValue="member">
              <option value="member">{tRoles("team_member")}</option>
              <option value="manager">{tRoles("team_leader")}</option>
            </Select>
          </div>
          <Button type="submit" className="gap-2">
            {tc("add")}
          </Button>
        </form>
      </section>
    </div>
  );
}
