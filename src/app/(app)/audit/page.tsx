import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { summarizeAudit } from "@/lib/audit-format";
import type { AuditLogRow } from "@/types/database";

// Entity types surfaced as filter chips (the audit covers more tables, but
// these are the ones worth filtering by).
const ENTITIES = [
  "profiles",
  "departments",
  "projects",
  "project_members",
  "tasks",
  "task_comments",
  "time_logs",
  "peer_reviews",
  "standup_responses",
  "evaluations",
  "kpi_logs",
] as const;

const ACTION_VARIANT: Record<string, "success" | "secondary" | "destructive"> =
  {
    INSERT: "success",
    UPDATE: "secondary",
    DELETE: "destructive",
  };

// Arabic labels for entity types (table names).
const ENTITY_LABELS: Record<string, string> = {
  profiles: "موظف",
  departments: "قسم",
  department_members: "عضوية قسم",
  projects: "مشروع",
  project_members: "عضوية مشروع",
  tasks: "تاسك",
  task_comments: "تعليق",
  task_attachments: "مرفق",
  task_dependencies: "اعتمادية",
  time_logs: "تسجيل وقت",
  peer_reviews: "تقييم زميل",
  standup_responses: "ستاندب",
  evaluations: "تقييم",
  kpi_logs: "مؤشر أداء",
};

// Arabic labels for common column names in the change diff.
const FIELD_LABELS: Record<string, string> = {
  title: "العنوان",
  description: "الوصف",
  status: "الحالة",
  priority: "الأولوية",
  name: "الاسم",
  name_ar: "الاسم بالعربية",
  arabic_name: "الاسم بالعربية",
  full_name: "الاسم",
  role: "الدور",
  is_active: "نشط",
  assigned_to: "المسؤول",
  due_date: "تاريخ التسليم",
  start_date: "تاريخ البداية",
  end_date: "تاريخ النهاية",
  content: "المحتوى",
  client_name: "العميل",
  weekly_hours: "ساعات أسبوعية",
  employment_type: "نوع التوظيف",
  estimated_hours: "ساعات متوقعة",
  actual_hours: "ساعات فعلية",
  hours: "ساعات",
  value: "القيمة",
  total_score: "الدرجة",
  notes: "ملاحظات",
  comments: "ملاحظات",
  mood: "المزاج",
  yesterday_work: "شغل أمس",
  today_plan: "خطة اليوم",
  blockers: "العوائق",
  department_id: "القسم",
  project_id: "المشروع",
};

const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  await requireRole(["super_admin"]);
  const t = await getTranslations("audit");
  const { entity } = await searchParams;
  const activeEntity =
    entity && (ENTITIES as readonly string[]).includes(entity) ? entity : null;

  // RLS restricts audit_logs select to super admins only.
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (activeEntity) query = query.eq("entity_type", activeEntity);
  const { data: rows } = await query;
  const logs = (rows ?? []) as AuditLogRow[];

  // Resolve actor names.
  const admin = createAdminClient();
  const actorIds = [
    ...new Set(logs.map((l) => l.user_id).filter((id): id is string => !!id)),
  ];
  const nameById = new Map<string, string>();
  if (actorIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, arabic_name, full_name")
      .in("id", actorIds);
    (profiles ?? []).forEach((p) =>
      nameById.set(p.id, p.arabic_name || p.full_name || p.id),
    );
  }

  const entityLabel = (e: string) => ENTITY_LABELS[e] ?? e;
  const actionLabel = (a: string) => {
    const key = `action${a}`;
    return t.has(key) ? t(key) : a;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Entity filter */}
      <div className="flex flex-wrap gap-2">
        <FilterChip href="/audit" active={!activeEntity} label={t("filterAll")} />
        {ENTITIES.map((e) => (
          <FilterChip
            key={e}
            href={`/audit?entity=${e}`}
            active={activeEntity === e}
            label={entityLabel(e)}
          />
        ))}
      </div>

      {logs.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {logs.map((log) => {
            const who = log.user_id
              ? (nameById.get(log.user_id) ?? log.user_id)
              : t("system");
            const summary = summarizeAudit(log.action, log.changes);
            return (
              <li key={log.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={ACTION_VARIANT[log.action] ?? "secondary"}>
                      {actionLabel(log.action)}
                    </Badge>
                    <span className="text-sm">
                      <span className="font-medium">{who}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {entityLabel(log.entity_type)}
                      </span>
                      {summary.subject ? (
                        <span className="font-medium"> · {summary.subject}</span>
                      ) : null}
                    </span>
                  </div>
                  <span
                    className="shrink-0 text-xs text-muted-foreground"
                    dir="ltr"
                  >
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>

                {summary.changes.length > 0 ? (
                  <details className="group mt-2">
                    <summary className="cursor-pointer text-xs text-primary hover:underline">
                      {t("showDetails")} ({summary.changes.length})
                    </summary>
                    <ul className="mt-2 flex flex-col gap-1 border-t pt-2 text-sm">
                      {summary.changes.map((c, i) => (
                        <li
                          key={i}
                          className="flex flex-wrap items-center gap-1"
                        >
                          <span className="text-muted-foreground">
                            {fieldLabel(c.field)}:
                          </span>
                          {log.action === "UPDATE" ? (
                            <>
                              <span
                                className="text-destructive line-through"
                                dir="auto"
                              >
                                {c.from ?? "—"}
                              </span>
                              <span className="text-muted-foreground">←</span>
                              <span
                                className="font-medium text-green-600"
                                dir="auto"
                              >
                                {c.to ?? "—"}
                              </span>
                            </>
                          ) : (
                            <span className="font-medium" dir="auto">
                              {c.to ?? "—"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </Link>
  );
}
