import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds, isCompanyWide } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { ToolsTable } from "./tools-table";
import type { DepartmentToolRow } from "@/types/database";

// Per-department tools / credentials directory. Visible to department members;
// editable by department managers (or HR / super admin).
export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const { id: userId, profile } = await requireUser();
  const t = await getTranslations("tools");
  const admin = createAdminClient();

  const managedIds = await getManagedDepartmentIds(userId);
  let visibleIds: string[];
  if (isCompanyWide(profile.role)) {
    const { data } = await admin.from("departments").select("id");
    visibleIds = (data ?? []).map((d) => d.id);
  } else {
    const { data: memberships } = await admin
      .from("department_members")
      .select("department_id")
      .eq("user_id", userId);
    const set = new Set<string>(managedIds);
    memberships?.forEach((m) => set.add(m.department_id));
    visibleIds = [...set];
  }

  if (visibleIds.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <p className="text-muted-foreground text-sm">{t("noDepartment")}</p>
      </div>
    );
  }

  const { data: deptRows } = await admin
    .from("departments")
    .select("id, name, name_ar")
    .in("id", visibleIds)
    .order("name_ar");
  const departments = deptRows ?? [];

  const { dept } = await searchParams;
  const selected = departments.find((d) => d.id === dept) ?? departments[0];
  const canManage =
    isCompanyWide(profile.role) || managedIds.includes(selected.id);

  // Read through the user client so RLS confirms department access.
  const supabase = await createClient();
  const { data: toolRows } = await supabase
    .from("department_tools")
    .select("*")
    .eq("department_id", selected.id)
    .order("sort_order")
    .order("created_at");
  const tools = (toolRows ?? []) as DepartmentToolRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {departments.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {departments.map((d) => (
            <Link
              key={d.id}
              href={`/tools?dept=${d.id}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                d.id === selected.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {d.name_ar || d.name}
            </Link>
          ))}
        </div>
      ) : null}

      {!canManage ? (
        <p className="text-muted-foreground text-sm">{t("readonlyNote")}</p>
      ) : null}

      <ToolsTable
        departmentId={selected.id}
        tools={tools}
        canManage={canManage}
      />
    </div>
  );
}
