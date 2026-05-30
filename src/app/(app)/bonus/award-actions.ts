"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds, isCompanyWide } from "@/lib/permissions";
import { computeAmount, monthStart } from "@/lib/bonus-awards";
import { notifyUser } from "@/lib/notifications";
import type { SessionUser } from "@/lib/auth";
import type { BonusStatus } from "@/types/database";

// Awards are written by a department manager (or super admin / HR company-wide).
// Authorize here and write with the admin client (a server action's user client
// doesn't carry the JWT to PostgREST reliably).
async function canManage(caller: SessionUser, departmentId: string) {
  if (isCompanyWide(caller.profile.role)) return true;
  const managed = await getManagedDepartmentIds(caller.id);
  return managed.includes(departmentId);
}

// Saves the achievement % per bonus item for one employee + month, recomputing
// each earned amount from the department's bonus structure.
export async function saveBonusAwards(formData: FormData) {
  const caller = await requireUser();
  const departmentId = String(formData.get("department_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const period = monthStart(String(formData.get("month") ?? ""));
  if (!departmentId || !userId || !(await canManage(caller, departmentId))) {
    return;
  }

  const admin = createAdminClient();
  const { data: items } = await admin
    .from("bonus_items")
    .select("id, max_amount")
    .eq("department_id", departmentId);
  if (!items) return;

  const rows = items.map((item) => {
    const achievement = Number(formData.get(`ach_${item.id}`) ?? 0) || 0;
    return {
      user_id: userId,
      department_id: departmentId,
      period,
      bonus_item_id: item.id,
      achievement_percent: Math.min(100, Math.max(0, achievement)),
      amount: computeAmount(achievement, item.max_amount),
    };
  });

  if (rows.length > 0) {
    await admin
      .from("bonus_awards")
      .upsert(rows, { onConflict: "user_id,period,bonus_item_id" });
  }

  // Make sure a status header row exists (defaults to draft).
  await admin
    .from("bonus_periods")
    .upsert(
      { user_id: userId, department_id: departmentId, period },
      { onConflict: "user_id,period" },
    );

  revalidatePath("/bonus/awards");
}

// Updates the approval / payout status for an employee's monthly bonus.
export async function setBonusStatus(formData: FormData) {
  const caller = await requireUser();
  const departmentId = String(formData.get("department_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const period = monthStart(String(formData.get("month") ?? ""));
  const statusValue = String(formData.get("status") ?? "");
  const status: BonusStatus = ["draft", "approved", "paid"].includes(statusValue)
    ? (statusValue as BonusStatus)
    : "draft";
  if (!departmentId || !userId || !(await canManage(caller, departmentId))) {
    return;
  }

  const admin = createAdminClient();
  await admin.from("bonus_periods").upsert(
    {
      user_id: userId,
      department_id: departmentId,
      period,
      status,
      approved_by: status === "draft" ? null : caller.id,
      approved_at: status === "draft" ? null : new Date().toISOString(),
    },
    { onConflict: "user_id,period" },
  );

  // Let the employee know once their bonus is approved or marked paid.
  if (status !== "draft" && userId !== caller.id) {
    await notifyUser({
      userId,
      type: "bonus_status",
      title: status === "paid" ? "تم صرف بونصك" : "تم اعتماد بونصك",
      message: period.slice(0, 7),
      link: "/bonus/awards",
      inAppOnly: true,
    });
  }

  revalidatePath("/bonus/awards");
}
