import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav, type NavItem } from "@/components/app-nav";
import { NotificationBell } from "@/components/notification-bell";

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

  const isSuperAdmin = profile.role === "super_admin";
  const canManageEmployees =
    profile.role === "super_admin" || profile.role === "team_leader";

  const navItems: NavItem[] = [
    { href: "/", key: "dashboard" },
    ...(isSuperAdmin
      ? [{ href: "/departments", key: "departments" as const }]
      : []),
    { href: "/projects", key: "projects" },
    { href: "/standup", key: "standup" },
    { href: "/peer-review", key: "peerReview" },
    { href: "/evaluations", key: "evaluations" },
    ...(canManageEmployees
      ? [
          { href: "/kpis", key: "kpis" as const },
          { href: "/analytics", key: "analytics" as const },
          { href: "/employees", key: "employees" as const },
        ]
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

  return (
    <div className="flex min-h-screen">
      <aside data-app-chrome className="w-60 shrink-0 border-e bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <p className="text-sm font-bold">{t("name")}</p>
            <p className="text-xs text-muted-foreground">{t("company")}</p>
          </div>
          <NotificationBell userId={userId} initialUnread={initialUnread ?? 0} />
        </div>
        <AppNav items={navItems} />
      </aside>
      <main data-app-main className="flex-1 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
