"use server";

import { revalidatePath } from "next/cache";
import { requireUser, type SessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds, isCompanyWide } from "@/lib/permissions";

// Department manager, HR, or super admin may edit that department's tools.
async function canManage(caller: SessionUser, departmentId: string) {
  if (isCompanyWide(caller.profile.role)) return true;
  const managed = await getManagedDepartmentIds(caller.id);
  return managed.includes(departmentId);
}

function clean(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function addTool(formData: FormData) {
  const caller = await requireUser();
  const departmentId = String(formData.get("department_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!departmentId || !name || !(await canManage(caller, departmentId))) return;

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("department_tools")
    .select("sort_order")
    .eq("department_id", departmentId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (last?.sort_order ?? -1) + 1;

  await admin.from("department_tools").insert({
    department_id: departmentId,
    name,
    url: clean(formData.get("url")),
    username: clean(formData.get("username")),
    password: clean(formData.get("password")),
    notes: clean(formData.get("notes")),
    sort_order: nextSort,
    created_by: caller.id,
  });

  revalidatePath("/tools");
}

export async function updateTool(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  const departmentId = String(formData.get("department_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !departmentId || !name || !(await canManage(caller, departmentId))) {
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("department_tools")
    .update({
      name,
      url: clean(formData.get("url")),
      username: clean(formData.get("username")),
      password: clean(formData.get("password")),
      notes: clean(formData.get("notes")),
    })
    .eq("id", id);

  revalidatePath("/tools");
}

export async function deleteTool(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  const departmentId = String(formData.get("department_id") ?? "");
  if (!id || !departmentId || !(await canManage(caller, departmentId))) return;

  const admin = createAdminClient();
  await admin.from("department_tools").delete().eq("id", id);

  revalidatePath("/tools");
}
