import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";
import type { ProfileRow, TaskStatus, ProjectStatus } from "@/types/database";

// Aggregated analytics for the dashboard/analytics page. All counts respect
// the caller's scope: super admin = whole company; team leader = their
// departments; team member = self where applicable.

export interface StatusBreakdown<T extends string> {
  status: T;
  count: number;
}

export interface AnalyticsSummary {
  tasksByStatus: StatusBreakdown<TaskStatus>[];
  projectsByStatus: StatusBreakdown<ProjectStatus>[];
  totalTasks: number;
  completedTasks: number;
  completionRate: number; // 0-100
  overdueTasks: number;
  activeMembers: number;
}

const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
];
const PROJECT_STATUSES: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
];

// Returns the set of project ids in scope for the caller (or null = all).
async function scopedProjectIds(caller: ProfileRow): Promise<string[] | null> {
  const admin = createAdminClient();

  // Super admin: every project of their ORGANIZATION's departments.
  if (caller.role === "super_admin") {
    const { data: depts } = await admin
      .from("departments")
      .select("id")
      .eq("org_id", caller.org_id);
    const deptIds = (depts ?? []).map((d) => d.id);
    if (deptIds.length === 0) return [];
    const { data } = await admin
      .from("projects")
      .select("id")
      .in("department_id", deptIds);
    return [...new Set((data ?? []).map((p) => p.id))];
  }
  if (caller.role === "team_leader") {
    const deptIds = await getManagedDepartmentIds(caller.id);
    if (deptIds.length === 0) {
      // Still include projects they're an explicit member of.
      const { data } = await admin
        .from("project_members")
        .select("project_id")
        .eq("user_id", caller.id);
      return [...new Set((data ?? []).map((m) => m.project_id))];
    }
    const { data } = await admin
      .from("projects")
      .select("id")
      .in("department_id", deptIds);
    const ids = new Set((data ?? []).map((p) => p.id));
    const { data: memberOf } = await admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", caller.id);
    (memberOf ?? []).forEach((m) => ids.add(m.project_id));
    return [...ids];
  }

  // team_member: projects they're a member of.
  const { data } = await admin
    .from("project_members")
    .select("project_id")
    .eq("user_id", caller.id);
  return [...new Set((data ?? []).map((m) => m.project_id))];
}

export async function computeAnalytics(
  caller: ProfileRow,
): Promise<AnalyticsSummary> {
  const admin = createAdminClient();
  const projectIds = await scopedProjectIds(caller);
  const today = new Date().toISOString().slice(0, 10);

  // Projects in scope.
  let projectsQuery = admin.from("projects").select("id, status");
  if (projectIds) {
    if (projectIds.length === 0) {
      // Nothing in scope — return zeroed summary.
      return {
        tasksByStatus: TASK_STATUSES.map((s) => ({ status: s, count: 0 })),
        projectsByStatus: PROJECT_STATUSES.map((s) => ({ status: s, count: 0 })),
        totalTasks: 0,
        completedTasks: 0,
        completionRate: 0,
        overdueTasks: 0,
        activeMembers: 0,
      };
    }
    projectsQuery = projectsQuery.in("id", projectIds);
  }
  const { data: projects } = await projectsQuery;
  const projRows = projects ?? [];

  const projectsByStatus = PROJECT_STATUSES.map((status) => ({
    status,
    count: projRows.filter((p) => p.status === status).length,
  }));

  // Tasks in those projects.
  const inScopeProjectIds = projRows.map((p) => p.id);
  let taskRows: { status: TaskStatus; due_date: string | null }[] = [];
  if (inScopeProjectIds.length > 0) {
    const { data: tasks } = await admin
      .from("tasks")
      .select("status, due_date")
      .in("project_id", inScopeProjectIds);
    taskRows = (tasks ?? []) as typeof taskRows;
  }

  const tasksByStatus = TASK_STATUSES.map((status) => ({
    status,
    count: taskRows.filter((t) => t.status === status).length,
  }));

  const totalTasks = taskRows.length;
  const completedTasks = taskRows.filter((t) => t.status === "done").length;
  const completionRate =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const overdueTasks = taskRows.filter(
    (t) =>
      t.due_date &&
      t.due_date < today &&
      t.status !== "done" &&
      t.status !== "cancelled",
  ).length;

  // Active members (company-wide for super admin; managed scope otherwise).
  let activeMembers = 0;
  if (caller.role === "super_admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", caller.org_id)
      .eq("is_active", true);
    activeMembers = count ?? 0;
  } else {
    const deptIds = await getManagedDepartmentIds(caller.id);
    if (deptIds.length) {
      const { data: members } = await admin
        .from("department_members")
        .select("user_id")
        .in("department_id", deptIds);
      activeMembers = new Set((members ?? []).map((m) => m.user_id)).size;
    }
  }

  return {
    tasksByStatus,
    projectsByStatus,
    totalTasks,
    completedTasks,
    completionRate,
    overdueTasks,
    activeMembers,
  };
}
