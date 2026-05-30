import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds, isCompanyWide } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  monthStart,
  monthValue,
  getDepartmentEmployees,
  buildBonusSheet,
} from "@/lib/bonus-awards";
import { AwardEditor } from "../award-editor";
import { setBonusStatus } from "../award-actions";
import type {
  BonusItemRow,
  BonusAwardRow,
  BonusPeriodRow,
  BonusStatus,
} from "@/types/database";

function StatusBadge({ status, label }: { status: BonusStatus; label: string }) {
  const styles: Record<BonusStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    approved: "bg-primary/10 text-primary",
    paid: "bg-green-100 text-green-700",
  };
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", styles[status])}>
      {label}
    </span>
  );
}

export default async function BonusAwardsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; dept?: string; emp?: string }>;
}) {
  const { id: userId, profile } = await requireUser();
  const t = await getTranslations("bonus");
  const admin = createAdminClient();

  const { month, dept, emp } = await searchParams;
  const period = monthStart(month);
  const monthVal = monthValue(period);
  const statusLabel = (s: BonusStatus) =>
    s === "approved"
      ? t("status_approved")
      : s === "paid"
        ? t("status_paid")
        : t("status_draft");

  // -- Departments this user manages (super admins / HR manage all) -----------
  const managedIds = await getManagedDepartmentIds(userId);
  let managerDeptIds: string[];
  if (isCompanyWide(profile.role)) {
    const { data } = await admin.from("departments").select("id");
    managerDeptIds = (data ?? []).map((d) => d.id);
  } else {
    managerDeptIds = managedIds;
  }
  const { data: managerDeptRows } = await admin
    .from("departments")
    .select("id, name, name_ar")
    .in("id", managerDeptIds.length ? managerDeptIds : ["00000000-0000-0000-0000-000000000000"])
    .order("name_ar");
  const managerDepts = managerDeptIds.length ? (managerDeptRows ?? []) : [];
  const isManager = managerDepts.length > 0;
  const selectedDept =
    managerDepts.find((d) => d.id === dept) ?? managerDepts[0] ?? null;

  // -- The caller's own bonus for the month ("بونصي") -------------------------
  const { data: myMemberships } = await admin
    .from("department_members")
    .select("department_id")
    .eq("user_id", userId)
    .limit(1);
  const myDeptId = myMemberships?.[0]?.department_id ?? null;

  let mySheet = null as ReturnType<typeof buildBonusSheet> | null;
  if (myDeptId) {
    const [{ data: items }, { data: awards }, { data: periodRow }] =
      await Promise.all([
        admin
          .from("bonus_items")
          .select("*")
          .eq("department_id", myDeptId)
          .order("sort_order"),
        admin
          .from("bonus_awards")
          .select("*")
          .eq("user_id", userId)
          .eq("period", period),
        admin
          .from("bonus_periods")
          .select("*")
          .eq("user_id", userId)
          .eq("period", period)
          .maybeSingle(),
      ]);
    if ((items ?? []).length > 0) {
      mySheet = buildBonusSheet(
        (items ?? []) as BonusItemRow[],
        (awards ?? []) as BonusAwardRow[],
        (periodRow ?? null) as BonusPeriodRow | null,
      );
    }
  }

  const linkWith = (params: Record<string, string>) => {
    const sp = new URLSearchParams({ month: monthVal });
    if (selectedDept) sp.set("dept", selectedDept.id);
    Object.entries(params).forEach(([k, v]) => sp.set(k, v));
    return `/bonus/awards?${sp.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("awardsTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("awardsSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/bonus" className="text-primary text-sm hover:underline">
            {t("backToStructure")}
          </Link>
          <form method="get" className="flex items-end gap-2">
            {selectedDept ? (
              <input type="hidden" name="dept" value={selectedDept.id} />
            ) : null}
            <input
              type="month"
              name="month"
              defaultValue={monthVal}
              dir="ltr"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            />
            <Button type="submit" size="sm" variant="secondary">
              {t("view")}
            </Button>
          </form>
        </div>
      </div>

      {/* My bonus */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("myBonus")}</h2>
        {mySheet ? (
          <div className="flex max-w-xl flex-col gap-2 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{monthVal}</span>
              <StatusBadge
                status={mySheet.status}
                label={statusLabel(mySheet.status)}
              />
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {mySheet.lines.map((l) => (
                <li key={l.item.id} className="flex justify-between">
                  <span>
                    {l.item.item}{" "}
                    <span className="text-muted-foreground">
                      ({l.achievementPercent}%)
                    </span>
                  </span>
                  <span className="font-medium">
                    {l.amount} {t("egp")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t pt-2 font-bold">
              <span>{t("total")}</span>
              <span>
                {mySheet.total} {t("egp")}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("noMyBonus")}</p>
        )}
      </section>

      {/* Manager calculator */}
      {isManager && selectedDept ? (
        <ManagerSection
          selectedDeptId={selectedDept.id}
          managerDepts={managerDepts}
          monthVal={monthVal}
          period={period}
          emp={emp}
          linkWith={linkWith}
          t={t}
          statusLabel={statusLabel}
        />
      ) : null}
    </div>
  );
}

async function ManagerSection({
  selectedDeptId,
  managerDepts,
  monthVal,
  period,
  emp,
  linkWith,
  t,
  statusLabel,
}: {
  selectedDeptId: string;
  managerDepts: { id: string; name: string; name_ar: string }[];
  monthVal: string;
  period: string;
  emp?: string;
  linkWith: (params: Record<string, string>) => string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  statusLabel: (s: BonusStatus) => string;
}) {
  const admin = createAdminClient();
  const employees = await getDepartmentEmployees(selectedDeptId);

  const [{ data: periodRows }, { data: awardRows }, { data: itemRows }] =
    await Promise.all([
      admin
        .from("bonus_periods")
        .select("*")
        .eq("department_id", selectedDeptId)
        .eq("period", period),
      admin
        .from("bonus_awards")
        .select("*")
        .eq("department_id", selectedDeptId)
        .eq("period", period),
      admin
        .from("bonus_items")
        .select("*")
        .eq("department_id", selectedDeptId)
        .order("sort_order"),
    ]);

  const items = (itemRows ?? []) as BonusItemRow[];
  const awards = (awardRows ?? []) as BonusAwardRow[];
  const statusByUser = new Map<string, BonusStatus>(
    (periodRows ?? []).map((p) => [p.user_id, p.status as BonusStatus]),
  );
  const totalByUser = new Map<string, number>();
  awards.forEach((a) =>
    totalByUser.set(a.user_id, (totalByUser.get(a.user_id) ?? 0) + Number(a.amount)),
  );

  const selectedEmp = emp && employees.some((e) => e.id === emp) ? emp : null;
  const selectedEmpName = employees.find((e) => e.id === selectedEmp)?.label;
  const empInitial: Record<string, number> = {};
  if (selectedEmp) {
    awards
      .filter((a) => a.user_id === selectedEmp)
      .forEach((a) => {
        empInitial[a.bonus_item_id] = Number(a.achievement_percent);
      });
  }
  const selectedStatus: BonusStatus = selectedEmp
    ? (statusByUser.get(selectedEmp) ?? "draft")
    : "draft";

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("teamBonus")}</h2>

      {managerDepts.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {managerDepts.map((d) => (
            <Link
              key={d.id}
              href={`/bonus/awards?month=${monthVal}&dept=${d.id}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium",
                d.id === selectedDeptId
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {d.name_ar || d.name}
            </Link>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noItemsForAwards")}</p>
      ) : employees.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noEmployees")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60">
                <th className="px-3 py-2.5 text-start font-medium">
                  {t("employee")}
                </th>
                <th className="px-3 py-2.5 text-start font-medium">
                  {t("total")}
                </th>
                <th className="px-3 py-2.5 text-start font-medium">
                  {t("statusLabel")}
                </th>
                <th className="px-3 py-2.5 text-start font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const status = statusByUser.get(e.id) ?? "draft";
                return (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{e.label}</td>
                    <td className="px-3 py-2">
                      {totalByUser.get(e.id) ?? 0} {t("egp")}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={status} label={statusLabel(status)} />
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Link
                        href={linkWith({ emp: e.id })}
                        className="text-primary hover:underline"
                      >
                        {t("editAchievement")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor for the selected employee */}
      {selectedEmp && items.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">
              {selectedEmpName} — {monthVal}
            </h3>
            <div className="flex items-center gap-2">
              <StatusBadge status={selectedStatus} label={statusLabel(selectedStatus)} />
              {selectedStatus !== "approved" ? (
                <StatusForm
                  deptId={selectedDeptId}
                  userId={selectedEmp}
                  month={monthVal}
                  status="approved"
                  label={t("approve")}
                />
              ) : null}
              {selectedStatus === "approved" ? (
                <StatusForm
                  deptId={selectedDeptId}
                  userId={selectedEmp}
                  month={monthVal}
                  status="paid"
                  label={t("markPaid")}
                />
              ) : null}
              {selectedStatus !== "draft" ? (
                <StatusForm
                  deptId={selectedDeptId}
                  userId={selectedEmp}
                  month={monthVal}
                  status="draft"
                  label={t("revertDraft")}
                  variant="ghost"
                />
              ) : null}
            </div>
          </div>
          <AwardEditor
            departmentId={selectedDeptId}
            userId={selectedEmp}
            month={monthVal}
            items={items}
            initial={empInitial}
          />
        </div>
      ) : null}
    </section>
  );
}

function StatusForm({
  deptId,
  userId,
  month,
  status,
  label,
  variant = "secondary",
}: {
  deptId: string;
  userId: string;
  month: string;
  status: BonusStatus;
  label: string;
  variant?: "secondary" | "ghost";
}) {
  return (
    <form action={setBonusStatus}>
      <input type="hidden" name="department_id" value={deptId} />
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  );
}
