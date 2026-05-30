import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManageableEmployees, canManagePeople } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GenerateForm } from "./generate-form";
import type { EvaluationRow, EvaluationStatus } from "@/types/database";

const STATUS_VARIANT: Record<EvaluationStatus, "muted" | "secondary" | "success"> =
  {
    draft: "muted",
    finalized: "secondary",
    sent: "success",
  };

export default async function EvaluationsPage() {
  const { profile } = await requireUser();
  const t = await getTranslations("evaluations");
  const isManager = canManagePeople(profile.role);

  // RLS scopes evaluations to self + managed users.
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("evaluations")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(100);
  const evaluations = (rows ?? []) as EvaluationRow[];

  // Names.
  const admin = createAdminClient();
  const userIds = [...new Set(evaluations.map((e) => e.user_id))];
  const nameById = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, arabic_name, full_name")
      .in("id", userIds);
    (profiles ?? []).forEach((p) =>
      nameById.set(p.id, p.arabic_name || p.full_name || p.id),
    );
  }

  const employees = isManager
    ? await getManageableEmployees(profile)
    : [];

  const statusLabel = (s: EvaluationStatus) =>
    t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isManager ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("generateTitle")}</h2>
          <GenerateForm employees={employees} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {isManager ? t("teamEvaluations") : t("myEvaluations")}
        </h2>
        {evaluations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead>{t("period")}</TableHead>
                  <TableHead>{t("score")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-end"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {nameById.get(e.user_id) ?? e.user_id}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span dir="ltr">
                        {e.period_start} → {e.period_end}
                      </span>
                      <Badge variant="outline" className="ms-2">
                        {t(e.period_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold" dir="ltr">
                      {e.total_score ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[e.status]}>
                        {statusLabel(e.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <Link
                        href={`/evaluations/${e.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        {t("viewDetails")}
                      </Link>
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
