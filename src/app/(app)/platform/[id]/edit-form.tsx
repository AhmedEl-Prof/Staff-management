"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrgDetails, type EditOrgState } from "../actions";

const initialState: EditOrgState = { error: null, success: false };

const ERROR_KEYS: Record<string, string> = {
  invalidSlug: "invalidSlug",
  slugTaken: "slugTaken",
  invalidDomain: "invalidDomain",
  domainTaken: "domainTaken",
};

export function EditOrgForm({
  orgId,
  name,
  slug,
  customDomain,
  rootDomain,
}: {
  orgId: string;
  name: string;
  slug: string | null;
  customDomain: string | null;
  rootDomain: string | null;
}) {
  const t = useTranslations("platform");
  const tOrg = useTranslations("organization");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState(
    updateOrgDetails,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <input type="hidden" name="org_id" value={orgId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{tOrg("name")}</Label>
        <Input id="name" name="name" defaultValue={name} required maxLength={120} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">{tOrg("slug")}</Label>
        <div className="flex items-center gap-2" dir="ltr">
          <Input
            id="slug"
            name="slug"
            dir="ltr"
            pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
            defaultValue={slug ?? ""}
            className="max-w-44"
          />
          {rootDomain ? (
            <span className="text-muted-foreground text-sm">.{rootDomain}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="custom_domain">{t("customDomain")}</Label>
        <Input
          id="custom_domain"
          name="custom_domain"
          dir="ltr"
          placeholder="hr.client-company.com"
          defaultValue={customDomain ?? ""}
        />
        <span className="text-muted-foreground text-xs">
          {t("customDomainHint")}
        </span>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">
          {t(ERROR_KEYS[state.error] ?? "newOrgFailed")}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-green-600">{tOrg("saved")}</p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </div>
    </form>
  );
}
