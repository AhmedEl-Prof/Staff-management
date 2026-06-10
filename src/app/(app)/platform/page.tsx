import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteOrganization,
  extendPlanPeriod,
  setOrgPlan,
  toggleOrgActive,
} from "./actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { NewOrgForm } from "./new-org-form";
import type { OrganizationRow } from "@/types/database";

const PLANS = ["trial", "monthly", "yearly", "internal"] as const;

// Platform dashboard: every registered organization, its plan and status.
// Visible only to platform admins (the people running the SaaS).
export default async function PlatformPage() {
  const { profile } = await requireUser();
  if (!profile.is_platform_admin) redirect("/");
  const t = await getTranslations("platform");
  const tOrg = await getTranslations("organization");
  const tc = await getTranslations("common");

  const admin = createAdminClient();
  const [{ data: orgRows }, { data: profileRows }] = await Promise.all([
    admin
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false }),
    admin.from("profiles").select("org_id"),
  ]);
  const orgs = (orgRows ?? []) as OrganizationRow[];

  const memberCount = new Map<string, number>();
  (profileRows ?? []).forEach((p) => {
    memberCount.set(p.org_id, (memberCount.get(p.org_id) ?? 0) + 1);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">{t("totalOrgs")}</p>
          <p className="text-2xl font-bold">{orgs.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">{t("activeOrgs")}</p>
          <p className="text-2xl font-bold">
            {orgs.filter((o) => o.is_active).length}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">{t("trialOrgs")}</p>
          <p className="text-2xl font-bold">
            {orgs.filter((o) => o.plan === "trial").length}
          </p>
        </div>
      </div>

      <NewOrgForm />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("org")}</TableHead>
              <TableHead>{tOrg("plan")}</TableHead>
              <TableHead>{t("members")}</TableHead>
              <TableHead>{t("periodEnd")}</TableHead>
              <TableHead>{t("createdAt")}</TableHead>
              <TableHead className="text-end">{tc("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((org) => {
              const settings = (org.settings ?? {}) as {
                trial_ends_at?: string;
                subscription_ends_at?: string;
              };
              const periodEnd = (
                org.plan === "trial"
                  ? settings.trial_ends_at
                  : settings.subscription_ends_at
              )?.slice(0, 10) ?? null;
              const hasPeriod = ["trial", "monthly", "yearly"].includes(org.plan);
              const isSelf = org.id === profile.org_id;
              return (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {org.name}
                      {!org.is_active ? (
                        <Badge variant="destructive">{t("suspended")}</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {org.slug}
                    </p>
                  </TableCell>
                  <TableCell>
                    <form action={setOrgPlan} className="flex items-center gap-2">
                      <input type="hidden" name="org_id" value={org.id} />
                      <Select
                        name="plan"
                        defaultValue={org.plan}
                        className="h-8 w-32 text-xs"
                      >
                        {PLANS.map((p) => (
                          <option key={p} value={p}>
                            {tOrg(`plans.${p}`)}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" size="sm" variant="outline">
                        {tc("save")}
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell>{memberCount.get(org.id) ?? 0}</TableCell>
                  <TableCell dir="ltr" className="text-sm">
                    {periodEnd ?? "—"}
                  </TableCell>
                  <TableCell dir="ltr" className="text-sm">
                    {org.created_at.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={`/platform/${org.id}`}
                        className="hover:bg-muted inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium"
                      >
                        {tc("edit")}
                      </Link>
                      {hasPeriod ? (
                        <form action={extendPlanPeriod}>
                          <input type="hidden" name="org_id" value={org.id} />
                          <Button type="submit" size="sm" variant="outline">
                            {org.plan === "trial"
                              ? t("extendTrial")
                              : org.plan === "monthly"
                                ? t("renewMonth")
                                : t("renewYear")}
                          </Button>
                        </form>
                      ) : null}
                      {!isSelf ? (
                        <form action={toggleOrgActive}>
                          <input type="hidden" name="org_id" value={org.id} />
                          <input
                            type="hidden"
                            name="is_active"
                            value={org.is_active ? "false" : "true"}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant={org.is_active ? "destructive" : "default"}
                          >
                            {org.is_active ? t("suspend") : t("reactivate")}
                          </Button>
                        </form>
                      ) : null}
                      {!isSelf && !org.is_active ? (
                        <ConfirmDelete
                          action={deleteOrganization}
                          hidden={{ org_id: org.id }}
                          message={t("deleteConfirm", { org: org.name })}
                          label={t("deleteOrg")}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
