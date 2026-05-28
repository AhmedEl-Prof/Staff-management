import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
import type { ProjectStatus } from "@/types/database";

const statusVariant: Record<
  ProjectStatus,
  "default" | "success" | "muted" | "secondary" | "destructive"
> = {
  planning: "secondary",
  active: "success",
  on_hold: "muted",
  completed: "default",
  cancelled: "destructive",
};

export default async function ProjectsPage() {
  const { profile } = await requireUser();
  const t = await getTranslations("projects");
  const tStatus = await getTranslations("projectStatus");
  const tPriority = await getTranslations("priority");

  // RLS scopes the result to projects the caller can access.
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  const rows = projects ?? [];

  // Department names (not sensitive) via the admin client.
  const deptIds = [...new Set(rows.map((p) => p.department_id))];
  const admin = createAdminClient();
  const { data: depts } = deptIds.length
    ? await admin
        .from("departments")
        .select("id, name_ar, name")
        .in("id", deptIds)
    : { data: [] };
  const deptName = new Map(
    (depts ?? []).map((d) => [d.id, d.name_ar || d.name]),
  );

  const canCreate =
    profile.role === "super_admin" || profile.role === "team_leader";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreate ? (
          <Link
            href="/projects/new"
            className={buttonVariants({ className: "gap-2" })}
          >
            <Plus className="size-4" />
            {t("create")}
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("department")}</TableHead>
                <TableHead>{t("client")}</TableHead>
                <TableHead>{t("priority")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name_ar || p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {deptName.get(p.department_id) ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.client_name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tPriority(p.priority)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[p.status]}>
                      {tStatus(p.status)}
                    </Badge>
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
