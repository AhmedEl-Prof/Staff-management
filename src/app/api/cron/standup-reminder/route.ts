import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// Daily Standup Bot — sends a morning reminder email to every active user who
// hasn't submitted today's standup yet. Intended to run at 09:00 Africa/Cairo
// (07:00 UTC) via Vercel Cron (see vercel.json).
//
// Protected by CRON_SECRET: Vercel Cron sends it as a Bearer token. Manual
// callers must supply the same secret.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: if the secret isn't configured, the endpoint is disabled
  // rather than left publicly callable.
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Active users…
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("is_active", true);
  const allIds = (profiles ?? []).map((p) => p.id);
  if (allIds.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  // …minus those who already submitted today.
  const { data: done } = await admin
    .from("standup_responses")
    .select("user_id")
    .eq("date", today);
  const doneIds = new Set((done ?? []).map((r) => r.user_id));
  const pending = allIds.filter((id) => !doneIds.has(id));

  let sent = 0;
  for (const userId of pending) {
    const { data } = await admin.auth.admin.getUserById(userId);
    const email = data.user?.email;
    if (!email) continue;

    const ok = await sendEmail({
      to: email,
      subject: "ستاندب الصباح — Everest Ads",
      bodyHtml: `
        <p style="margin:0 0 8px 0">صباح الخير ☀️</p>
        <p style="margin:0">فكّرنا نذكّرك تسجّل ستاندب النهارده: شغل أمس، خطة اليوم، وأي عوائق.</p>
      `,
      link: `${appUrl}/standup`,
      linkLabel: "سجّل ستاندب اليوم",
    });
    if (ok) sent++;
  }

  return NextResponse.json({ sent, skipped: doneIds.size, pending: pending.length });
}
