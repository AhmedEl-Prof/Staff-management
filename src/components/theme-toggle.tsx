"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

// Toggles dark mode by flipping the `dark` class on <html> and persisting the
// choice in a cookie (so the server renders the right theme on next load, no
// flash). The icon is driven purely by the `.dark` CSS class, so there's no
// React state and therefore no hydration mismatch.
export function ThemeToggle() {
  const t = useTranslations("common");

  const toggle = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    document.cookie = `theme=${isDark ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("toggleTheme")}
      title={t("toggleTheme")}
      className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md"
    >
      <Sun className="hidden size-5 dark:block" />
      <Moon className="size-5 dark:hidden" />
    </button>
  );
}
