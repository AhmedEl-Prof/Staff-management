"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signupOrganization, type SignupState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignupState = { error: null };

export function SignupForm() {
  const t = useTranslations("signup");
  const [state, formAction, pending] = useActionState(
    signupOrganization,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="company_name">{t("companyName")}</Label>
        <Input id="company_name" name="company_name" required maxLength={120} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">{t("yourName")}</Label>
        <Input id="full_name" name="full_name" required maxLength={120} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          minLength={8}
          required
        />
        <span className="text-muted-foreground text-xs">
          {t("passwordHint")}
        </span>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{t(state.error)}</p>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? t("creating") : t("create")}
      </Button>
    </form>
  );
}
