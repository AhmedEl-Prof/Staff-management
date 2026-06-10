import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  FolderKanban,
  CheckSquare,
  Users,
  Bell,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeVisibleWorkloads } from "@/lib/workload";
import { getAttentionItems } from "@/lib/attention";
import { WorkloadWidget } from "@/components/workload-widget";
import { Badge } from "@/components/ui/badge";
import type { TaskRow, TaskStatus } from "@/types/database";

const ACTIVE_TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "review"];

export default async function DashboardPage() {
  const { id: userId, profile, email } = await requireUser();
  const t = await getTranslations("dashboard");
  const tRoles = await getTranslations("roles");
  const tPriority = await getTranslations("priority");
  const tStatus = await getTranslations("taskStatus");
  const tAttention = await getTranslations("attention");

  const displayName = profile.arabic_name || profile.full_name || email;
  const isManager =
    profile.role === "super_admin" || profile.role === "team_leader";

  const supabase = await createClient();
  const admin = createAdminClient();

  // KPI queries run in parallel. Project + task reads go through the RLS
  // client so they're naturally scoped to what the user can see.
  const [
    { count: activeProjects },
    { data: myTasksData },
    { count: unread },
    workloads,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", userId)
      .in("status", ACTIVE_TASK_STATUSES)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false),
    isManager
      ? computeVisibleWorkloads(profile)
      : Promise.resolve([]),
  ]);

  const myTasks = (myTasksData ?? []) as TaskRow[];
  const attention = await getAttentionItems(userId, profile);

  // Team member count (managers only — uses admin client for cross-user count).
  let teamCount = 0;
  if (isManager) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id)
      .eq("is_active", true);
    teamCount = count ?? 0;
  }

  const cards = [
    {
      key: "activeProjects",
      label: t("activeProjects"),
      value: activeProjects ?? 0,
      icon: FolderKanban,
      tint: "260",
    },
    {
      key: "myOpenTasks",
      label: t("myOpenTasks"),
      value: myTasks.length,
      icon: CheckSquare,
      tint: "80",
    },
    ...(isManager
      ? [
          {
            key: "teamMembers",
            label: t("teamMembers"),
            value: teamCount,
            icon: Users,
            tint: "145",
          },
        ]
      : []),
    {
      key: "unread",
      label: t("unreadNotifications"),
      value: unread ?? 0,
      icon: Bell,
      tint: "25",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          {t("welcome")}، {displayName} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle")} · {tRoles(profile.role)}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <div
                  className="flex size-9 items-center justify-center rounded-md"
                  style={{
                    background: `oklch(0.94 0.05 ${c.tint})`,
                    color: `oklch(0.45 0.16 ${c.tint})`,
                  }}
                >
                  <Icon className="size-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold">{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Needs attention */}
      {attention.length > 0 ? (
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <AlertCircle className="size-4 text-amber-500" />
            {tAttention("title")}
          </h2>
          <div className="flex flex-wrap gap-3">
            {attention.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="hover:bg-muted/60 flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
              >
                <span className="bg-amber-100 text-amber-700 flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold dark:bg-amber-500/15 dark:text-amber-400">
                  {item.count}
                </span>
                <span className="text-sm font-medium">
                  {tAttention(item.labelKey)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* My tasks */}
        <div
          className={`rounded-xl border bg-card ${isManager ? "lg:col-span-2" : "lg:col-span-3"}`}
        >
          <div className="flex items-center justify-between border-b p-5">
            <h2 className="text-base font-semibold">{t("myTasks")}</h2>
          </div>
          {myTasks.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">{t("noTasks")}</p>
          ) : (
            <ul className="divide-y">
              {myTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/projects/${task.project_id}/tasks/${task.id}`}
                    className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium">{task.title}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {tStatus(task.status)}
                        </Badge>
                        <Badge variant="outline">
                          {tPriority(task.priority)}
                        </Badge>
                      </div>
                    </div>
                    {task.due_date ? (
                      <span
                        className="shrink-0 text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {t("dueOn")}: {task.due_date}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Workload (managers only) */}
        {isManager ? <WorkloadWidget workloads={workloads} /> : null}
      </div>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <TrendingUp className="size-3" />
        {t("subtitle")}
      </p>
    </div>
  );
}
