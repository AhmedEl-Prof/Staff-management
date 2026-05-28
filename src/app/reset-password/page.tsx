"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { updatePassword, type ResetState } from "./actions";
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

const initialState: ResetState = { error: null, success: false };

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialState,
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("resetTitle")}</CardTitle>
          <CardDescription>{t("loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {state.success ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-green-600">{t("passwordUpdated")}</p>
              <Link href="/login" className={buttonVariants()}>
                {t("backToLogin")}
              </Link>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t("newPassword")}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">{t("confirmPassword")}</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  required
                />
              </div>

              {state.error ? (
                <p className="text-sm text-destructive">{t(state.error)}</p>
              ) : null}

              <Button type="submit" disabled={pending}>
                {pending ? t("loggingIn") : t("updatePassword")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
