"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireUser, type SessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";
import {
  revokeMemberFromDrive,
  sharePendingMemberWithDrive,
} from "@/lib/drive-projects";
import { notifyUser } from "@/lib/notifications";

// Project writes are authorized in app code (the checks below mirror the
// projects RLS: super admin, or a manager of the relevant department) and then
// executed with the admin client. We don't rely on RLS for the write because a
// server action's Supabase client doesn't reliably carry the caller's JWT to
// PostgREST, which would make the insert run as an anonymous request.

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

// True if the caller may manage projects in the given department: super admins
// anywhere, team leaders in departments they lead.
async function managesDepartment(caller: SessionUser, departmentId: string) {
  if (caller.profile.role === "super_admin") return true;
  const managed = await getManagedDepartmentIds(caller.id);
  return managed.includes(departmentId);
}

// True if the caller may manage the given project (i.e. manages its department).
async function managesProject(caller: SessionUser, projectId: string) {
  if (caller.profile.role === "super_admin") return true;
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select("department_id")
    .eq("id", projectId)
    .single();
  if (!data) return false;
  return managesDepartment(caller, data.department_id);
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
  if (!(await managesDepartment(caller, parsed.data.department_id))) {
    return { error: "save_failed" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
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

  // Seed the project's checklist from the department's template, if any.
  const { data: template } = await admin
    .from("checklist_templates")
    .select("label, sort_order")
    .eq("department_id", parsed.data.department_id)
    .order("sort_order");
  if (template && template.length > 0) {
    await admin.from("project_checklist_items").insert(
      template.map((item) => ({
        project_id: data.id,
        label: item.label,
        sort_order: item.sort_order,
        created_by: caller.id,
      })),
    );
  }

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const caller = await requireRole(["super_admin", "team_leader"]);
  const id = String(formData.get("id") ?? "");
  const parsed = parseProject(formData);
  if (!id || !parsed.success) return { error: "invalid" };

  // Must manage both the project's current department and the target one.
  if (
    !(await managesProject(caller, id)) ||
    !(await managesDepartment(caller, parsed.data.department_id))
  ) {
    return { error: "save_failed" };
  }

  const admin = createAdminClient();
  const { error } = await admin
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
  const caller = await requireRole(["super_admin", "team_leader"]);
  const id = String(formData.get("id") ?? "");
  if (!id || !(await managesProject(caller, id))) return;

  const admin = createAdminClient();
  await admin.from("projects").delete().eq("id", id);

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
  if (!(await managesProject(caller, projectId))) return;

  const admin = createAdminClient();
  await admin
    .from("project_members")
    .upsert(
      { project_id: projectId, user_id: userId, role },
      { onConflict: "project_id,user_id" },
    );

  // Best-effort share of the project's Drive folder with the new member.
  await sharePendingMemberWithDrive(projectId, userId);

  // Notify the added member (unless they added themselves somehow).
  if (userId !== caller.id) {
    const { data: project } = await admin
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
  const caller = await requireUser();
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id || !projectId) return;
  if (!(await managesProject(caller, projectId))) return;

  const admin = createAdminClient();
  // Capture the user id before deleting the row so the Drive permission
  // revocation can resolve their email.
  const { data: memberRow } = await admin
    .from("project_members")
    .select("user_id")
    .eq("id", id)
    .single();

  await admin.from("project_members").delete().eq("id", id);

  if (memberRow?.user_id) {
    await revokeMemberFromDrive(projectId, memberRow.user_id);
  }

  revalidatePath(`/projects/${projectId}`);
}
