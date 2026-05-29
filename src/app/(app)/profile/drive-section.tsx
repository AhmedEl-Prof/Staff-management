import { getTranslations } from "next-intl/server";
import { CheckCircle2, Link as LinkIcon } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { disconnectDrive } from "./drive-actions";

const DRIVE_ERROR_KEYS: Record<string, string> = {
  config: "errorConfig",
  denied: "errorDenied",
  auth: "errorAuth",
  exchange: "errorExchange",
  refresh: "errorRefresh",
  invalid: "errorInvalid",
};

export async function DriveSection({
  userId,
  status,
  errorCode,
}: {
  userId: string;
  status?: string;
  errorCode?: string;
}) {
  const t = await getTranslations("drive");
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("drive_connections")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const connected = !!row;
  const errorKey = errorCode ? DRIVE_ERROR_KEYS[errorCode] : null;

  return (
    <section className="flex max-w-lg flex-col gap-4 rounded-lg border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex items-center gap-2">
        {connected ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="size-3" />
            {t("connected")}
          </Badge>
        ) : (
          <Badge variant="muted">{t("notConnected")}</Badge>
        )}
      </div>

      {status === "connected" ? (
        <p className="text-sm text-green-600">{t("connectedMsg")}</p>
      ) : null}
      {errorKey ? (
        <p className="text-sm text-destructive">{t(errorKey)}</p>
      ) : null}

      <div className="flex items-center gap-3">
        {connected ? (
          <form action={disconnectDrive}>
            <Button type="submit" variant="outline">
              {t("disconnect")}
            </Button>
          </form>
        ) : (
          <a
            href="/api/drive/connect"
            className={buttonVariants({ className: "gap-2" })}
          >
            <LinkIcon className="size-4" />
            {t("connect")}
          </a>
        )}
      </div>
    </section>
  );
}
