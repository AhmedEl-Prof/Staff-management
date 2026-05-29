import { createAdminClient } from "@/lib/supabase/admin";

// Point values from the roadmap.
export const POINTS = {
  TASK_ON_TIME: 10,
  TASK_EARLY: 15,
  STANDUP_COMPLETED: 5,
  PEER_REVIEW_HIGH: 20,
} as const;

// Stable reason codes stored on points_log.reason (used for idempotency +
// display).
export type PointReason =
  | "task_on_time"
  | "task_early"
  | "standup_completed"
  | "peer_review_high";

// Awards points to a user, idempotently: if a row already exists with the same
// (user_id, source_type, source_id, reason) we skip. Uses the service-role
// admin client (points_log writes are admin-only under RLS). Best-effort.
export async function awardPoints(args: {
  userId: string;
  points: number;
  reason: PointReason;
  sourceType: string;
  sourceId: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("points_log")
      .select("id")
      .eq("user_id", args.userId)
      .eq("source_type", args.sourceType)
      .eq("source_id", args.sourceId)
      .eq("reason", args.reason)
      .limit(1);
    if ((existing?.length ?? 0) > 0) return;

    await admin.from("points_log").insert({
      user_id: args.userId,
      points: args.points,
      reason: args.reason,
      source_type: args.sourceType,
      source_id: args.sourceId,
    });
  } catch (err) {
    console.error("[gamification] awardPoints failed", err);
  }
}

// Awards completion points for a task: +15 if finished before the due date,
// +10 if on/by the due date. Tasks with no due date count as on-time. No
// points for a task completed after its due date.
export async function awardTaskCompletion(task: {
  id: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
}): Promise<void> {
  if (!task.assigned_to || !task.completed_at) return;

  const completedDate = task.completed_at.slice(0, 10);
  let reason: PointReason = "task_on_time";
  let points: number = POINTS.TASK_ON_TIME;

  if (task.due_date) {
    if (completedDate > task.due_date) return; // late → no points
    if (completedDate < task.due_date) {
      reason = "task_early";
      points = POINTS.TASK_EARLY;
    }
  }

  await awardPoints({
    userId: task.assigned_to,
    points,
    reason,
    sourceType: "task",
    sourceId: task.id,
  });
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  points: number;
}

// Total points per user for the given month (default: current month).
export async function getMonthlyLeaderboard(
  ref: Date = new Date(),
): Promise<LeaderboardEntry[]> {
  const admin = createAdminClient();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1),
  );

  const { data: rows } = await admin
    .from("points_log")
    .select("user_id, points")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  const totals = new Map<string, number>();
  for (const r of rows ?? []) {
    totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + r.points);
  }
  if (totals.size === 0) return [];

  const ids = [...totals.keys()];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, arabic_name, full_name")
    .in("id", ids);
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.arabic_name || p.full_name || p.id]),
  );

  return [...totals.entries()]
    .map(([userId, points]) => ({
      userId,
      name: nameById.get(userId) ?? userId,
      points,
    }))
    .sort((a, b) => b.points - a.points);
}

// All-time total points for a single user (for the profile badge).
export async function getUserTotalPoints(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("points_log")
    .select("points")
    .eq("user_id", userId);
  return (data ?? []).reduce((sum, r) => sum + r.points, 0);
}
