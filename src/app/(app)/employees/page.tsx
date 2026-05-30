import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getManagedDepartmentIds } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/confirm-delete";
import { EmployeeStatusToggle } from "./status-toggle";
import { deleteEmployee } from "./actions";
import type { ProfileRow } from "@/types/database";

export default async function EmployeesPage() {
  const caller = await requireRole(["super_admin", "team_leader", "hr"]);
  const t = await getTranslations("employees");
  const tRoles = await getTranslations("roles");
  const tc = await getTranslations("common");
  const admin = createAdminClient();

  const isSuperAdmin = caller.profile.role === "super_admin";

  // Scope the list: super admins see everyone; team leaders see members of the
  // departments they manage (plus themselves).
  let allowedUserIds: string[] | null = null;
  if (caller.profile.role === "team_leader") {
    const managedDeptIds = await getManagedDepartmentIds(caller.id);
    const { data: members } = managedDeptIds.length
      ? await admin
          .from("department_members")
          .select("user_id")
          .in("department_id", managedDeptIds)
      : { data: [] };
    allowedUserIds = [
      caller.id,
      ...(members?.map((m) => m.user_id) ?? []),
    ];
  }

  let query = admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (allowedUserIds) query = query.in("id", allowedUserIds);
  const { data: profiles } = await query;
  const rows = (profiles ?? []) as ProfileRow[];

  // Resolve department names for the listed users in two flat queries (avoids
  // relying on relational-select typing).
  const ids = rows.map((p) => p.id);
  const { data: memberRows } = ids.length
    ? await admin
        .from("department_members")
        .select("user_id, department_id")
        .in("user_id", ids)
    : { data: [] };
  const { data: depts } = await admin
    .from("departments")
    .select("id, name_ar, name");
  const deptName = new Map(
    (depts ?? []).map((d) => [d.id, d.name_ar || d.name]),
  );
  const userDepts = new Map<string, string[]>();
  (memberRows ?? []).forEach((m) => {
    const name = deptName.get(m.department_id);
    if (!name) return;
    const list = userDepts.get(m.user_id) ?? [];
    list.push(name);
    userDepts.set(m.user_id, list);
  });

  // Resolve each user's login email from auth.users (profiles doesn't store it).
  // Listed via the admin Auth API (paginated; 200/page covers the team size).
  const emailById = new Map<string, string>();
  const { data: authList } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  (authList?.users ?? []).forEach((u) => {
    if (u.email) emailById.set(u.id, u.email);
  });

  const isSelf = (target: ProfileRow) => target.id === caller.id;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href="/employees/new"
          className={buttonVariants({ className: "gap-2" })}
        >
          <UserPlus className="size-4" />
          {t("invite")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("emailColumn")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("department")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-end">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">
                      {p.arabic_name || p.full_name || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" dir="ltr">
                    {emailById.get(p.id) ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{tRoles(p.role)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {userDepts.get(p.id)?.join("، ") || t("noDepartment")}
                  </TableCell>
                  <TableCell>
                    {p.is_active ? (
                      <Badge variant="success">{t("active")}</Badge>
                    ) : (
                      <Badge variant="muted">{t("inactive")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {isSelf(p) ? (
                      <span className="text-xs text-muted-foreground">
                        {t("you")}
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <EmployeeStatusToggle
                          userId={p.id}
                          isActive={p.is_active}
                        />
                        {isSuperAdmin ? (
                          <ConfirmDelete
                            action={deleteEmployee}
                            hidden={{ user_id: p.id }}
                            message={t("deleteConfirm")}
                          />
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
