import { getTranslations, getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { slugFromHost, orgFromHost, orgUrl } from "@/lib/tenant";
import { canManagePeople } from "@/lib/permissions";
import { getOrgAccess } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { OrgLocked } from "@/components/org-locked";
import { AppNav, type NavItem } from "@/components/app-nav";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AppShell } from "@/components/app-shell";
import type { Locale } from "@/i18n/config";

// Shared shell for all authenticated pages: sidebar nav + content area.
// requireUser() redirects to /login if there is somehow no session (the proxy
// already enforces this, but this guarantees `user` is present below).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { id: userId, profile } = await requireUser();
  const t = await getTranslations("app");
  const locale = (await getLocale()) as Locale;

  // Soft lock: expired trials / suspended orgs see a contact screen instead
  // of the app (data stays intact). Platform admins are never locked out.
  const access = await getOrgAccess(profile.org_id);
  if (!access.allowed && !profile.is_platform_admin) {
    return (
      <OrgLocked
        orgName={access.org?.name ?? ""}
        reason={access.reason ?? "suspended"}
      />
    );
  }

  // Tenancy by host: a member browsing another org's subdomain or custom
  // domain is bounced to their own organization's home. The DB lookup only
  // runs when the host isn't already one of the member's own hosts.
  const host = (await headers()).get("host");
  const hostname = host?.split(":")[0].toLowerCase() ?? null;
  const hostSlug = slugFromHost(host);
  const onOwnHost =
    !hostname ||
    hostname === access.org?.custom_domain ||
    (hostSlug !== null && hostSlug === access.org?.slug);
  if (!onOwnHost) {
    const hostOrg = await orgFromHost(host);
    if (hostOrg && hostOrg.id !== profile.org_id) {
      redirect(orgUrl(access.org?.slug ?? null, access.org?.custom_domain));
    }
  }

  const isSuperAdmin = profile.role === "super_admin";
  const canManageEmployees = canManagePeople(profile.role);

  const navItems: NavItem[] = [
    { href: "/", key: "dashboard" },
    { href: "/assistant", key: "assistant" },
    ...(isSuperAdmin
      ? [{ href: "/departments", key: "departments" as const }]
      : []),
    { href: "/projects", key: "projects" },
    { href: "/standup", key: "standup" },
    { href: "/peer-review", key: "peerReview" },
    { href: "/leaderboard", key: "leaderboard" },
    { href: "/bonus", key: "bonus" },
    { href: "/leave", key: "leave" },
    { href: "/attendance", key: "attendance" },
    { href: "/timesheet", key: "timesheet" },
    { href: "/tools", key: "tools" },
    { href: "/evaluations", key: "evaluations" },
    ...(canManageEmployees
      ? [
          { href: "/kpis", key: "kpis" as const },
          { href: "/analytics", key: "analytics" as const },
          { href: "/employees", key: "employees" as const },
        ]
      : []),
    // Checklist templates is a project-management tool — not for HR.
    ...(isSuperAdmin || profile.role === "team_leader"
      ? [{ href: "/checklists", key: "checklists" as const }]
      : []),
    ...(isSuperAdmin
      ? [
          { href: "/audit", key: "audit" as const },
          { href: "/organization", key: "organization" as const },
        ]
      : []),
    ...(profile.is_platform_admin
      ? [{ href: "/platform", key: "platform" as const }]
      : []),
    { href: "/notifications", key: "notifications" },
    { href: "/profile", key: "profile" },
  ];

  // Initial unread count for the bell badge (the bell then keeps it live via
  // Supabase Realtime). RLS scopes the query to the caller.
  const supabase = await createClient();
  const { count: initialUnread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  const sidebar = (
    <>
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <p className="text-sm font-bold">{t("name")}</p>
          <p className="text-muted-foreground text-xs">{t("company")}</p>
        </div>
        <div className="flex items-center gap-1">
          <GlobalSearch withHotkey />
          <LocaleSwitcher locale={locale} />
          <ThemeToggle />
          <NotificationBell userId={userId} initialUnread={initialUnread ?? 0} />
        </div>
      </div>
      <AppNav items={navItems} />
    </>
  );

  return (
    <AppShell sidebar={sidebar} appName={t("name")} locale={locale}>
      {children}
    </AppShell>
  );
}
