"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  revokeMemberFromDrive,
  sharePendingMemberWithDrive,
} from "@/lib/drive-projects";
import { notifyUser } from "@/lib/notifications";

// Project writes rely on RLS (projects_insert/update/delete check
// manages_department, project_members_manage checks manages_project). The
// requireRole guards keep unauthorized callers out of the actions early.

const projectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  name_ar: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  client_name: z.string().trim().max(160).optional(),
  department_id: z.string().uuid(),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

function parseProject(formData: FormData) {
  return projectSchema.safeParse({
    name: formData.get("name"),
    name_ar: formData.get("name_ar") || undefined,
    description: formData.get("description") || undefined,
    client_name: formData.get("client_name") || undefined,
    department_id: formData.get("department_id"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    start_date: formData.get("start_date") || undefined,
    end_date: formData.get("end_date") || undefined,
  });
}

// Result returned to the form via useActionState. `error` is a translation key
// the form maps to a localized message; absent means success (we redirect).
export interface ProjectFormState {
  error?: "invalid" | "save_failed";
}

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const caller = await requireRole(["super_admin", "team_leader"]);
  const parsed = parseProject(formData);
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      department_id: parsed.data.department_id,
      name: parsed.data.name,
      name_ar: parsed.data.name_ar ?? null,
      description: parsed.data.description ?? null,
      client_name: parsed.data.client_name ?? null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
      created_by: caller.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createProject failed", error);
    return { error: "save_failed" };
  }

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await requireRole(["super_admin", "team_leader"]);
  const id = String(formData.get("id") ?? "");
  const parsed = parseProject(formData);
  if (!id || !parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      department_id: parsed.data.department_id,
      name: parsed.data.name,
      name_ar: parsed.data.name_ar ?? null,
      description: parsed.data.description ?? null,
      client_name: parsed.data.client_name ?? null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
    })
    .eq("id", id);

  if (error) {
    console.error("updateProject failed", error);
    return { error: "save_failed" };
  }

  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

export async function deleteProject(formData: FormData) {
  await requireRole(["super_admin", "team_leader"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("projects").delete().eq("id", id);

  revalidatePath("/projects");
  redirect("/projects");
}

export async function addProjectMember(formData: FormData) {
  const caller = await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const roleValue = String(formData.get("role") ?? "member");
  const role = ["lead", "member", "observer"].includes(roleValue)
    ? (roleValue as "lead" | "member" | "observer")
    : "member";
  if (!projectId || !userId) return;

  const supabase = await createClient();
  await supabase
    .from("project_members")
    .upsert(
      { project_id: projectId, user_id: userId, role },
      { onConflict: "project_id,user_id" },
    );

  // Best-effort share of the project's Drive folder with the new member.
  await sharePendingMemberWithDrive(projectId, userId);

  // Notify the added member (unless they added themselves somehow).
  if (userId !== caller.id) {
    const { data: project } = await supabase
      .from("projects")
      .select("name, name_ar")
      .eq("id", projectId)
      .single();
    await notifyUser({
      userId,
      type: "project_member_added",
      title: "تمت إضافتك إلى مشروع",
      message: project?.name_ar || project?.name || undefined,
      link: `/projects/${projectId}`,
    });
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectMember(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Capture the user id before deleting the row so the Drive permission
  // revocation can resolve their email.
  const { data: memberRow } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("id", id)
    .single();

  await supabase.from("project_members").delete().eq("id", id);

  if (memberRow?.user_id) {
    await revokeMemberFromDrive(projectId, memberRow.user_id);
  }

  revalidatePath(`/projects/${projectId}`);
}
