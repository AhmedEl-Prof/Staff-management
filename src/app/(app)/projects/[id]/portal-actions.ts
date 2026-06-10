"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, type SessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";

// Client-portal link management. Authorized in app code (mirrors the projects
// RLS: super admin, or a leader of the project's department) and executed with
// the admin client, consistent with the other project write actions.

async function managesProject(caller: SessionUser, projectId: string) {
  if (caller.profile.role === "super_admin") return true;
  if (caller.profile.role !== "team_leader") return false;
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

const idSchema = z.string().uuid();

// Creates (or replaces) the active portal link for a project. Any previously
// active link is revoked first so exactly one link works at a time — that
// makes "regenerate" double as "kick out whoever had the old link".
export async function createPortalLink(formData: FormData) {
  const caller = await requireUser();
  const projectId = idSchema.parse(formData.get("project_id"));
  if (!(await managesProject(caller, projectId))) return;

  const admin = createAdminClient();
  await admin
    .from("project_portal_links")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("is_active", true);

  // 24 random bytes -> 32 url-safe chars; the token IS the credential.
  const token = randomBytes(24).toString("base64url");
  await admin.from("project_portal_links").insert({
    project_id: projectId,
    token,
    created_by: caller.id,
  });

  revalidatePath(`/projects/${projectId}`);
}

// Revokes the project's active portal link (the public page stops resolving).
export async function revokePortalLink(formData: FormData) {
  const caller = await requireUser();
  const projectId = idSchema.parse(formData.get("project_id"));
  if (!(await managesProject(caller, projectId))) return;

  const admin = createAdminClient();
  await admin
    .from("project_portal_links")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("is_active", true);

  revalidatePath(`/projects/${projectId}`);
}
