"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildRatings,
  currentReviewPeriod,
  type PeerRatings,
} from "@/lib/peer-review";

const schema = z.object({
  reviewee_id: z.string().uuid(),
  comments: z.string().trim().max(2000).optional(),
  is_anonymous: z.boolean(),
});

export type PeerReviewState = { error: string | null; saved: boolean };

// Submits (or updates) a behavioural peer review for a colleague for the
// current month. One review per (reviewer, reviewee, month) — re-submitting
// updates the existing row (upsert on the 0012 unique constraint).
//
// RLS (peer_reviews_insert / peer_reviews_modify_own) requires
// reviewer_id = auth.uid(); we set it server-side so it can't be spoofed.
export async function submitPeerReview(
  _prev: PeerReviewState,
  formData: FormData,
): Promise<PeerReviewState> {
  const caller = await requireUser();

  const parsed = schema.safeParse({
    reviewee_id: formData.get("reviewee_id"),
    comments: formData.get("comments") || undefined,
    is_anonymous: formData.get("is_anonymous") === "on",
  });
  if (!parsed.success) return { error: "invalid", saved: false };

  // Can't review yourself.
  if (parsed.data.reviewee_id === caller.id) {
    return { error: "invalid", saved: false };
  }

  // Reviewee must be an active employee.
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, is_active")
    .eq("id", parsed.data.reviewee_id)
    .maybeSingle();
  if (!target || !target.is_active) {
    return { error: "invalid", saved: false };
  }

  const ratings: PeerRatings = buildRatings((k) => formData.get(k));
  const { start, end } = currentReviewPeriod();

  const supabase = await createClient();
  const { error } = await supabase.from("peer_reviews").upsert(
    {
      reviewer_id: caller.id,
      reviewee_id: parsed.data.reviewee_id,
      period_start: start,
      period_end: end,
      ratings: ratings as unknown as Record<string, number>,
      comments: parsed.data.comments ?? null,
      is_anonymous: parsed.data.is_anonymous,
    },
    { onConflict: "reviewer_id,reviewee_id,period_start" },
  );

  if (error) return { error: "invalid", saved: false };

  revalidatePath("/peer-review");
  return { error: null, saved: true };
}
