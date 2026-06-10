"use client";

import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";

// Switches between Arabic and English by setting the `locale` cookie (read by
// the next-intl request config) and reloading so the document direction,
// language, and all server-rendered messages update together.
export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const t = useTranslations("common");
  const next: Locale = locale === "ar" ? "en" : "ar";

  const switchTo = () => {
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={switchTo}
      aria-label={t("toggleLanguage")}
      title={t("toggleLanguage")}
      className="hover:bg-muted inline-flex h-10 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium sm:h-9 sm:px-2"
    >
      <Languages className="size-4" />
      {next === "en" ? "EN" : "ع"}
    </button>
  );
}
