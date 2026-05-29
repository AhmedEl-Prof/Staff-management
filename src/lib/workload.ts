import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";
import type { ProfileRow, TaskStatus } from "@/types/database";

// Tasks in these statuses count toward a person's current load.
const ACTIVE_STATUSES: TaskStatus[] = ["todo", "in_progress", "review"];

// Tasks without an estimate still represent real work; we attribute a default
// number of hours so they aren't invisible to the balancer.
const DEFAULT_TASK_HOURS = 4;

export type WorkloadZone = "green" | "yellow" | "red";

export interface MemberWorkload {
  userId: string;
  name: string;
  weeklyHours: number;
  assignedHours: number;
  activeTasks: number;
  // assignedHours / weeklyHours as a percentage (can exceed 100).
  percent: number;
  zone: WorkloadZone;
}

// Visual zone thresholds from the roadmap: <70 green, 70-90 yellow, >90 red.
export function zoneFor(percent: number): WorkloadZone {
  if (percent > 90) return "red";
  if (percent >= 70) return "yellow";
  return "green";
}

// Computes the workload for a set of users. `userIds` scopes the result; when
// omitted, all active users are included.
export async function computeWorkloads(
  userIds?: string[],
): Promise<MemberWorkload[]> {
  const admin = createAdminClient();

  let profileQuery = admin
    .from("profiles")
    .select("id, arabic_name, full_name, weekly_hours, is_active")
    .eq("is_active", true);
  if (userIds) profileQuery = profileQuery.in("id", userIds);
  const { data: profiles } = await profileQuery;
  const people = profiles ?? [];
  if (people.length === 0) return [];

  const ids = people.map((p) => p.id);

  // Pull active tasks for these users in one query.
  const { data: tasks } = await admin
    .from("tasks")
    .select("assigned_to, estimated_hours, status")
    .in("assigned_to", ids)
    .in("status", ACTIVE_STATUSES);

  const hoursByUser = new Map<string, number>();
  const countByUser = new Map<string, number>();
  for (const task of tasks ?? []) {
    if (!task.assigned_to) continue;
    const hours = task.estimated_hours ?? DEFAULT_TASK_HOURS;
    hoursByUser.set(
      task.assigned_to,
      (hoursByUser.get(task.assigned_to) ?? 0) + hours,
    );
    countByUser.set(
      task.assigned_to,
      (countByUser.get(task.assigned_to) ?? 0) + 1,
    );
  }

  return people
    .map((p) => {
      const weeklyHours = p.weekly_hours || 40;
      const assignedHours = hoursByUser.get(p.id) ?? 0;
      const percent = Math.round((assignedHours / weeklyHours) * 100);
      return {
        userId: p.id,
        name: p.arabic_name || p.full_name || p.id,
        weeklyHours,
        assignedHours,
        activeTasks: countByUser.get(p.id) ?? 0,
        percent,
        zone: zoneFor(percent),
      } satisfies MemberWorkload;
    })
    .sort((a, b) => b.percent - a.percent);
}

// Workloads scoped to what a caller may oversee: super admins see everyone;
// team leaders see members of departments they manage; team members see only
// themselves.
export async function computeVisibleWorkloads(
  caller: ProfileRow,
): Promise<MemberWorkload[]> {
  if (caller.role === "super_admin") {
    return computeWorkloads();
  }

  if (caller.role === "team_leader") {
    const deptIds = await getManagedDepartmentIds(caller.id);
    if (deptIds.length === 0) return computeWorkloads([caller.id]);
    const admin = createAdminClient();
    const { data: members } = await admin
      .from("department_members")
      .select("user_id")
      .in("department_id", deptIds);
    const ids = new Set<string>([caller.id]);
    (members ?? []).forEach((m) => ids.add(m.user_id));
    return computeWorkloads([...ids]);
  }

  return computeWorkloads([caller.id]);
}
