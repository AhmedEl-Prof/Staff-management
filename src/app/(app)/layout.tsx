import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { AppNav, type NavItem } from "@/components/app-nav";

// Shared shell for all authenticated pages: sidebar nav + content area.
// requireUser() redirects to /login if there is somehow no session (the proxy
// already enforces this, but this guarantees `user` is present below).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireUser();
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
    ...(canManageEmployees
      ? [{ href: "/employees", key: "employees" as const }]
      : []),
    { href: "/profile", key: "profile" },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-e bg-card">
        <div className="border-b p-4">
          <p className="text-sm font-bold">{t("name")}</p>
          <p className="text-xs text-muted-foreground">{t("company")}</p>
        </div>
        <AppNav items={navItems} />
      </aside>
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
