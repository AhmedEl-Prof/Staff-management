"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { requestPasswordReset, type ForgotState } from "./actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: ForgotState = { sent: false };

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("forgotTitle")}</CardTitle>
          <CardDescription>{t("forgotSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {state.sent ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-green-600">{t("resetLinkSent")}</p>
              <Link
                href="/login"
                className={buttonVariants({ variant: "outline" })}
              >
                {t("backToLogin")}
              </Link>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  dir="ltr"
                  required
                />
              </div>
              <Button type="submit" disabled={pending}>
                {t("sendResetLink")}
              </Button>
              <Link
                href="/login"
                className="text-center text-xs text-muted-foreground hover:underline"
              >
                {t("backToLogin")}
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
