import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { orgUrl } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { EditOrgForm } from "./edit-form";

// Platform-side company editor: identity + routing (slug / custom domain).
export default async function EditOrgPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireUser();
  if (!profile.is_platform_admin) redirect("/");
  const { id } = await params;
  const t = await getTranslations("platform");

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!org) notFound();

  const url = orgUrl(org.slug, org.custom_domain);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/platform"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowRight className="size-3.5 rtl:block ltr:hidden" />
          {t("backToPlatform")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{org.name}</h1>
          {!org.is_active ? (
            <Badge variant="destructive">{t("suspended")}</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground" dir="ltr">
          {url}
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{t("editOrgTitle")}</h2>
        <EditOrgForm
          orgId={org.id}
          name={org.name}
          slug={org.slug}
          customDomain={org.custom_domain}
          rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? null}
        />
      </section>

      <section className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-medium">{t("domainStepsTitle")}</p>
        <ol className="text-muted-foreground flex list-inside list-decimal flex-col gap-1">
          <li>{t("domainStep1")}</li>
          <li>{t("domainStep2")}</li>
          <li>{t("domainStep3")}</li>
        </ol>
      </section>
    </div>
  );
}
