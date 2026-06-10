import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { DriveSection } from "./drive-section";
import { NotificationPrefsForm, type PrefsInitial } from "./notification-prefs-form";
import { MfaSettings } from "./mfa-settings";
import { PushToggle } from "./push-toggle";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const DEFAULT_PREFS: PrefsInitial = {
  email_task_assigned: true,
  email_task_deadline: true,
  email_mentions: true,
  email_evaluations: true,
  in_app_notifications: true,
  whatsapp_notifications: true,
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string; drive_error?: string }>;
}) {
  const { profile, email, id } = await requireUser();
  const t = await getTranslations("profile");
  const tNotif = await getTranslations("notifications");
  const sp = await searchParams;

  // notification_preferences is created by the handle_new_user trigger; the
  // fallback covers users provisioned before the trigger existed.
  const supabase = await createClient();
  const { data: prefRow } = await supabase
    .from("notification_preferences")
    .select(
      "email_task_assigned, email_task_deadline, email_mentions, email_evaluations, in_app_notifications, whatsapp_notifications",
    )
    .eq("user_id", id)
    .maybeSingle();
  const initialPrefs: PrefsInitial = prefRow ?? DEFAULT_PREFS;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground" dir="ltr">
          {email}
        </p>
      </div>
      <ProfileForm profile={profile} />
      <DriveSection userId={id} status={sp.drive} errorCode={sp.drive_error} />
      <section className="flex max-w-lg flex-col gap-4 rounded-lg border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold">{tNotif("preferences")}</h2>
          <p className="text-sm text-muted-foreground">
            {tNotif("preferencesSubtitle")}
          </p>
        </div>
        <NotificationPrefsForm initialPrefs={initialPrefs} />
        {VAPID_PUBLIC_KEY ? (
          <PushToggle vapidPublicKey={VAPID_PUBLIC_KEY} />
        ) : null}
      </section>
      <div className="max-w-lg">
        <MfaSettings />
      </div>
    </div>
  );
}
