import { getTranslations } from "next-intl/server";
import { CheckCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { NotificationsRealtime } from "./realtime";
import { NotificationRow } from "./notification-row";
import { markAllNotificationsRead } from "./actions";

export default async function NotificationsPage() {
  const { id: userId } = await requireUser();
  const t = await getTranslations("notifications");

  // RLS scopes the result to the caller's own rows.
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const notifications = rows ?? [];
  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {hasUnread ? (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="outline" size="sm" className="gap-2">
              <CheckCheck className="size-4" />
              {t("markAllRead")}
            </Button>
          </form>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li key={n.id}>
              <NotificationRow
                id={n.id}
                title={n.title}
                message={n.message}
                link={n.link}
                createdAt={n.created_at}
                isRead={n.is_read}
              />
            </li>
          ))}
        </ul>
      )}

      <NotificationsRealtime userId={userId} />
    </div>
  );
}
