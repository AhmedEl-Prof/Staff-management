"use server";

import { revalidatePath } from "next/cache";
import { requireUser, type SessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";

// Department manager (or super admin) may edit that department's template.
async function canManage(caller: SessionUser, departmentId: string) {
  if (caller.profile.role === "super_admin") return true;
  const managed = await getManagedDepartmentIds(caller.id);
  return managed.includes(departmentId);
}

export async function addTemplateItem(formData: FormData) {
  const caller = await requireUser();
  const departmentId = String(formData.get("department_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!departmentId || !label || !(await canManage(caller, departmentId))) return;

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("checklist_templates")
    .select("sort_order")
    .eq("department_id", departmentId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (last?.sort_order ?? -1) + 1;

  await admin.from("checklist_templates").insert({
    department_id: departmentId,
    label,
    sort_order: nextSort,
    created_by: caller.id,
  });

  revalidatePath("/checklists");
}

export async function updateTemplateItem(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  const departmentId = String(formData.get("department_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!id || !departmentId || !label || !(await canManage(caller, departmentId))) {
    return;
  }

  const admin = createAdminClient();
  await admin.from("checklist_templates").update({ label }).eq("id", id);
  revalidatePath("/checklists");
}

export async function deleteTemplateItem(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  const departmentId = String(formData.get("department_id") ?? "");
  if (!id || !departmentId || !(await canManage(caller, departmentId))) return;

  const admin = createAdminClient();
  await admin.from("checklist_templates").delete().eq("id", id);
  revalidatePath("/checklists");
}
