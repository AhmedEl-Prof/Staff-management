import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AuditLogRow } from "@/types/database";

const ENTITIES = [
  "profiles",
  "departments",
  "projects",
  "tasks",
  "evaluations",
] as const;

const ACTION_VARIANT: Record<string, "success" | "secondary" | "destructive"> =
  {
    INSERT: "success",
    UPDATE: "secondary",
    DELETE: "destructive",
  };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  await requireRole(["super_admin"]);
  const t = await getTranslations("audit");
  const { entity } = await searchParams;
  const activeEntity =
    entity && (ENTITIES as readonly string[]).includes(entity)
      ? entity
      : null;

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

  const entityLabel = (e: string) => {
    const key = `entity${e.charAt(0).toUpperCase()}${e.slice(1)}`;
    return t.has(key) ? t(key) : e;
  };
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
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("when")}</TableHead>
                <TableHead>{t("who")}</TableHead>
                <TableHead>{t("action")}</TableHead>
                <TableHead>{t("entity")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground" dir="ltr">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.user_id
                      ? (nameById.get(log.user_id) ?? log.user_id)
                      : t("system")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ACTION_VARIANT[log.action] ?? "secondary"}>
                      {actionLabel(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entityLabel(log.entity_type)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
