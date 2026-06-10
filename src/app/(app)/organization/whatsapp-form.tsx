"use client";

import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  connectOrgWhatsApp,
  disconnectOrgWhatsApp,
  type OrgState,
} from "./actions";

const initialState: OrgState = { error: null, success: false };

export function WhatsAppForm({ connected }: { connected: boolean }) {
  const t = useTranslations("organization");
  const [state, formAction, pending] = useActionState(
    connectOrgWhatsApp,
    initialState,
  );
  const [disconnecting, startDisconnect] = useTransition();

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageCircle className="size-5" />
          {t("whatsappTitle")}
        </h2>
        {connected ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
            <CheckCircle2 className="size-4" />
            {t("whatsappConnected")}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t("whatsappSubtitle")}</p>

      <form action={formAction} className="flex max-w-md flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone_number_id">{t("whatsappPhoneId")}</Label>
          <Input
            id="phone_number_id"
            name="phone_number_id"
            dir="ltr"
            inputMode="numeric"
            placeholder="1234567890"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="access_token">{t("whatsappToken")}</Label>
          <Input
            id="access_token"
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
                  await disconnectOrgWhatsApp();
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
