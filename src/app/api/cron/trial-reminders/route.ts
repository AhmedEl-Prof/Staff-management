import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeCompare } from "@/lib/safe-compare";
import { sendEmail } from "@/lib/email";

// Daily trial-expiry reminders: emails each trial org's super admins during
// the last 3 days of their trial (so up to 3 nudges). Protected by
// CRON_SECRET like the other cron routes.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (!safeCompare(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const windowEnd = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date(now).toISOString();

  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, settings")
    .eq("plan", "trial")
    .eq("is_active", true);

  let sent = 0;
  for (const org of orgs ?? []) {
    const settings = (org.settings ?? {}) as { trial_ends_at?: string };
    const endsAt = settings.trial_ends_at;
    if (!endsAt || endsAt <= nowIso || endsAt > windowEnd) continue;

    const daysLeft = Math.max(
      1,
      Math.ceil((new Date(endsAt).getTime() - now) / (24 * 60 * 60 * 1000)),
    );

    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("org_id", org.id)
      .eq("role", "super_admin")
      .eq("is_active", true);

    for (const p of admins ?? []) {
      const { data: authRow } = await admin.auth.admin.getUserById(p.id);
      const email = authRow.user?.email;
      if (!email) continue;

      const ok = await sendEmail({
        to: email,
        subject: `تنبيه: تجربة ${org.name} المجانية تنتهي خلال ${daysLeft} يوم`,
        bodyHtml: `
          <p style="margin:0 0 8px 0">مرحباً 👋</p>
          <p style="margin:0">التجربة المجانية لشركة <b>${escapeHtml(org.name)}</b> تنتهي خلال <b>${daysLeft}</b> يوم. كل بياناتكم محفوظة — للاستمرار بدون انقطاع تواصل معنا للترقية.</p>
        `,
      });
      if (ok) sent++;
    }
  }

  return NextResponse.json({ sent });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
