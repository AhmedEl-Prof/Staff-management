"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganization, type OrgState } from "./actions";

const initialState: OrgState = { error: null, success: false };

export function OrgForm({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  const t = useTranslations("organization");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState(
    updateOrganization,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" defaultValue={name} required maxLength={120} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="logo_url">{t("logoUrl")}</Label>
        <Input
          id="logo_url"
          name="logo_url"
          type="url"
          dir="ltr"
          placeholder="https://…"
          defaultValue={logoUrl ?? ""}
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{t("saveError")}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-green-600">{t("saved")}</p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </div>
    </form>
  );
}
