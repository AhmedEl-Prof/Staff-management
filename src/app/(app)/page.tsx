import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";

// Dashboard landing. Real widgets (workload, tasks, KPIs) arrive in later
// phases; for now it greets the signed-in user.
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tRoles = await getTranslations("roles");
  const sessionUser = await getSessionUser();
  const profile = sessionUser?.profile;
  const displayName = profile?.arabic_name || profile?.full_name || sessionUser?.email;

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">
        {t("welcome")}
        {displayName ? ` — ${displayName}` : ""}
      </p>
      {profile ? (
        <p className="text-sm text-muted-foreground">{tRoles(profile.role)}</p>
      ) : null}
    </div>
  );
}
