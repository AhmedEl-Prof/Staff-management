import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// Notification "type" — drives which preference flag gates the email.
export type NotificationType =
  | "task_assigned"
  | "task_deadline"
  | "mention"
  | "evaluation"
  | "project_member_added"
  | "bonus_status"
  | "leave_update";

// Maps a notification type to the column in notification_preferences that
// gates email delivery for it.
const EMAIL_PREF_COLUMN: Record<NotificationType, string> = {
  task_assigned: "email_task_assigned",
  task_deadline: "email_task_deadline",
  mention: "email_mentions",
  evaluation: "email_evaluations",
  project_member_added: "email_task_assigned",
  bonus_status: "email_evaluations",
  leave_update: "email_evaluations",
};

export interface NotifyArgs {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  /** App-relative link (e.g. /projects/X/tasks/Y). */
  link?: string;
  /** Skip sending an email even if the user has opted in. */
  inAppOnly?: boolean;
}

// Records an in-app notification for a user, and — if their preferences allow
// — sends an email too. Best-effort: failures are logged but never thrown.
//
// The DB has RLS on notifications; this helper uses the service-role admin
// client so server-initiated notifications work without per-row insert
// policies for end users.
export async function notifyUser(args: NotifyArgs): Promise<void> {
  const admin = createAdminClient();

  // Don't notify a user about their own action.
  // (Callers can short-circuit too, but this is a useful safety net.)

  try {
    await admin.from("notifications").insert({
      user_id: args.userId,
      type: args.type,
      title: args.title,
      message: args.message ?? null,
      link: args.link ?? null,
    });
  } catch (err) {
    console.error("[notify] insert failed", err);
  }

  if (args.inAppOnly) return;

  // Look up preferences + email in parallel.
  try {
    const [{ data: prefs }, { data: authRow }] = await Promise.all([
      admin
        .from("notification_preferences")
        .select(
          "email_task_assigned, email_task_deadline, email_mentions, email_evaluations",
        )
        .eq("user_id", args.userId)
        .maybeSingle(),
      admin.auth.admin.getUserById(args.userId),
    ]);

    const wantsEmail = prefs
      ? (prefs as unknown as Record<string, boolean>)[
          EMAIL_PREF_COLUMN[args.type]
        ] !== false
      : true;
    const email = authRow.user?.email;
    if (!wantsEmail || !email) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = args.link ? `${appUrl}${args.link}` : undefined;
    const bodyHtml = `
      <p style="margin:0 0 8px 0;font-weight:bold">${escapeHtml(args.title)}</p>
      ${args.message ? `<p style="margin:0">${escapeHtml(args.message)}</p>` : ""}
    `;
    await sendEmail({
      to: email,
      subject: args.title,
      bodyHtml,
      link,
      linkLabel: "عرض في السيستم",
    });
  } catch (err) {
    console.error("[notify] email path failed", err);
  }
}

// Convenience: notify many users in parallel, skipping duplicates and the
// optional `excludeUserId` (typically the actor's own id).
export async function notifyMany(
  userIds: string[],
  base: Omit<NotifyArgs, "userId">,
  excludeUserId?: string,
): Promise<void> {
  const unique = [...new Set(userIds)].filter((id) => id !== excludeUserId);
  await Promise.all(unique.map((userId) => notifyUser({ ...base, userId })));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
