import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeEvaluation,
  kpiScoresToJson,
  periodRange,
} from "@/lib/evaluations";

// Monthly evaluation generator. Intended to run on the 1st of each month for
// the *previous* month. Creates a draft evaluation for every active user that
// doesn't already have one for the period. Managers then review/finalize/send
// from the UI.
//
// Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token).
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

  // Previous month's period: take a date in the prior month.
  const now = new Date();
  const refPrevMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15),
  );
  const { start, end } = periodRange("monthly", refPrevMonth);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("is_active", true);
  const userIds = (profiles ?? []).map((p) => p.id);
  if (userIds.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  // Skip users who already have a monthly evaluation for this period.
  const { data: existing } = await admin
    .from("evaluations")
    .select("user_id")
    .eq("period_type", "monthly")
    .eq("period_start", start)
    .eq("period_end", end);
  const done = new Set((existing ?? []).map((e) => e.user_id));

  let created = 0;
  for (const userId of userIds) {
    if (done.has(userId)) continue;
    const { kpiScores, totalScore } = await computeEvaluation(
      userId,
      "monthly",
      start,
      end,
    );
    const { error } = await admin.from("evaluations").insert({
      user_id: userId,
      evaluator_id: null,
      period_type: "monthly",
      period_start: start,
      period_end: end,
      total_score: totalScore,
      kpi_scores: kpiScoresToJson(kpiScores),
      status: "draft",
    });
    if (!error) created++;
  }

  return NextResponse.json({ created, period: { start, end } });
}
