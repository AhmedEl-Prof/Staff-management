import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManageableEmployees } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEFAULT_QUOTAS, LEAVE_TYPES, currentYear } from "@/lib/leave";
import { LeaveRequestForm } from "./leave-request-form";
import {
  cancelLeaveRequest,
  reviewLeaveRequest,
  saveLeaveBalance,
} from "./actions";
import type { LeaveRequestRow, LeaveStatus, LeaveType } from "@/types/database";

function StatusBadge({
  status,
  label,
}: {
  status: LeaveStatus;
  label: string;
}) {
  const styles: Record<LeaveStatus, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", styles[status])}>
      {label}
    </span>
  );
}

export default async function LeavePage() {
  const { id: userId, profile } = await requireUser();
  const t = await getTranslations("leave");
  const admin = createAdminClient();
  const year = currentYear();

  const typeLabel = (lt: LeaveType) =>
    lt === "annual" ? t("type_annual") : lt === "sick" ? t("type_sick") : t("type_casual");
  const statusLabel = (s: LeaveStatus) =>
    s === "approved"
      ? t("status_approved")
      : s === "rejected"
        ? t("status_rejected")
        : s === "cancelled"
          ? t("status_cancelled")
          : t("status_pending");

  // -- My balances & requests -------------------------------------------------
  const [{ data: balanceRow }, { data: myRequests }] = await Promise.all([
    admin
      .from("leave_balances")
      .select("*")
      .eq("user_id", userId)
      .eq("year", year)
      .maybeSingle(),
    admin
      .from("leave_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const quotas: Record<LeaveType, number> = {
    annual: Number(balanceRow?.annual_quota ?? DEFAULT_QUOTAS.annual),
    sick: Number(balanceRow?.sick_quota ?? DEFAULT_QUOTAS.sick),
    casual: Number(balanceRow?.casual_quota ?? DEFAULT_QUOTAS.casual),
  };
  const used: Record<LeaveType, number> = { annual: 0, sick: 0, casual: 0 };
  (myRequests ?? [])
    .filter((r) => r.status === "approved" && r.start_date.slice(0, 4) === String(year))
    .forEach((r) => {
      used[r.type as LeaveType] += Number(r.days);
    });

  // -- Manager: team requests + balances -------------------------------------
  const manageable = await getManageableEmployees(profile);
  const isManager = manageable.length > 0;
  const nameById = new Map(manageable.map((m) => [m.id, m.label]));
  let teamRequests: LeaveRequestRow[] = [];
  if (isManager) {
    const ids = manageable.map((m) => m.id).filter((id) => id !== userId);
    if (ids.length > 0) {
      const { data } = await admin
        .from("leave_requests")
        .select("*")
        .in("user_id", ids)
        .order("created_at", { ascending: false });
      teamRequests = (data ?? []) as LeaveRequestRow[];
    }
  }
  const pendingTeam = teamRequests.filter((r) => r.status === "pending");
  const reviewedTeam = teamRequests.filter((r) => r.status !== "pending");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {/* Balances */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {LEAVE_TYPES.map((lt) => {
          const remaining = quotas[lt] - used[lt];
          return (
            <div key={lt} className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">{typeLabel(lt)}</p>
              <p className="mt-1 text-2xl font-bold">
                {remaining}
                <span className="text-muted-foreground text-sm font-normal">
                  {" "}/ {quotas[lt]} {t("days")}
                </span>
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {t("used")}: {used[lt]}
              </p>
            </div>
          );
        })}
      </section>

      {/* New request */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("newRequest")}</h2>
        <LeaveRequestForm />
      </section>

      {/* My requests */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("myRequests")}</h2>
        {(myRequests ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noRequests")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60">
                  <th className="px-3 py-2.5 text-start font-medium">{t("type")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("dates")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("daysCol")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("statusCol")}</th>
                  <th className="px-3 py-2.5 text-start font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(myRequests ?? []).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{typeLabel(r.type as LeaveType)}</td>
                    <td className="px-3 py-2" dir="ltr">
                      {r.start_date} → {r.end_date}
                    </td>
                    <td className="px-3 py-2">{Number(r.days)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        status={r.status as LeaveStatus}
                        label={statusLabel(r.status as LeaveStatus)}
                      />
                    </td>
                    <td className="px-3 py-2 text-end">
                      {r.status === "pending" ? (
                        <form action={cancelLeaveRequest}>
                          <input type="hidden" name="id" value={r.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            {t("cancel")}
                          </Button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Manager: review team requests */}
      {isManager ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("teamRequests")}</h2>

          {pendingTeam.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noPending")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingTeam.map((r) => (
                <form
                  key={r.id}
                  action={reviewLeaveRequest}
                  className="flex flex-col gap-2 rounded-lg border p-3"
                >
                  <input type="hidden" name="id" value={r.id} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{nameById.get(r.user_id) ?? r.user_id}</span>
                      <span className="text-muted-foreground"> · {typeLabel(r.type as LeaveType)} · </span>
                      <span dir="ltr">{r.start_date} → {r.end_date}</span>
                      <span className="text-muted-foreground"> ({Number(r.days)} {t("days")})</span>
                    </div>
                  </div>
                  {r.reason ? (
                    <p className="text-muted-foreground text-sm">{r.reason}</p>
                  ) : null}
                  <div className="flex flex-wrap items-end gap-2">
                    <Input
                      name="review_note"
                      placeholder={t("notePlaceholder")}
                      className="max-w-xs flex-1"
                    />
                    <Button type="submit" name="decision" value="approved" size="sm">
                      {t("approve")}
                    </Button>
                    <Button
                      type="submit"
                      name="decision"
                      value="rejected"
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                    >
                      {t("reject")}
                    </Button>
                  </div>
                </form>
              ))}
            </div>
          )}

          {reviewedTeam.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="px-3 py-2.5 text-start font-medium">{t("employee")}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t("type")}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t("dates")}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t("statusCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewedTeam.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{nameById.get(r.user_id) ?? r.user_id}</td>
                      <td className="px-3 py-2">{typeLabel(r.type as LeaveType)}</td>
                      <td className="px-3 py-2" dir="ltr">
                        {r.start_date} → {r.end_date}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          status={r.status as LeaveStatus}
                          label={statusLabel(r.status as LeaveStatus)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* Set yearly quotas */}
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              {t("setBalances")}
            </summary>
            <form
              action={saveLeaveBalance}
              className="mt-3 flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="year" value={year} />
              <div className="flex min-w-48 flex-col gap-2">
                <Label htmlFor="bal_user">{t("employee")}</Label>
                <Select id="bal_user" name="user_id" required defaultValue="">
                  <option value="" disabled>
                    {t("selectEmployee")}
                  </option>
                  {manageable
                    .filter((m) => m.id !== userId || profile.role === "super_admin")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="flex w-28 flex-col gap-2">
                <Label htmlFor="bal_annual">{t("type_annual")}</Label>
                <Input id="bal_annual" name="annual_quota" type="number" min="0" dir="ltr" defaultValue={21} />
              </div>
              <div className="flex w-28 flex-col gap-2">
                <Label htmlFor="bal_sick">{t("type_sick")}</Label>
                <Input id="bal_sick" name="sick_quota" type="number" min="0" dir="ltr" defaultValue={7} />
              </div>
              <div className="flex w-28 flex-col gap-2">
                <Label htmlFor="bal_casual">{t("type_casual")}</Label>
                <Input id="bal_casual" name="casual_quota" type="number" min="0" dir="ltr" defaultValue={7} />
              </div>
              <Button type="submit">{t("saveBalances")}</Button>
            </form>
          </details>
        </section>
      ) : null}
    </div>
  );
}
