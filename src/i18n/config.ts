// Supported locales for the app. Arabic is the primary language (RTL),
// with English available as a secondary option.
export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

// Cookie used to persist the user's language preference.
export const LOCALE_COOKIE = "locale";

// Text direction per locale, used to set <html dir="...">.
export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}
