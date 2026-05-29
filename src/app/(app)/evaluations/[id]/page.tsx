import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageUser } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setEvaluationStatus } from "../actions";
import type {
  EvaluationRow,
  EvaluationStatus,
} from "@/types/database";
import type { KpiScoreLine } from "@/lib/evaluations";

const STATUS_VARIANT: Record<EvaluationStatus, "muted" | "secondary" | "success"> =
  {
    draft: "muted",
    finalized: "secondary",
    sent: "success",
  };

export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireUser();
  const t = await getTranslations("evaluations");

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("evaluations")
    .select("*")
    .eq("id", id)
    .single();
  if (!row) notFound();
  const evaluation = row as EvaluationRow;

  const admin = createAdminClient();
  const { data: subject } = await admin
    .from("profiles")
    .select("arabic_name, full_name")
    .eq("id", evaluation.user_id)
    .single();
  const subjectName =
    subject?.arabic_name || subject?.full_name || evaluation.user_id;

  const canManage = await canManageUser(profile, evaluation.user_id);
  const lines = (evaluation.kpi_scores as unknown as KpiScoreLine[]) ?? [];

  const statusLabel = (s: EvaluationStatus) =>
    t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/evaluations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowRight className="size-3.5" />
          {t("back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{subjectName}</h1>
          <Badge variant={STATUS_VARIANT[evaluation.status]}>
            {statusLabel(evaluation.status)}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <span dir="ltr">
            {evaluation.period_start} → {evaluation.period_end}
          </span>{" "}
          · {t(evaluation.period_type)}
        </p>
      </div>

      {/* Total score */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">{t("totalScore")}</p>
        <p className="mt-1 text-4xl font-bold" dir="ltr">
          {evaluation.total_score ?? 0}
        </p>
      </div>

      {/* KPI breakdown */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("kpiBreakdown")}</h2>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noKpis")}</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("kpiName")}</TableHead>
                  <TableHead>{t("kpiValue")}</TableHead>
                  <TableHead>{t("kpiWeight")}</TableHead>
                  <TableHead>{t("kpiWeighted")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.kpi_id}>
                    <TableCell className="font-medium">
                      {l.name_ar || l.name}
                      {l.unit ? (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          ({l.unit})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell dir="ltr">{l.value}</TableCell>
                    <TableCell dir="ltr">{l.weight}</TableCell>
                    <TableCell className="font-semibold" dir="ltr">
                      {l.weighted}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {evaluation.notes ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t("notes")}</h2>
          <p className="whitespace-pre-wrap rounded-lg border bg-card p-4 text-sm">
            {evaluation.notes}
          </p>
        </section>
      ) : null}

      {/* Status actions (managers only) */}
      {canManage ? (
        <div className="flex items-center gap-3">
          {evaluation.status === "draft" ? (
            <form action={setEvaluationStatus}>
              <input type="hidden" name="id" value={evaluation.id} />
              <input type="hidden" name="status" value="finalized" />
              <Button type="submit" variant="outline">
                {t("finalize")}
              </Button>
            </form>
          ) : null}
          {evaluation.status !== "sent" ? (
            <form action={setEvaluationStatus}>
              <input type="hidden" name="id" value={evaluation.id} />
              <input type="hidden" name="status" value="sent" />
              <Button type="submit">{t("markSent")}</Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
