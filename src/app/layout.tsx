import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { localeDirection, type Locale } from "@/i18n/config";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { InstallPrompt } from "@/components/install-prompt";
import "./globals.css";

// Cairo renders Arabic and Latin scripts cleanly and suits an RTL UI.
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "إدارة الموظفين — Everest Ads",
  description: "نظام إدارة موظفين شركة Everest Ads",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Everest Staff",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  // Allow zoom for accessibility but keep the app shell stable.
  maximumScale: 5,
  // Draw under the notch/home indicator; the shell pads with safe-area insets.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = localeDirection[locale] ?? "rtl";
  const theme = (await cookies()).get("theme")?.value;
  const htmlClass = `${cairo.variable} h-full antialiased${
    theme === "dark" ? " dark" : ""
  }`;

  return (
    <html
      lang={locale}
      dir={dir}
      className={htmlClass}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-full">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
          <ServiceWorkerRegister />
          <InstallPrompt />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
