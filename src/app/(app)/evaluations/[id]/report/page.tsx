import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintButton } from "@/components/print-button";
import type { EvaluationRow } from "@/types/database";
import type { KpiScoreLine } from "@/lib/evaluations";

// Print-optimized evaluation report. Visiting this page and choosing the
// browser's "Save as PDF" yields a correct Arabic RTL PDF. Access is governed
// by RLS on evaluations (self or manages_user).
export default async function EvaluationReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const t = await getTranslations("report");
  const tEval = await getTranslations("evaluations");

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("evaluations")
    .select("*")
    .eq("id", id)
    .single();
  if (!row) notFound();
  const evaluation = row as EvaluationRow;

  const admin = createAdminClient();
  const [{ data: subject }, { data: evaluator }] = await Promise.all([
    admin
      .from("profiles")
      .select("arabic_name, full_name")
      .eq("id", evaluation.user_id)
      .single(),
    evaluation.evaluator_id
      ? admin
          .from("profiles")
          .select("arabic_name, full_name")
          .eq("id", evaluation.evaluator_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const subjectName =
    subject?.arabic_name || subject?.full_name || evaluation.user_id;
  const evaluatorName = evaluator
    ? evaluator.arabic_name || evaluator.full_name
    : null;
  const lines = (evaluation.kpi_scores as unknown as KpiScoreLine[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500">{t("company")}</p>
          <h1 className="mt-1 text-2xl font-bold">{t("evaluationReport")}</h1>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <Field label={t("employee")} value={subjectName} />
        <Field
          label={t("period")}
          value={`${evaluation.period_start} → ${evaluation.period_end} (${tEval(evaluation.period_type)})`}
        />
        {evaluatorName ? (
          <Field label={t("evaluator")} value={evaluatorName} />
        ) : null}
        <Field
          label={t("generatedAt")}
          value={new Date(evaluation.generated_at).toLocaleString()}
        />
      </div>

      <div className="my-6 rounded-lg border p-4">
        <p className="text-sm text-gray-500">{t("totalScore")}</p>
        <p className="mt-1 text-4xl font-bold" dir="ltr">
          {evaluation.total_score ?? 0}
        </p>
      </div>

      <h2 className="mb-2 text-lg font-semibold">{t("kpiBreakdown")}</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-start text-gray-500">
            <th className="p-2 text-start">{t("kpi")}</th>
            <th className="p-2 text-start">{t("value")}</th>
            <th className="p-2 text-start">{t("weight")}</th>
            <th className="p-2 text-start">{t("weighted")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.kpi_id} className="border-b">
              <td className="p-2 font-medium">{l.name_ar || l.name}</td>
              <td className="p-2" dir="ltr">
                {l.value}
              </td>
              <td className="p-2" dir="ltr">
                {l.weight}
              </td>
              <td className="p-2 font-semibold" dir="ltr">
                {l.weighted}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {evaluation.notes ? (
        <div className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">{t("notes")}</h2>
          <p className="whitespace-pre-wrap rounded-lg border p-4 text-sm">
            {evaluation.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
