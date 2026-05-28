import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDriveClientForUser,
  revokeFolderShare,
  shareFolderWithUser,
} from "@/lib/google-drive";

// Resolves the Drive owner for a project (currently: its creator). Falls back
// to null if no folder is registered for the project.
async function resolveProjectDrive(projectId: string) {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, drive_folder_id, created_by")
    .eq("id", projectId)
    .single();
  if (!project?.drive_folder_id || !project.created_by) return null;
  return {
    folderId: project.drive_folder_id,
    ownerId: project.created_by,
  };
}

async function resolveUserEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

// Best-effort: shares the project's Drive folder with a single member. Silent
// no-op when Drive isn't set up or the owner has no Drive connection.
export async function sharePendingMemberWithDrive(
  projectId: string,
  userId: string,
): Promise<void> {
  try {
    const ctx = await resolveProjectDrive(projectId);
    if (!ctx) return;
    const drive = await getDriveClientForUser(ctx.ownerId);
    if (!drive) return;
    const email = await resolveUserEmail(userId);
    if (!email) return;
    await shareFolderWithUser(drive, ctx.folderId, email);
  } catch {
    // Swallow — sync is non-fatal.
  }
}

// Best-effort: revokes a member's access to the project's Drive folder. Used
// when a member is removed from a project.
export async function revokeMemberFromDrive(
  projectId: string,
  userId: string,
): Promise<void> {
  try {
    const ctx = await resolveProjectDrive(projectId);
    if (!ctx) return;
    const drive = await getDriveClientForUser(ctx.ownerId);
    if (!drive) return;
    const email = await resolveUserEmail(userId);
    if (!email) return;
    await revokeFolderShare(drive, ctx.folderId, email);
  } catch {
    // Swallow — sync is non-fatal.
  }
}
