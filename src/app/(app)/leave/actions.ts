"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageUser } from "@/lib/permissions";
import { countLeaveDays, currentYear } from "@/lib/leave";
import { notifyUser } from "@/lib/notifications";
import type { LeaveType, LeaveStatus } from "@/types/database";

function asLeaveType(v: FormDataEntryValue | null): LeaveType | null {
  const s = String(v ?? "");
  return s === "annual" || s === "sick" || s === "casual" ? s : null;
}

// Employee submits a leave request for themselves.
export async function createLeaveRequest(formData: FormData) {
  const caller = await requireUser();
  const type = asLeaveType(formData.get("type"));
  const start = String(formData.get("start_date") ?? "");
  const end = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const days = countLeaveDays(start, end);
  if (!type || days <= 0) return;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("department_members")
    .select("department_id")
    .eq("user_id", caller.id)
    .limit(1)
    .maybeSingle();

  await admin.from("leave_requests").insert({
    user_id: caller.id,
    department_id: membership?.department_id ?? null,
    type,
    start_date: start,
    end_date: end,
    days,
    reason,
  });

  // Best-effort: notify the department manager there's a request to review.
  if (membership?.department_id) {
    const { data: dept } = await admin
      .from("departments")
      .select("manager_id")
      .eq("id", membership.department_id)
      .maybeSingle();
    if (dept?.manager_id && dept.manager_id !== caller.id) {
      await notifyUser({
        userId: dept.manager_id,
        type: "leave_update",
        title: "طلب أجازة جديد",
        message: caller.profile.arabic_name || caller.profile.full_name || undefined,
        link: "/leave",
        inAppOnly: true,
      });
    }
  }

  revalidatePath("/leave");
}

// Employee cancels their own pending request.
export async function cancelLeaveRequest(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  await admin
    .from("leave_requests")
    .update({ status: "cancelled" satisfies LeaveStatus })
    .eq("id", id)
    .eq("user_id", caller.id)
    .eq("status", "pending");

  revalidatePath("/leave");
}

// Manager approves or rejects a team member's request.
export async function reviewLeaveRequest(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("review_note") ?? "").trim() || null;
  if (!id || (decision !== "approved" && decision !== "rejected")) return;

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("leave_requests")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!req) return;

  // Managers can't approve their own leave (only a super admin could).
  if (req.user_id === caller.id && caller.profile.role !== "super_admin") return;
  if (!(await canManageUser(caller.profile, req.user_id))) return;

  await admin
    .from("leave_requests")
    .update({
      status: decision as LeaveStatus,
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
      review_note: note,
    })
    .eq("id", id);

  await notifyUser({
    userId: req.user_id,
    type: "leave_update",
    title: decision === "approved" ? "تمت الموافقة على أجازتك" : "تم رفض طلب أجازتك",
    message: note || undefined,
    link: "/leave",
    inAppOnly: true,
  });

  revalidatePath("/leave");
}

// Manager sets an employee's yearly quotas.
export async function saveLeaveBalance(formData: FormData) {
  const caller = await requireUser();
  const userId = String(formData.get("user_id") ?? "");
  const year = Number(formData.get("year")) || currentYear();
  if (!userId) return;
  if (userId === caller.id && caller.profile.role !== "super_admin") return;
  if (!(await canManageUser(caller.profile, userId))) return;

  const num = (v: FormDataEntryValue | null, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const admin = createAdminClient();
  await admin.from("leave_balances").upsert(
    {
      user_id: userId,
      year,
      annual_quota: num(formData.get("annual_quota"), 21),
      sick_quota: num(formData.get("sick_quota"), 7),
      casual_quota: num(formData.get("casual_quota"), 7),
    },
    { onConflict: "user_id,year" },
  );

  revalidatePath("/leave");
}
