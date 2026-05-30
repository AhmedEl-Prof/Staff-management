import { getTranslations } from "next-intl/server";
import { Clock, LogIn, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManageableEmployees } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { CsvExportButton } from "@/components/csv-export-button";
import { checkIn, checkOut } from "./actions";
import type { AttendanceRow } from "@/types/database";

function fmtTime(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("ar-EG", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function duration(row: Pick<AttendanceRow, "check_in" | "check_out">): string {
  if (!row.check_in || !row.check_out) return "—";
  const ms = new Date(row.check_out).getTime() - new Date(row.check_in).getTime();
  if (ms <= 0) return "—";
  const mins = Math.round(ms / 60000);
  return `${Math.floor(mins / 60)}س ${mins % 60}د`;
}

export default async function AttendancePage() {
  const { id: userId, profile } = await requireUser();
  const t = await getTranslations("attendance");
  const admin = createAdminClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [{ data: todayRow }, { data: recent }] = await Promise.all([
    admin
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .maybeSingle(),
    admin
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(14),
  ]);

  const checkedIn = !!todayRow?.check_in;
  const checkedOut = !!todayRow?.check_out;

  // Manager: today's attendance for the team.
  const manageable = await getManageableEmployees(profile);
  const isManager = manageable.length > 0;
  const nameById = new Map(manageable.map((m) => [m.id, m.label]));
  let teamToday: AttendanceRow[] = [];
  if (isManager) {
    const ids = manageable.map((m) => m.id);
    const { data } = await admin
      .from("attendance")
      .select("*")
      .in("user_id", ids)
      .eq("date", todayStr);
    teamToday = (data ?? []) as AttendanceRow[];
  }
  const teamByUser = new Map(teamToday.map((r) => [r.user_id, r]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {/* Today */}
      <section className="flex flex-col gap-3 rounded-lg border p-5">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Clock className="size-4" />
          {t("today")} · <span dir="ltr">{todayStr}</span>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-muted-foreground text-xs">{t("checkIn")}</p>
            <p className="text-lg font-bold" dir="ltr">{fmtTime(todayRow?.check_in ?? null)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("checkOut")}</p>
            <p className="text-lg font-bold" dir="ltr">{fmtTime(todayRow?.check_out ?? null)}</p>
          </div>
          {checkedIn && checkedOut ? (
            <div>
              <p className="text-muted-foreground text-xs">{t("worked")}</p>
              <p className="text-lg font-bold">{duration(todayRow!)}</p>
            </div>
          ) : null}
          <div className="ms-auto">
            {!checkedIn ? (
              <form action={checkIn}>
                <Button type="submit" className="gap-2">
                  <LogIn className="size-4" />
                  {t("doCheckIn")}
                </Button>
              </form>
            ) : !checkedOut ? (
              <form action={checkOut}>
                <Button type="submit" variant="secondary" className="gap-2">
                  <LogOut className="size-4" />
                  {t("doCheckOut")}
                </Button>
              </form>
            ) : (
              <span className="text-muted-foreground text-sm">{t("doneToday")}</span>
            )}
          </div>
        </div>
      </section>

      {/* My recent */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("recent")}</h2>
          <CsvExportButton
            filename={`attendance-${todayStr}`}
            headers={[t("date"), t("checkIn"), t("checkOut"), t("worked")]}
            rows={(recent ?? []).map((r) => [
              r.date,
              fmtTime(r.check_in),
              fmtTime(r.check_out),
              duration(r),
            ])}
          />
        </div>
        {(recent ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noRecords")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60">
                  <th className="px-3 py-2.5 text-start font-medium">{t("date")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("checkIn")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("checkOut")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("worked")}</th>
                </tr>
              </thead>
              <tbody>
                {(recent ?? []).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2" dir="ltr">{r.date}</td>
                    <td className="px-3 py-2" dir="ltr">{fmtTime(r.check_in)}</td>
                    <td className="px-3 py-2" dir="ltr">{fmtTime(r.check_out)}</td>
                    <td className="px-3 py-2">{duration(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Manager: team today */}
      {isManager ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("teamToday")}</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60">
                  <th className="px-3 py-2.5 text-start font-medium">{t("employee")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("checkIn")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("checkOut")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("statusCol")}</th>
                </tr>
              </thead>
              <tbody>
                {manageable.map((m) => {
                  const row = teamByUser.get(m.id);
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{nameById.get(m.id)}</td>
                      <td className="px-3 py-2" dir="ltr">{fmtTime(row?.check_in ?? null)}</td>
                      <td className="px-3 py-2" dir="ltr">{fmtTime(row?.check_out ?? null)}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row?.check_in ? t("present") : t("absent")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
