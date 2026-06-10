import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { requireRole } from "@/lib/auth";
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
import { deleteDepartment } from "./actions";

export default async function DepartmentsPage() {
  const { profile } = await requireRole(["super_admin"]);
  const t = await getTranslations("departments");
  const tc = await getTranslations("common");
  const admin = createAdminClient();

  const { data: departments } = await admin
    .from("departments")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("name_ar");
  const rows = departments ?? [];

  // Manager names + member counts.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, arabic_name, full_name")
    .eq("org_id", profile.org_id);
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.arabic_name || p.full_name || "—"]),
  );
  const { data: members } = await admin
    .from("department_members")
    .select("department_id");
  const memberCount = new Map<string, number>();
  (members ?? []).forEach((m) => {
    memberCount.set(m.department_id, (memberCount.get(m.department_id) ?? 0) + 1);
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href="/departments/new"
          className={buttonVariants({ className: "gap-2" })}
        >
          <Plus className="size-4" />
          {t("create")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("nameAr")}</TableHead>
                <TableHead>{t("manager")}</TableHead>
                <TableHead>{t("memberCount")}</TableHead>
                <TableHead className="text-end">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {d.color ? (
                        <span
                          className="inline-block size-3 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                      ) : null}
                      <span className="font-medium">{d.name_ar}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.manager_id ? (
                      nameById.get(d.manager_id) ?? "—"
                    ) : (
                      <span className="text-muted-foreground">
                        {t("noManager")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{memberCount.get(d.id) ?? 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/departments/${d.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                          className: "gap-2",
                        })}
                      >
                        <Pencil className="size-4" />
                        {tc("edit")}
                      </Link>
                      <ConfirmDelete
                        action={deleteDepartment}
                        hidden={{ id: d.id }}
                        message={t("deleteConfirm")}
                      />
                    </div>
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
