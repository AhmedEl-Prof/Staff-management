import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds, getManageableEmployees } from "@/lib/permissions";
import { zoneFor, type WorkloadZone } from "@/lib/workload";
import { weekStart, weekEnd, weekDays, addDays } from "@/lib/timesheet";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AiPanel } from "@/components/ai-panel";
import { CsvExportButton } from "@/components/csv-export-button";
import { aiConfigured } from "@/lib/ai";
import { TimeLogForm } from "./time-log-form";
import { deleteTimeLog } from "./actions";
import { weeklyDigest } from "./ai-actions";

const DEFAULT_CAPACITY = 40;

const zoneBar: Record<WorkloadZone, string> = {
  green: "bg-green-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

function clampToday(start: string, end: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (today < start) return start;
  if (today > end) return end;
  return today;
}

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { id: userId, profile } = await requireUser();
  const t = await getTranslations("timesheet");
  const tAi = await getTranslations("ai");
  const locale = await getLocale();
  const admin = createAdminClient();

  const { week } = await searchParams;
  const start = weekStart(week);
  const end = weekEnd(start);
  const days = weekDays(start);
  const weekday = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, {
      weekday: "long",
      timeZone: "UTC",
    });

  // -- Tasks the caller can log against --------------------------------------
  const { data: memberRows } = await admin
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);
  const managedDeptIds = await getManagedDepartmentIds(userId);
  let managedProjectIds: string[] = [];
  if (managedDeptIds.length) {
    const { data } = await admin
      .from("projects")
      .select("id")
      .in("department_id", managedDeptIds);
    managedProjectIds = (data ?? []).map((p) => p.id);
  }
  const projectIds = [
    ...new Set([
      ...(memberRows ?? []).map((r) => r.project_id),
      ...managedProjectIds,
    ]),
  ];

  const taskMap = new Map<string, { title: string; project_id: string }>();
  if (projectIds.length) {
    const { data } = await admin
      .from("tasks")
      .select("id, title, project_id, status")
      .in("project_id", projectIds)
      .neq("status", "cancelled");
    (data ?? []).forEach((tk) => taskMap.set(tk.id, tk));
  }
  const { data: assignedTasks } = await admin
    .from("tasks")
    .select("id, title, project_id, status")
    .eq("assigned_to", userId)
    .neq("status", "cancelled");
  (assignedTasks ?? []).forEach((tk) => taskMap.set(tk.id, tk));

  // Project names for nice labels.
  const allProjectIds = [
    ...new Set([...taskMap.values()].map((tk) => tk.project_id)),
  ];
  const projectName = new Map<string, string>();
  if (allProjectIds.length) {
    const { data } = await admin
      .from("projects")
      .select("id, name, name_ar")
      .in("id", allProjectIds);
    (data ?? []).forEach((p) => projectName.set(p.id, p.name_ar || p.name));
  }
  const taskOptions = [...taskMap.entries()]
    .map(([id, tk]) => ({
      id,
      label: `${tk.title} — ${projectName.get(tk.project_id) ?? ""}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // -- My entries this week ---------------------------------------------------
  const { data: logs } = await admin
    .from("time_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("logged_date", start)
    .lte("logged_date", end)
    .order("logged_date");
  const myLogs = logs ?? [];

  const logsByDay = new Map<string, typeof myLogs>();
  days.forEach((d) => logsByDay.set(d, []));
  myLogs.forEach((l) => {
    logsByDay.get(l.logged_date)?.push(l);
  });
  const weekTotal = myLogs.reduce((s, l) => s + Number(l.hours), 0);
  const capacity = Number(profile.weekly_hours) || DEFAULT_CAPACITY;
  const percent = capacity > 0 ? Math.round((weekTotal / capacity) * 100) : 0;

  // -- Manager: team utilization ---------------------------------------------
  const manageable = await getManageableEmployees(profile);
  const isManager = manageable.length > 0;
  let team: {
    id: string;
    label: string;
    logged: number;
    capacity: number;
    percent: number;
    zone: WorkloadZone;
  }[] = [];
  if (isManager) {
    const ids = manageable.map((m) => m.id);
    const [{ data: teamLogs }, { data: caps }] = await Promise.all([
      admin
        .from("time_logs")
        .select("user_id, hours")
        .in("user_id", ids)
        .gte("logged_date", start)
        .lte("logged_date", end),
      admin.from("profiles").select("id, weekly_hours").in("id", ids),
    ]);
    const loggedByUser = new Map<string, number>();
    (teamLogs ?? []).forEach((l) => {
      if (l.user_id)
        loggedByUser.set(l.user_id, (loggedByUser.get(l.user_id) ?? 0) + Number(l.hours));
    });
    const capByUser = new Map(
      (caps ?? []).map((c) => [c.id, Number(c.weekly_hours) || DEFAULT_CAPACITY]),
    );
    team = manageable.map((m) => {
      const logged = loggedByUser.get(m.id) ?? 0;
      const cap = capByUser.get(m.id) ?? DEFAULT_CAPACITY;
      const pct = cap > 0 ? Math.round((logged / cap) * 100) : 0;
      return { id: m.id, label: m.label, logged, capacity: cap, percent: pct, zone: zoneFor(pct) };
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/timesheet?week=${addDays(start, -7)}`}
            className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md border"
            aria-label={t("prevWeek")}
          >
            <ChevronRight className="size-4" />
          </Link>
          <span className="text-sm font-medium" dir="ltr">
            {start} → {end}
          </span>
          <Link
            href={`/timesheet?week=${addDays(start, 7)}`}
            className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md border"
            aria-label={t("nextWeek")}
          >
            <ChevronLeft className="size-4" />
          </Link>
        </div>
      </div>

      {/* Utilization */}
      <section className="flex flex-col gap-2 rounded-lg border p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{t("utilization")}</span>
          <span className="text-muted-foreground">
            {weekTotal} / {capacity} {t("hoursShort")} · {percent}%
          </span>
        </div>
        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full", zoneBar[zoneFor(percent)])}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      </section>

      {/* AI weekly digest */}
      {aiConfigured() ? (
        <AiPanel
          action={weeklyDigest}
          title={t("aiDigestTitle")}
          cta={tAi("generate")}
        />
      ) : null}

      {/* Log time */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("logTime")}</h2>
        <TimeLogForm
          tasks={taskOptions}
          weekStart={start}
          weekEnd={end}
          defaultDate={clampToday(start, end)}
        />
      </section>

      {/* Week entries */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("entries")}</h2>
          <CsvExportButton
            filename={`timesheet-${start}`}
            headers={[t("date"), t("task"), t("note"), t("hours")]}
            rows={myLogs.map((l) => [
              l.logged_date,
              taskMap.get(l.task_id)?.title ?? "",
              l.description ?? "",
              Number(l.hours),
            ])}
          />
        </div>
        <div className="flex flex-col gap-3">
          {days.map((d) => {
            const dayLogs = logsByDay.get(d) ?? [];
            const dayTotal = dayLogs.reduce((s, l) => s + Number(l.hours), 0);
            return (
              <div key={d} className="rounded-lg border">
                <div className="bg-muted/50 flex items-center justify-between px-3 py-2 text-sm font-medium">
                  <span>
                    {weekday(d)} <span className="text-muted-foreground" dir="ltr">· {d}</span>
                  </span>
                  <span>{dayTotal} {t("hoursShort")}</span>
                </div>
                {dayLogs.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-2 text-sm">—</p>
                ) : (
                  <ul className="divide-y">
                    {dayLogs.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium">
                            {taskMap.get(l.task_id)?.title ?? t("task")}
                          </span>
                          {l.description ? (
                            <span className="text-muted-foreground"> — {l.description}</span>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-semibold">{Number(l.hours)} {t("hoursShort")}</span>
                          <form action={deleteTimeLog}>
                            <input type="hidden" name="id" value={l.id} />
                            <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                              {t("remove")}
                            </Button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <div className="flex justify-between rounded-lg border bg-muted/40 px-3 py-2.5 font-bold">
            <span>{t("weekTotal")}</span>
            <span>{weekTotal} {t("hoursShort")}</span>
          </div>
        </div>
      </section>

      {/* Manager: team utilization */}
      {isManager ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("teamUtilization")}</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60">
                  <th className="px-3 py-2.5 text-start font-medium">{t("employee")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("logged")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("utilization")}</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{m.label}</td>
                    <td className="px-3 py-2">
                      {m.logged} / {m.capacity} {t("hoursShort")}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="bg-muted h-2 w-28 overflow-hidden rounded-full">
                          <div
                            className={cn("h-full rounded-full", zoneBar[m.zone])}
                            style={{ width: `${Math.min(100, m.percent)}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground">{m.percent}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
