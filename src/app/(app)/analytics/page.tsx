import { getTranslations } from "next-intl/server";
import {
  CheckCircle2,
  ListTodo,
  AlertTriangle,
  Users,
  Megaphone,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { computeAnalytics } from "@/lib/analytics";
import { fetchOrgAdsInsights, type AdsInsights } from "@/lib/meta-ads";
import { BarChart, type BarDatum } from "@/components/bar-chart";

const TASK_COLORS: Record<string, string> = {
  todo: "#64748b",
  in_progress: "#3b82f6",
  review: "#f59e0b",
  done: "#22c55e",
  cancelled: "#ef4444",
};
const PROJECT_COLORS: Record<string, string> = {
  planning: "#64748b",
  active: "#22c55e",
  on_hold: "#f59e0b",
  completed: "#3b82f6",
  cancelled: "#ef4444",
};

export default async function AnalyticsPage() {
  const { profile } = await requireUser();
  const t = await getTranslations("analytics");
  const tStatus = await getTranslations("taskStatus");
  const tProj = await getTranslations("projectStatus");

  // Live Meta Ads account KPIs (managers; null when not connected).
  const isManager =
    profile.role === "super_admin" || profile.role === "team_leader";
  const [summary, ads] = await Promise.all([
    computeAnalytics(profile),
    isManager
      ? fetchOrgAdsInsights(profile.org_id)
      : Promise.resolve<AdsInsights | null>(null),
  ]);

  const cards = [
    {
      label: t("totalTasks"),
      value: summary.totalTasks,
      icon: ListTodo,
      tint: "260",
    },
    {
      label: t("completionRate"),
      value: `${summary.completionRate}%`,
      icon: CheckCircle2,
      tint: "145",
    },
    {
      label: t("overdue"),
      value: summary.overdueTasks,
      icon: AlertTriangle,
      tint: "25",
    },
    {
      label: t("activeMembers"),
      value: summary.activeMembers,
      icon: Users,
      tint: "80",
    },
  ];

  const taskData: BarDatum[] = summary.tasksByStatus.map((s) => ({
    label: tStatus(s.status),
    value: s.count,
    color: TASK_COLORS[s.status],
  }));
  const projectData: BarDatum[] = summary.projectsByStatus.map((s) => ({
    label: tProj(s.status),
    value: s.count,
    color: PROJECT_COLORS[s.status],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="rounded-xl border bg-card p-5">
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
              <p className="mt-3 text-3xl font-bold" dir="ltr">
                {c.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Live Meta Ads KPIs (last 30 days) */}
      {ads ? (
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Megaphone className="size-5" />
            {t("adsTitle")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                {
                  label: t("adsSpend"),
                  value: `${ads.spend.toLocaleString()}${ads.currency ? ` ${ads.currency}` : ""}`,
                },
                { label: t("adsImpressions"), value: ads.impressions.toLocaleString() },
                { label: t("adsClicks"), value: ads.clicks.toLocaleString() },
                { label: "CTR", value: `${ads.ctr.toFixed(2)}%` },
                { label: "CPC", value: ads.cpc.toFixed(2) },
              ] as const
            ).map((c) => (
              <div key={c.label} className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-lg font-bold" dir="ltr">
                  {c.value}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("adsHint")}</p>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold">
            {t("tasksByStatus")}
          </h2>
          <BarChart data={taskData} />
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold">
            {t("projectsByStatus")}
          </h2>
          <BarChart data={projectData} />
        </div>
      </div>
    </div>
  );
}
