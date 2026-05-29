"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Marks every unread notification for the caller as read.
export async function markAllNotificationsRead() {
  const caller = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", caller.id)
    .eq("is_read", false);

  revalidatePath("/notifications");
}

// Marks a single notification read. Used when the user clicks the in-app
// notification to follow its link.
export async function markNotificationRead(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", caller.id);

  revalidatePath("/notifications");
}

const prefsSchema = z.object({
  email_task_assigned: z.coerce.boolean(),
  email_task_deadline: z.coerce.boolean(),
  email_mentions: z.coerce.boolean(),
  email_evaluations: z.coerce.boolean(),
  in_app_notifications: z.coerce.boolean(),
});

export type PrefsState = { saved: boolean };

// Updates the caller's notification preferences. The row is auto-created by
// the handle_new_user trigger; here we just upsert in case it's missing.
export async function updateNotificationPrefs(
  _prev: PrefsState,
  formData: FormData,
): Promise<PrefsState> {
  const caller = await requireUser();

  // HTML checkboxes only submit a value when checked, so missing keys default
  // to false here.
  const parsed = prefsSchema.safeParse({
    email_task_assigned: formData.get("email_task_assigned") === "on",
    email_task_deadline: formData.get("email_task_deadline") === "on",
    email_mentions: formData.get("email_mentions") === "on",
    email_evaluations: formData.get("email_evaluations") === "on",
    in_app_notifications: formData.get("in_app_notifications") === "on",
  });
  if (!parsed.success) return { saved: false };

  const supabase = await createClient();
  await supabase
    .from("notification_preferences")
    .upsert(
      { user_id: caller.id, ...parsed.data },
      { onConflict: "user_id" },
    );

  revalidatePath("/profile");
  return { saved: true };
}
