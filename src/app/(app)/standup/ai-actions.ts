"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManageableEmployees } from "@/lib/permissions";
import { generateText, aiConfigured, type AiState } from "@/lib/ai";
import type { StandupResponseRow } from "@/types/database";

const SYSTEM = `You are an assistant for a team manager at a marketing/creative agency.
Summarize the team's daily standup for the manager.
Reply in the SAME language the entries are written in (use Arabic if they are in Arabic).
Be concise and practical. Structure the summary as:
1. One short line on the overall status / mood of the team.
2. "اليوم / Today" — a few bullets of the most important things people are working on.
3. "محتاج انتباه / Needs attention" — list ONLY real blockers, each with who is affected. If there are none, say so in one line.
Do not invent information. Output only the summary — no preamble, no sign-off.`;

export async function summarizeStandup(): Promise<AiState> {
  const { profile } = await requireUser();

  const manageable = await getManageableEmployees(profile);
  if (profile.role !== "super_admin" && manageable.length === 0) {
    return { error: "forbidden" };
  }
  if (!aiConfigured()) return { error: "no_ai" };

  const today = new Date().toISOString().slice(0, 10);
  const admin = createAdminClient();
  const nameById = new Map(manageable.map((m) => [m.id, m.label]));

  let query = admin
    .from("standup_responses")
    .select("*")
    .eq("date", today);
  // Team leaders only see their team; super admins see everyone.
  if (profile.role !== "super_admin") {
    query = query.in("user_id", manageable.map((m) => m.id));
  }
  const { data } = await query;
  const rows = (data ?? []) as StandupResponseRow[];
  if (rows.length === 0) return { error: "no_data" };

  const entries = rows
    .map((r) => {
      const name = nameById.get(r.user_id) ?? "Member";
      return [
        `- ${name} (mood: ${r.mood ?? "—"})`,
        `  Yesterday: ${r.yesterday_work || "—"}`,
        `  Today: ${r.today_plan || "—"}`,
        `  Blockers: ${r.blockers || "none"}`,
      ].join("\n");
    })
    .join("\n");

  try {
    const text = await generateText({
      system: SYSTEM,
      prompt: `Today's standup (${rows.length} member${rows.length === 1 ? "" : "s"}):\n\n${entries}`,
    });
    return { text };
  } catch (error) {
    console.error("summarizeStandup failed", error);
    return { error: "failed" };
  }
}
