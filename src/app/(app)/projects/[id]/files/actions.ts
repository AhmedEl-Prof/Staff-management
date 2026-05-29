"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getProjectContext } from "@/lib/project-context";
import {
  uploadProjectFile,
  createProjectFolder,
  deleteProjectFile,
  deleteProjectFolder,
  getProjectFileUrl,
  MAX_PROJECT_FILE_BYTES,
} from "@/lib/project-files";

export type FilesState = { error: string | null; ok: boolean };

// All actions verify the caller can access the project (RLS also enforces this
// at the storage layer); the path is sanitized inside the project-files lib.

export async function uploadFile(
  _prev: FilesState,
  formData: FormData,
): Promise<FilesState> {
  const { profile } = await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  const path = String(formData.get("path") ?? "");
  const file = formData.get("file");

  const ctx = await getProjectContext(projectId, profile);
  if (!ctx) return { error: "notAllowed", ok: false };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "invalid", ok: false };
  }
  if (file.size > MAX_PROJECT_FILE_BYTES) {
    return { error: "tooLarge", ok: false };
  }

  const ok = await uploadProjectFile(projectId, path, file.name, file);
  if (!ok) return { error: "uploadFailed", ok: false };

  revalidatePath(`/projects/${projectId}/files`);
  return { error: null, ok: true };
}

export async function newFolder(formData: FormData) {
  const { profile } = await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  const path = String(formData.get("path") ?? "");
  const name = String(formData.get("folder_name") ?? "");
  if (!name.trim()) return;

  const ctx = await getProjectContext(projectId, profile);
  if (!ctx) return;

  await createProjectFolder(projectId, path, name);
  revalidatePath(`/projects/${projectId}/files`);
}

export async function deleteEntry(formData: FormData) {
  const { profile } = await requireUser();
  const projectId = String(formData.get("project_id") ?? "");
  const path = String(formData.get("path") ?? "");
  const name = String(formData.get("name") ?? "");
  const kind = String(formData.get("kind") ?? "file");
  if (!name) return;

  const ctx = await getProjectContext(projectId, profile);
  if (!ctx) return;

  if (kind === "folder") {
    await deleteProjectFolder(projectId, path, name);
  } else {
    await deleteProjectFile(projectId, path, name);
  }
  revalidatePath(`/projects/${projectId}/files`);
}

// Returns a signed download URL for a file (used by the download button).
export async function getDownloadUrl(
  projectId: string,
  path: string,
  name: string,
): Promise<string | null> {
  const { profile } = await requireUser();
  const ctx = await getProjectContext(projectId, profile);
  if (!ctx) return null;
  return getProjectFileUrl(projectId, path, name);
}
