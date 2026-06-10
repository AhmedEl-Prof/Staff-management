"use client";

import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  connectOrgMetaAds,
  disconnectOrgMetaAds,
  type OrgState,
} from "./actions";

const initialState: OrgState = { error: null, success: false };

export function MetaAdsForm({ connected }: { connected: boolean }) {
  const t = useTranslations("organization");
  const [state, formAction, pending] = useActionState(
    connectOrgMetaAds,
    initialState,
  );
  const [disconnecting, startDisconnect] = useTransition();

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Megaphone className="size-5" />
          {t("metaAdsTitle")}
        </h2>
        {connected ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
            <CheckCircle2 className="size-4" />
            {t("whatsappConnected")}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t("metaAdsSubtitle")}</p>

      <form action={formAction} className="flex max-w-md flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ad_account_id">{t("metaAdsAccountId")}</Label>
          <Input
            id="ad_account_id"
            name="ad_account_id"
            dir="ltr"
            placeholder="act_1234567890"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="meta_access_token">{t("whatsappToken")}</Label>
          <Input
            id="meta_access_token"
            name="access_token"
            type="password"
            dir="ltr"
            autoComplete="off"
            required
          />
          <span className="text-muted-foreground text-xs">
            {t("whatsappTokenHint")}
          </span>
        </div>

        {state.error ? (
          <p className="text-sm text-destructive">{t("saveError")}</p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-green-600">{t("saved")}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {connected ? t("whatsappReplace") : t("whatsappConnect")}
          </Button>
          {connected ? (
            <Button
              type="button"
              variant="outline"
              disabled={disconnecting}
              onClick={() =>
                startDisconnect(async () => {
                  await disconnectOrgMetaAds();
                })
              }
            >
              {t("whatsappDisconnect")}
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
