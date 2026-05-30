"use server";

import { revalidatePath } from "next/cache";
import { requireUser, type SessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";

// Manager of the project's department (or super admin) — may add/edit/remove
// checklist items. Mirrors manages_project in the RLS.
async function managesProject(caller: SessionUser, projectId: string) {
  if (caller.profile.role === "super_admin") return true;
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select("department_id")
    .eq("id", projectId)
    .single();
  if (!data) return false;
  const managed = await getManagedDepartmentIds(caller.id);
  return managed.includes(data.department_id);
}

// Any member of the project may view + tick items done.
async function canAccessProject(caller: SessionUser, projectId: string) {
  if (await managesProject(caller, projectId)) return true;
  const admin = createAdminClient();
  const { data } = await admin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", caller.id)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function addChecklistItem(formData: FormData) {
  const caller = await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!projectId || !label) return;
  if (!(await managesProject(caller, projectId))) return;

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("project_checklist_items")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (last?.sort_order ?? -1) + 1;

  await admin.from("project_checklist_items").insert({
    project_id: projectId,
    label,
    assigned_to: String(formData.get("assigned_to") ?? "") || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    sort_order: nextSort,
    created_by: caller.id,
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function updateChecklistItem(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!id || !projectId || !label) return;
  if (!(await managesProject(caller, projectId))) return;

  const admin = createAdminClient();
  await admin
    .from("project_checklist_items")
    .update({
      label,
      assigned_to: String(formData.get("assigned_to") ?? "") || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);

  revalidatePath(`/projects/${projectId}`);
}

// Toggling "done" is open to any project member, not just managers.
export async function toggleChecklistItem(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const done = String(formData.get("done") ?? "") === "true";
  if (!id || !projectId) return;
  if (!(await canAccessProject(caller, projectId))) return;

  const admin = createAdminClient();
  await admin
    .from("project_checklist_items")
    .update({ done })
    .eq("id", id);

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteChecklistItem(formData: FormData) {
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id || !projectId) return;
  if (!(await managesProject(caller, projectId))) return;

  const admin = createAdminClient();
  await admin.from("project_checklist_items").delete().eq("id", id);

  revalidatePath(`/projects/${projectId}`);
}

// Appends the department template's items to this project's checklist (manager
// only). Skips labels already present so re-applying doesn't duplicate.
export async function applyTemplate(formData: FormData) {
  const caller = await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId || !(await managesProject(caller, projectId))) return;

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("department_id")
    .eq("id", projectId)
    .single();
  if (!project) return;

  const [{ data: template }, { data: existing }, { data: last }] =
    await Promise.all([
      admin
        .from("checklist_templates")
        .select("label, sort_order")
        .eq("department_id", project.department_id)
        .order("sort_order"),
      admin
        .from("project_checklist_items")
        .select("label")
        .eq("project_id", projectId),
      admin
        .from("project_checklist_items")
        .select("sort_order")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!template || template.length === 0) return;
  const have = new Set((existing ?? []).map((i) => i.label));
  let sort = (last?.sort_order ?? -1) + 1;
  const rows = template
    .filter((item) => !have.has(item.label))
    .map((item) => ({
      project_id: projectId,
      label: item.label,
      sort_order: sort++,
      created_by: caller.id,
    }));
  if (rows.length > 0) {
    await admin.from("project_checklist_items").insert(rows);
  }

  revalidatePath(`/projects/${projectId}`);
}
