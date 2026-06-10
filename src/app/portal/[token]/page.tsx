import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Calendar,
  CheckCircle2,
  Circle,
  ClipboardList,
  PackageCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPortalData } from "@/lib/portal";

export const metadata: Metadata = {
  // Secret-token page: keep it out of search engines.
  robots: { index: false, follow: false },
};

// Public, read-only client portal. No session required — the URL token is the
// credential (validated in getPortalData). Shows only client-safe data.
export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) notFound();

  const t = await getTranslations("portal");
  const tStatus = await getTranslations("projectStatus");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-4 py-8 sm:p-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          {t("pageTagline")}
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">{data.projectName}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{tStatus(data.status)}</Badge>
          {data.clientName ? (
            <Badge variant="outline">{data.clientName}</Badge>
          ) : null}
        </div>
        {data.description ? (
          <p className="text-sm text-muted-foreground">{data.description}</p>
        ) : null}
      </header>

      {/* Progress */}
      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("progress")}</h2>
          <span className="text-2xl font-bold">{data.progressPct}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={data.progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-3 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${data.progressPct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-lg font-bold">{data.taskCounts.done}</p>
            <p className="text-xs text-muted-foreground">{t("done")}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-lg font-bold">
              {data.taskCounts.in_progress + data.taskCounts.review}
            </p>
            <p className="text-xs text-muted-foreground">{t("inProgress")}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-lg font-bold">{data.taskCounts.total}</p>
            <p className="text-xs text-muted-foreground">{t("totalTasks")}</p>
          </div>
        </div>
      </section>

      {/* Timeline */}
      {data.startDate || data.endDate ? (
        <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-4 text-sm">
          <Calendar className="size-5 text-muted-foreground" />
          {data.startDate ? (
            <span>
              <span className="text-muted-foreground">{t("startDate")}: </span>
              <span dir="ltr" className="font-medium">
                {data.startDate}
              </span>
            </span>
          ) : null}
          {data.endDate ? (
            <span>
              <span className="text-muted-foreground">{t("endDate")}: </span>
              <span dir="ltr" className="font-medium">
                {data.endDate}
              </span>
            </span>
          ) : null}
        </section>
      ) : null}

      {/* Milestones */}
      {data.milestones.length ? (
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardList className="size-5" />
            {t("milestones")}
          </h2>
          <ul className="flex flex-col gap-2">
            {data.milestones.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {m.done ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span
                  className={
                    m.done ? "text-muted-foreground line-through" : undefined
                  }
                >
                  {m.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Recent deliverables */}
      {data.recentDeliverables.length ? (
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <PackageCheck className="size-5" />
            {t("recentDeliverables")}
          </h2>
          <ul className="flex flex-col gap-2">
            {data.recentDeliverables.map((d, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-sm"
              >
                <span>{d.title}</span>
                {d.completedAt ? (
                  <span dir="ltr" className="text-xs text-muted-foreground">
                    {d.completedAt.slice(0, 10)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-auto pt-4 text-center text-xs text-muted-foreground">
        {t("footer")}
      </footer>
    </main>
  );
}
