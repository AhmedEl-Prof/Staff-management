"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/i18n/config";

// Responsive app shell. On desktop the sidebar is always visible; on mobile it
// becomes an off-canvas drawer toggled by a top bar button. The sidebar +
// header content are passed in so this stays a thin client wrapper around the
// server-rendered nav.
export function AppShell({
  sidebar,
  appName,
  locale,
  children,
}: {
  sidebar: ReactNode;
  appName: string;
  locale: Locale;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Track the route the drawer was opened on. If the route changes, the drawer
  // is considered closed — this derives "close on navigation" without an
  // effect, so a link tap that navigates also dismisses the drawer.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const setOpen = (next: boolean) =>
    setOpenedAt(next ? pathname : null);

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <div
        data-app-chrome
        className="fixed inset-x-0 top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3 border-b bg-card px-4 pt-[env(safe-area-inset-top)] lg:hidden"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="menu"
          className="inline-flex size-10 items-center justify-center rounded-md hover:bg-muted"
        >
          <Menu className="size-5" />
        </button>
        <span className="text-sm font-bold">{appName}</span>
        <div className="ms-auto flex items-center gap-1">
          <GlobalSearch />
          <LocaleSwitcher locale={locale} />
          <ThemeToggle />
        </div>
      </div>

      {/* Backdrop (mobile, when open) */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* Sidebar: static on desktop, drawer on mobile */}
      <aside
        data-app-chrome
        className={[
          "fixed inset-y-0 start-0 z-50 w-64 shrink-0 overflow-y-auto border-e bg-card pt-[env(safe-area-inset-top)] transition-transform lg:static lg:z-auto lg:w-60 lg:translate-x-0 lg:pt-0",
          // The drawer lives on the start edge (right in RTL, left in LTR), so
          // off-screen means translating toward that same edge. translate-x is
          // physical, hence the per-direction variants scoped below lg.
          open
            ? "translate-x-0"
            : "max-lg:rtl:translate-x-full max-lg:ltr:-translate-x-full",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="close"
          className="absolute end-2 top-2 inline-flex size-10 items-center justify-center rounded-md hover:bg-muted lg:hidden"
        >
          <X className="size-4" />
        </button>
        {sidebar}
      </aside>

      {/* Main content (pushed below the mobile top bar) */}
      <main
        data-app-main
        className="min-w-0 flex-1 p-4 pt-[calc(4.5rem+env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pt-[calc(4.5rem+env(safe-area-inset-top))] lg:p-8 lg:pt-8"
      >
        {children}
      </main>
    </div>
  );
}
