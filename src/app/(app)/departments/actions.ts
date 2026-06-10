"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Department management is restricted to super admins (RLS enforces this too;
// requireRole gives a friendlier redirect and guards the server action).

const departmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  name_ar: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  color: z.string().trim().max(20).optional(),
  icon: z.string().trim().max(40).optional(),
  manager_id: z.string().uuid().optional(),
});

export async function createDepartment(formData: FormData) {
  const caller = await requireRole(["super_admin"]);
  const parsed = departmentSchema.safeParse({
    name: formData.get("name"),
    name_ar: formData.get("name_ar"),
    description: formData.get("description") || undefined,
    color: formData.get("color") || undefined,
    icon: formData.get("icon") || undefined,
    manager_id: formData.get("manager_id") || undefined,
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("departments").insert({
    org_id: caller.profile.org_id,
    name: parsed.data.name,
    name_ar: parsed.data.name_ar,
    description: parsed.data.description ?? null,
    color: parsed.data.color ?? null,
    icon: parsed.data.icon ?? null,
    manager_id: parsed.data.manager_id ?? null,
  });

  revalidatePath("/departments");
  redirect("/departments");
}

export async function updateDepartment(formData: FormData) {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id") ?? "");
  const parsed = departmentSchema.safeParse({
    name: formData.get("name"),
    name_ar: formData.get("name_ar"),
    description: formData.get("description") || undefined,
    color: formData.get("color") || undefined,
    icon: formData.get("icon") || undefined,
    manager_id: formData.get("manager_id") || undefined,
  });
  if (!id || !parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("departments")
    .update({
      name: parsed.data.name,
      name_ar: parsed.data.name_ar,
      description: parsed.data.description ?? null,
      color: parsed.data.color ?? null,
      icon: parsed.data.icon ?? null,
      manager_id: parsed.data.manager_id ?? null,
    })
    .eq("id", id);

  revalidatePath("/departments");
  redirect("/departments");
}

export async function deleteDepartment(formData: FormData) {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("departments").delete().eq("id", id);

  revalidatePath("/departments");
  redirect("/departments");
}

export async function addDepartmentMember(formData: FormData) {
  await requireRole(["super_admin"]);
  const departmentId = String(formData.get("department_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const role = formData.get("role") === "manager" ? "manager" : "member";
  if (!departmentId || !userId) return;

  const supabase = await createClient();
  await supabase
    .from("department_members")
    .upsert(
      { department_id: departmentId, user_id: userId, role },
      { onConflict: "department_id,user_id" },
    );

  revalidatePath(`/departments/${departmentId}`);
}

export async function removeDepartmentMember(formData: FormData) {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id") ?? "");
  const departmentId = String(formData.get("department_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("department_members").delete().eq("id", id);

  revalidatePath(`/departments/${departmentId}`);
}
