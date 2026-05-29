"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  Users,
  Bell,
  UserCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth-actions";

export interface NavItem {
  href: string;
  key:
    | "dashboard"
    | "departments"
    | "projects"
    | "employees"
    | "notifications"
    | "profile";
}

const icons = {
  dashboard: LayoutDashboard,
  departments: Building2,
  projects: FolderKanban,
  employees: Users,
  notifications: Bell,
  profile: UserCircle,
} as const;

export function AppNav({ items }: { items: NavItem[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const Icon = icons[item.key];
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {t(item.key)}
          </Link>
        );
      })}

      <form action={logout} className="mt-2">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" />
          {t("logout")}
        </button>
      </form>
    </nav>
  );
}
