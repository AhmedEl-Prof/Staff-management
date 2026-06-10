"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Check, ChevronDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createOrganization, type CreateOrgState } from "./actions";

const PLANS = ["trial", "starter", "business", "enterprise"] as const;
const initialState: CreateOrgState = { error: null };

// Manual (sales-led) company creation: the platform admin fills the company +
// founder details and gets the temporary credentials to hand over.
export function NewOrgForm() {
  const t = useTranslations("platform");
  const tOrg = useTranslations("organization");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState(
    createOrganization,
    initialState,
  );

  async function copyCreds() {
    if (!state.credentials) return;
    await navigator.clipboard.writeText(
      `${state.credentials.email}\n${state.credentials.password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 text-start"
      >
        <span className="flex items-center gap-2 text-lg font-semibold">
          <Building2 className="size-5" />
          {t("newOrgTitle")}
        </span>
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        state.credentials ? (
          <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-4">
            <p className="text-sm font-medium text-green-600">
              {t("newOrgCreated", { org: state.credentials.orgName })}
            </p>
            <div className="flex flex-col gap-1 text-sm" dir="ltr">
              <p>
                <span className="text-muted-foreground">Email: </span>
                <b>{state.credentials.email}</b>
              </p>
              <p>
                <span className="text-muted-foreground">Password: </span>
                <b className="font-mono">{state.credentials.password}</b>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("newOrgCredsHint")}
            </p>
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyCreds}
                className="gap-2"
              >
                {copied ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <Copy className="size-4" />
                )}
                {t("copyCreds")}
              </Button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="flex max-w-md flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="company_name">{t("newOrgCompany")}</Label>
              <Input id="company_name" name="company_name" required maxLength={120} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin_name">{t("newOrgAdminName")}</Label>
                <Input id="admin_name" name="admin_name" required maxLength={120} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin_email">{t("newOrgAdminEmail")}</Label>
                <Input
                  id="admin_email"
                  name="admin_email"
                  type="email"
                  dir="ltr"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan">{tOrg("plan")}</Label>
              <Select id="plan" name="plan" defaultValue="trial">
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {tOrg(`plans.${p}`)}
                  </option>
                ))}
              </Select>
            </div>

            {state.error ? (
              <p className="text-sm text-destructive">
                {state.error === "emailTaken"
                  ? t("newOrgEmailTaken")
                  : t("newOrgFailed")}
              </p>
            ) : null}

            <div>
              <Button type="submit" disabled={pending}>
                {pending ? t("newOrgCreating") : t("newOrgCreate")}
              </Button>
            </div>
          </form>
        )
      ) : null}
    </section>
  );
}
