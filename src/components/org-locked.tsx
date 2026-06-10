import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth-actions";

// Full-page soft lock shown when an organization's trial expired or it was
// suspended. Data stays intact; upgrading (manually, via the platform admin)
// restores access instantly.
export async function OrgLocked({
  orgName,
  reason,
}: {
  orgName: string;
  reason: "suspended" | "trial_expired";
}) {
  const t = await getTranslations("orgLocked");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-center">
      <div className="bg-muted flex size-16 items-center justify-center rounded-full">
        <Lock className="size-8 text-muted-foreground" />
      </div>
      <div className="max-w-md">
        <h1 className="text-2xl font-bold">
          {reason === "trial_expired" ? t("trialTitle") : t("suspendedTitle")}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {reason === "trial_expired"
            ? t("trialBody", { org: orgName })
            : t("suspendedBody", { org: orgName })}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href={`mailto:${process.env.PLATFORM_CONTACT_EMAIL ?? "ahmedgptt@gmail.com"}?subject=${encodeURIComponent(`ترقية الاشتراك — ${orgName}`)}`}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center rounded-md px-6 text-sm font-medium"
        >
          {t("contact")}
        </a>
        <form action={logout}>
          <Button type="submit" variant="outline">
            {t("logout")}
          </Button>
        </form>
      </div>
    </main>
  );
}
