"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Globe, RefreshCw, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPortalLink, revokePortalLink } from "./portal-actions";

// Manager-only card for the client portal link: create/regenerate the secret
// link, copy it, or revoke it. The link itself is the credential, so it is
// rendered read-only and copied via the clipboard API.
export function ProjectPortalSection({
  projectId,
  portalUrl,
}: {
  projectId: string;
  portalUrl: string | null;
}) {
  const t = useTranslations("portal");
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function run(action: (fd: FormData) => Promise<void>) {
    const fd = new FormData();
    fd.set("project_id", projectId);
    startTransition(async () => {
      await action(fd);
    });
  }

  async function copy() {
    if (!portalUrl) return;
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Globe className="size-5" />
          {t("title")}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={portalUrl ? "outline" : "default"}
            disabled={pending}
            onClick={() => run(createPortalLink)}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            {portalUrl ? t("regenerate") : t("create")}
          </Button>
          {portalUrl ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run(revokePortalLink)}
              className="gap-2"
            >
              <ShieldOff className="size-4" />
              {t("revoke")}
            </Button>
          ) : null}
        </div>
      </div>

      {portalUrl ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              dir="ltr"
              value={portalUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copy}
              className="shrink-0 gap-2"
            >
              {copied ? (
                <Check className="size-4 text-green-600" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      )}
    </section>
  );
}
