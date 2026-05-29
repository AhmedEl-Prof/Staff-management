"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { markNotificationRead } from "./actions";

// Renders a single notification row. If the notification has a link, clicking
// it marks the row read via the server action and then navigates.
export function NotificationRow({
  id,
  title,
  message,
  link,
  createdAt,
  isRead,
}: {
  id: string;
  title: string;
  message: string | null;
  link: string | null;
  createdAt: string;
  isRead: boolean;
}) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          {!isRead ? <Badge variant="default">{t("unread")}</Badge> : null}
        </div>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground" dir="ltr">
        {new Date(createdAt).toLocaleString()}
      </span>
    </div>
  );

  const className = `block rounded-lg border p-4 transition-colors ${
    isRead ? "" : "border-primary/50 bg-primary/5"
  } ${link ? "hover:bg-muted/40" : ""} ${pending ? "opacity-70" : ""}`;

  if (!link) return <div className={className}>{body}</div>;

  return (
    <Link
      href={link}
      onClick={(e) => {
        if (isRead) return;
        e.preventDefault();
        startTransition(async () => {
          const fd = new FormData();
          fd.set("id", id);
          await markNotificationRead(fd);
          router.push(link);
        });
      }}
      className={className}
    >
      {body}
    </Link>
  );
}
