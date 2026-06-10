import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { orgFromHost } from "@/lib/tenant";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const t = await getTranslations("auth");
  const tApp = await getTranslations("app");

  // Subdomain branding: <slug>.<root> shows that company's name (and logo)
  // on its login page.
  const host = (await headers()).get("host");
  const hostOrg = await orgFromHost(host);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {hostOrg?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hostOrg.logo_url}
              alt=""
              className="mx-auto mb-2 size-12 rounded-md object-contain"
            />
          ) : null}
          <CardTitle>{hostOrg?.name ?? tApp("name")}</CardTitle>
          <CardDescription>{t("loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-center text-xs text-muted-foreground">
            {t("newCompany")}{" "}
            <Link href="/signup" className="text-primary hover:underline">
              {t("signupLink")}
            </Link>
          </p>
        </CardFooter>
      </Card>

      <p className="text-muted-foreground text-center text-xs">
        {t("developedBy")}{" "}
        <a
          href="https://deepentry.net"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-medium hover:underline"
        >
          Deep Entry | ديب انتري
        </a>
      </p>
    </main>
  );
}
