"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentIds } from "@/lib/permissions";
import {
  createProjectFolder,
  getDriveClientForUser,
  shareFolderWithUser,
} from "@/lib/google-drive";

// Result of a Drive action surfaced to the UI.
export type DriveActionResult = {
  ok: boolean;
  error?: "notConnected" | "notAllowed" | "alreadyExists" | "driveFailed";
};

// Verifies the caller manages the project, returning the project row or null.
async function loadManagedProject(projectId: string) {
  const caller = await requireRole(["super_admin", "team_leader"]);
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (!project) return null;

  if (caller.profile.role !== "super_admin") {
    const managed = await getManagedDepartmentIds(caller.id);
    if (!managed.includes(project.department_id)) return null;
  }

  return { caller, project };
}

// Creates a Drive folder for the project using the caller's Drive connection,
// then records it in drive_folders + projects.drive_folder_id. Idempotent: if
// the project already has a folder, surfaces alreadyExists.
export async function createDriveFolderForProject(
  formData: FormData,
): Promise<DriveActionResult> {
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { ok: false, error: "notAllowed" };

  const ctx = await loadManagedProject(projectId);
  if (!ctx) return { ok: false, error: "notAllowed" };

  if (ctx.project.drive_folder_id) {
    return { ok: false, error: "alreadyExists" };
  }

  const drive = await getDriveClientForUser(ctx.caller.id);
  if (!drive) return { ok: false, error: "notConnected" };

  let folder;
  try {
    const folderName = ctx.project.name_ar || ctx.project.name;
    folder = await createProjectFolder(drive, folderName);
  } catch {
    return { ok: false, error: "driveFailed" };
  }

  const admin = createAdminClient();
  await admin
    .from("projects")
    .update({ drive_folder_id: folder.id })
    .eq("id", projectId);

  await admin.from("drive_folders").upsert(
    {
      project_id: projectId,
      folder_id: folder.id,
      folder_url: folder.url,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// Shares the project's Drive folder with every current project member, using
// the caller's Drive connection. Existing shares are skipped silently by
// Google's permissions API.
export async function syncDriveFolderMembers(
  formData: FormData,
): Promise<DriveActionResult> {
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { ok: false, error: "notAllowed" };

  const ctx = await loadManagedProject(projectId);
  if (!ctx) return { ok: false, error: "notAllowed" };
  if (!ctx.project.drive_folder_id) return { ok: false, error: "notConnected" };

  const drive = await getDriveClientForUser(ctx.caller.id);
  if (!drive) return { ok: false, error: "notConnected" };

  const admin = createAdminClient();
  const { data: memberRows } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  const memberIds = (memberRows ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) {
    return { ok: true };
  }

  // The auth.users table holds the canonical email; profiles does not.
  const emails: string[] = [];
  for (const userId of memberIds) {
    const { data } = await admin.auth.admin.getUserById(userId);
    if (data.user?.email) emails.push(data.user.email);
  }

  try {
    for (const email of emails) {
      await shareFolderWithUser(drive, ctx.project.drive_folder_id, email);
    }
  } catch {
    return { ok: false, error: "driveFailed" };
  }

  await admin
    .from("drive_folders")
    .update({ synced_at: new Date().toISOString() })
    .eq("project_id", projectId);

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

