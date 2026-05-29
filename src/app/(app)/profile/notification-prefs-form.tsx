"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  updateNotificationPrefs,
  type PrefsState,
} from "../notifications/actions";

const initial: PrefsState = { saved: false };

export interface PrefsInitial {
  email_task_assigned: boolean;
  email_task_deadline: boolean;
  email_mentions: boolean;
  email_evaluations: boolean;
  in_app_notifications: boolean;
}

const FIELDS: Array<{ name: keyof PrefsInitial; labelKey: string }> = [
  { name: "email_task_assigned", labelKey: "emailTaskAssigned" },
  { name: "email_task_deadline", labelKey: "emailTaskDeadline" },
  { name: "email_mentions", labelKey: "emailMentions" },
  { name: "email_evaluations", labelKey: "emailEvaluations" },
  { name: "in_app_notifications", labelKey: "inAppNotifications" },
];

export function NotificationPrefsForm({ initialPrefs }: { initialPrefs: PrefsInitial }) {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState(
    updateNotificationPrefs,
    initial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {FIELDS.map(({ name, labelKey }) => (
        <label
          key={name}
          className="flex items-center gap-2 text-sm"
        >
          <input
            type="checkbox"
            name={name}
            defaultChecked={initialPrefs[name]}
            className="size-4 accent-primary"
          />
          {t(labelKey)}
        </label>
      ))}

      {state.saved ? (
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
