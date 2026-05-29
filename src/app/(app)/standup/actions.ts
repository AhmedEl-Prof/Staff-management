"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { awardPoints, POINTS } from "@/lib/gamification";

const MOODS = ["great", "good", "okay", "stressed", "blocked"] as const;

const standupSchema = z.object({
  yesterday_work: z.string().trim().max(2000).optional(),
  today_plan: z.string().trim().max(2000).optional(),
  blockers: z.string().trim().max(2000).optional(),
  mood: z.enum(MOODS).optional(),
});

export type StandupState = { submitted: boolean };

// Records (or updates) the caller's standup for today. The unique
// (user_id, date) constraint makes this an idempotent upsert per day.
export async function submitStandup(
  _prev: StandupState,
  formData: FormData,
): Promise<StandupState> {
  const caller = await requireUser();
  const moodRaw = String(formData.get("mood") ?? "");

  const parsed = standupSchema.safeParse({
    yesterday_work: formData.get("yesterday_work") || undefined,
    today_plan: formData.get("today_plan") || undefined,
    blockers: formData.get("blockers") || undefined,
    mood: (MOODS as readonly string[]).includes(moodRaw) ? moodRaw : undefined,
  });
  if (!parsed.success) return { submitted: false };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Was today's standup already recorded? Used to award points only once/day.
  const { data: alreadyToday } = await supabase
    .from("standup_responses")
    .select("id")
    .eq("user_id", caller.id)
    .eq("date", today)
    .maybeSingle();

  const { data: saved } = await supabase
    .from("standup_responses")
    .upsert(
      {
        user_id: caller.id,
        date: today,
        yesterday_work: parsed.data.yesterday_work ?? null,
        today_plan: parsed.data.today_plan ?? null,
        blockers: parsed.data.blockers ?? null,
        mood: parsed.data.mood ?? null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" },
    )
    .select("id")
    .single();

  // Award standup points once per day (only on first submission). The standup
  // row id is the dedupe source_id, and awardPoints is itself idempotent.
  if (!alreadyToday && saved) {
    await awardPoints({
      userId: caller.id,
      points: POINTS.STANDUP_COMPLETED,
      reason: "standup_completed",
      sourceType: "standup",
      sourceId: saved.id,
    });
  }

  revalidatePath("/standup");
  return { submitted: true };
}
