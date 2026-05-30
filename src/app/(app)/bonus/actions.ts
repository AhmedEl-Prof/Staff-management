"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds, isCompanyWide } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";

// Bonus rows are department-scoped. We authorize the caller here (super admin /
// HR company-wide, or a manager of the department) and then write with the
// admin client — a server action's Supabase client doesn't reliably carry the
// caller's JWT to PostgREST, so relying on RLS for the write would reject it.
async function canManage(caller: SessionUser, departmentId: string) {
  if (isCompanyWide(caller.profile.role)) return true;
  const managed = await getManagedDepartmentIds(caller.id);
  return managed.includes(departmentId);
}

// Parses a numeric form field, treating blank as null (the columns are
// nullable so a row can omit a weight or a max).
function parseNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function addBonusItem(formData: FormData) {
  const caller = await requireUser();
  const departmentId = String(formData.get("department_id") ?? "");
  if (!departmentId || !(await canManage(caller, departmentId))) return;

  const item = String(formData.get("item") ?? "").trim();
  if (!item) return;

  const supabase = createAdminClient();

  // Append new rows after the existing ones.
  const { data: last } = await supabase
    .from("bonus_items")
    .select("sort_order")
    .eq("department_id", departmentId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (last?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("bonus_items").insert({
    department_id: departmentId,
    item,
    weight_percent: parseNumber(formData.get("weight_percent")),
    max_amount: parseNumber(formData.get("max_amount")),
    method: String(formData.get("method") ?? "").trim() || null,
    sort_order: nextSort,
    created_by: caller.id,
  });
  if (error) console.error("addBonusItem failed", error);

  revalidatePath("/bonus");
}

export async function updateBonusItem(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  const departmentId = String(formData.get("department_id") ?? "");
  if (!id || !departmentId || !(await canManage(caller, departmentId))) return;

  const item = String(formData.get("item") ?? "").trim();
  if (!item) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bonus_items")
    .update({
      item,
      weight_percent: parseNumber(formData.get("weight_percent")),
      max_amount: parseNumber(formData.get("max_amount")),
      method: String(formData.get("method") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) console.error("updateBonusItem failed", error);

  revalidatePath("/bonus");
}

export async function deleteBonusItem(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  const departmentId = String(formData.get("department_id") ?? "");
  if (!id || !departmentId || !(await canManage(caller, departmentId))) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from("bonus_items").delete().eq("id", id);
  if (error) console.error("deleteBonusItem failed", error);

  revalidatePath("/bonus");
}
