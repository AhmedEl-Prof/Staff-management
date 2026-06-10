import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { orgWhatsAppConnected } from "@/lib/whatsapp";
import { employeeLimitFor } from "@/lib/org";
import { Badge } from "@/components/ui/badge";
import { OrgForm } from "./org-form";
import { WhatsAppForm } from "./whatsapp-form";

// Organization settings (super admin): company identity + plan overview.
export default async function OrganizationPage() {
  const { profile } = await requireRole(["super_admin"]);
  const t = await getTranslations("organization");

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("id", profile.org_id)
    .single();
  if (!org) return null;

  const settings = (org.settings ?? {}) as { trial_ends_at?: string };
  const trialEndsAt = settings.trial_ends_at?.slice(0, 10) ?? null;
  const KNOWN_PLANS = ["internal", "trial", "starter", "business", "enterprise"];
  const planLabel = KNOWN_PLANS.includes(org.plan)
    ? t(`plans.${org.plan}`)
    : org.plan;
  const [memberCount, waConnected] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("is_active", true),
    orgWhatsAppConnected(org.id),
  ]);
  const limit = employeeLimitFor(org.plan);
  const limitLabel = Number.isFinite(limit) ? ` / ${limit}` : "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">{t("plan")}</p>
          <Badge variant="secondary" className="mt-1">
            {planLabel}
          </Badge>
        </div>
        {trialEndsAt ? (
          <div>
            <p className="text-muted-foreground">{t("trialEnds")}</p>
            <p className="mt-1 font-medium" dir="ltr">
              {trialEndsAt}
            </p>
          </div>
        ) : null}
        <div>
          <p className="text-muted-foreground">{t("activeMembers")}</p>
          <p className="mt-1 font-medium">
            {memberCount.count ?? 0}
            {limitLabel}
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{t("identity")}</h2>
        <OrgForm name={org.name} logoUrl={org.logo_url} />
      </section>

      <WhatsAppForm connected={waConnected} />
    </div>
  );
}
