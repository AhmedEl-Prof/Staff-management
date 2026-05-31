import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { canManagePeople } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { AppNav, type NavItem } from "@/components/app-nav";
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

  const isSuperAdmin = profile.role === "super_admin";
  const canManageEmployees = canManagePeople(profile.role);

  const navItems: NavItem[] = [
    { href: "/", key: "dashboard" },
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
      ? [{ href: "/audit", key: "audit" as const }]
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
