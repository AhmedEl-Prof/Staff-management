import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MfaForm } from "./mfa-form";

// Second step of sign-in for accounts with TOTP enabled.
export default async function MfaPage() {
  const t = await getTranslations("mfa");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <MfaForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
