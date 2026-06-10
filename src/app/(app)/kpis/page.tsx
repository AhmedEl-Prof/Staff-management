import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getManageableEmployees,
  getManagedDepartmentIds,
  isCompanyWide,
} from "@/lib/permissions";
import { periodRange } from "@/lib/evaluations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiLogForm, type Option } from "./kpi-log-form";

export default async function KpisPage() {
  const caller = await requireRole(["super_admin", "team_leader", "hr"]);
  const t = await getTranslations("kpis");
  const admin = createAdminClient();

  // Employees the caller may log for.
  const employees = await getManageableEmployees(caller.profile);

  // KPI catalogue: super admin sees all; team leader sees their departments'
  // KPIs plus global ones.
  const { data: allKpis } = await admin
    .from("kpi_definitions")
    .select("id, name, name_ar, unit, department_id")
    .eq("org_id", caller.profile.org_id)
    .order("name_ar");

  let kpis: Option[];
  if (isCompanyWide(caller.profile.role)) {
    kpis = (allKpis ?? []).map((k) => ({
      id: k.id,
      label: `${k.name_ar || k.name}${k.unit ? ` (${k.unit})` : ""}`,
    }));
  } else {
    const deptIds = await getManagedDepartmentIds(caller.id);
    kpis = (allKpis ?? [])
      .filter((k) => k.department_id === null || deptIds.includes(k.department_id))
      .map((k) => ({
        id: k.id,
        label: `${k.name_ar || k.name}${k.unit ? ` (${k.unit})` : ""}`,
      }));
  }

  const { start, end } = periodRange("monthly");

  // Recent logs the caller can see (RLS scopes via manages_user).
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("kpi_logs")
    .select("id, user_id, kpi_id, value, period_start, period_end, recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(20);
  const logs = recent ?? [];

  // Resolve names for the recent table.
  const kpiNameById = new Map(
    (allKpis ?? []).map((k) => [k.id, k.name_ar || k.name] as const),
  );
  const userIds = [...new Set(logs.map((l) => l.user_id))];
  const userNameById = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, arabic_name, full_name")
      .in("id", userIds);
    (profiles ?? []).forEach((p) =>
      userNameById.set(p.id, p.arabic_name || p.full_name || p.id),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <KpiLogForm
        employees={employees}
        kpis={kpis}
        defaultStart={start}
        defaultEnd={end}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("recent")}</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("selectEmployee")}</TableHead>
                  <TableHead>{t("selectKpi")}</TableHead>
                  <TableHead>{t("value")}</TableHead>
                  <TableHead>{t("periodStart")}</TableHead>
                  <TableHead>{t("periodEnd")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">
                      {userNameById.get(l.user_id) ?? l.user_id}
                    </TableCell>
                    <TableCell className="text-sm">
                      {kpiNameById.get(l.kpi_id) ?? l.kpi_id}
                    </TableCell>
                    <TableCell className="font-medium" dir="ltr">
                      {l.value}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" dir="ltr">
                      {l.period_start}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" dir="ltr">
                      {l.period_end}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
