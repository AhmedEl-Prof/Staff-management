import { createAdminClient } from "@/lib/supabase/admin";
import {
  getManageableEmployees,
  getManagedDepartmentIds,
  canManagePeople,
  isCompanyWide,
} from "@/lib/permissions";
import type { ProfileRow, TaskStatus } from "@/types/database";

export interface AttentionItem {
  // Stable key for React.
  key: string;
  // Translation key under the "attention" namespace.
  labelKey:
    | "overdueTasks"
    | "leaveToReview"
    | "myChecklist"
    | "bonusDrafts";
  count: number;
  href: string;
}

const ACTIVE: TaskStatus[] = ["todo", "in_progress", "review"];

// Builds the "needs attention" list for the dashboard: actionable counts with a
// direct link each. Personal items for everyone; manager items (leave to
// review, draft bonuses) only when the caller manages people.
export async function getAttentionItems(
  userId: string,
  profile: ProfileRow,
): Promise<AttentionItem[]> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const isManager = canManagePeople(profile.role);

  const items: AttentionItem[] = [];

  // -- Personal: my overdue tasks --------------------------------------------
  const { data: overdue } = await admin
    .from("tasks")
    .select("id")
    .eq("assigned_to", userId)
    .in("status", ACTIVE)
    .lt("due_date", today);
  if ((overdue?.length ?? 0) > 0) {
    items.push({
      key: "overdue",
      labelKey: "overdueTasks",
      count: overdue!.length,
      href: "/",
    });
  }

  // -- Personal: checklist items assigned to me, still open ------------------
  const { data: checklist } = await admin
    .from("project_checklist_items")
    .select("id, project_id")
    .eq("assigned_to", userId)
    .eq("done", false);
  if ((checklist?.length ?? 0) > 0) {
    const onlyProject =
      new Set(checklist!.map((c) => c.project_id)).size === 1
        ? checklist![0].project_id
        : null;
    items.push({
      key: "checklist",
      labelKey: "myChecklist",
      count: checklist!.length,
      href: onlyProject ? `/projects/${onlyProject}` : "/projects",
    });
  }

  // -- Manager: leave requests awaiting my review ----------------------------
  if (isManager) {
    const manageable = await getManageableEmployees(profile);
    const teamIds = manageable.map((m) => m.id).filter((id) => id !== userId);
    if (teamIds.length > 0) {
      const { data: pending } = await admin
        .from("leave_requests")
        .select("id")
        .in("user_id", teamIds)
        .eq("status", "pending");
      if ((pending?.length ?? 0) > 0) {
        items.push({
          key: "leave",
          labelKey: "leaveToReview",
          count: pending!.length,
          href: "/leave",
        });
      }
    }

    // -- Manager: bonus sheets still in draft (this month) -------------------
    const managedDeptIds = isCompanyWide(profile.role)
      ? (await admin.from("departments").select("id")).data?.map((d) => d.id) ?? []
      : await getManagedDepartmentIds(userId);
    if (managedDeptIds.length > 0) {
      const period = `${today.slice(0, 7)}-01`;
      const { data: drafts } = await admin
        .from("bonus_periods")
        .select("id")
        .in("department_id", managedDeptIds)
        .eq("period", period)
        .eq("status", "draft");
      if ((drafts?.length ?? 0) > 0) {
        items.push({
          key: "bonus",
          labelKey: "bonusDrafts",
          count: drafts!.length,
          href: "/bonus/awards",
        });
      }
    }
  }

  return items;
}
