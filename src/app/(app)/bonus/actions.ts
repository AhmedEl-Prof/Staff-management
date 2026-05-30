"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getManagedDepartmentIds } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";

// Bonus rows are department-scoped. RLS already restricts writes to managers /
// super admins (manages_department), but we also verify here so a non-manager
// request is rejected early without touching the database.
async function canManage(caller: SessionUser, departmentId: string) {
  if (caller.profile.role === "super_admin") return true;
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

  const supabase = await createClient();

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

  const supabase = await createClient();
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

  const supabase = await createClient();
  const { error } = await supabase.from("bonus_items").delete().eq("id", id);
  if (error) console.error("deleteBonusItem failed", error);

  revalidatePath("/bonus");
}
