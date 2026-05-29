import { createClient } from "@/lib/supabase/server";

export const PROJECT_FILES_BUCKET = "project-files";
export const MAX_PROJECT_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

// Placeholder object that keeps an otherwise-empty folder visible (Supabase
// Storage has no real empty folders).
export const FOLDER_KEEP = ".keep";

export interface ProjectFileEntry {
  name: string;
  size: number;
  updatedAt: string | null;
}

export interface ProjectFolderListing {
  folders: string[];
  files: ProjectFileEntry[];
}

// Sanitizes a single path segment: no slashes, no "..", trimmed. Returns null
// if the result is empty/invalid.
export function sanitizeSegment(seg: string): string | null {
  const clean = seg.replace(/[/\\]/g, "").replace(/\.\.+/g, "").trim();
  return clean.length ? clean.slice(0, 120) : null;
}

// Normalizes a relative folder path (e.g. "designs/logos") into safe segments.
export function sanitizePath(path: string): string {
  return path
    .split("/")
    .map((s) => sanitizeSegment(s))
    .filter((s): s is string => s !== null)
    .join("/");
}

// Builds the full storage prefix for a project + relative folder path.
function prefixFor(projectId: string, relPath: string): string {
  const rel = sanitizePath(relPath);
  return rel ? `${projectId}/${rel}` : projectId;
}

// Lists folders + files at the given relative path inside a project. RLS limits
// this to project members.
export async function listProjectFiles(
  projectId: string,
  relPath: string,
): Promise<ProjectFolderListing> {
  const supabase = await createClient();
  const prefix = prefixFor(projectId, relPath);

  const { data, error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });

  if (error || !data) return { folders: [], files: [] };

  const folders: string[] = [];
  const files: ProjectFileEntry[] = [];
  for (const item of data) {
    // Supabase marks folders with a null id (they're virtual prefixes).
    if (item.id === null) {
      folders.push(item.name);
      continue;
    }
    if (item.name === FOLDER_KEEP) continue; // hide the keep placeholder
    files.push({
      name: item.name,
      size: (item.metadata?.size as number) ?? 0,
      updatedAt: item.updated_at ?? null,
    });
  }
  return { folders, files };
}

// Uploads a file into a project folder. Returns true on success.
export async function uploadProjectFile(
  projectId: string,
  relPath: string,
  fileName: string,
  file: File,
): Promise<boolean> {
  const safeName = sanitizeSegment(fileName) ?? `file-${Date.now()}`;
  const prefix = prefixFor(projectId, relPath);
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .upload(`${prefix}/${safeName}`, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
  return !error;
}

// Creates a folder by writing a hidden .keep placeholder inside it.
export async function createProjectFolder(
  projectId: string,
  relPath: string,
  folderName: string,
): Promise<boolean> {
  const safe = sanitizeSegment(folderName);
  if (!safe) return false;
  const prefix = prefixFor(projectId, relPath ? `${relPath}/${safe}` : safe);
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .upload(`${prefix}/${FOLDER_KEEP}`, new Blob([""]), { upsert: true });
  return !error;
}

// Deletes a single file at the given relative path.
export async function deleteProjectFile(
  projectId: string,
  relPath: string,
  fileName: string,
): Promise<void> {
  const safeName = sanitizeSegment(fileName);
  if (!safeName) return;
  const prefix = prefixFor(projectId, relPath);
  const supabase = await createClient();
  await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .remove([`${prefix}/${safeName}`]);
}

// Recursively deletes a folder and everything inside it.
export async function deleteProjectFolder(
  projectId: string,
  relPath: string,
  folderName: string,
): Promise<void> {
  const safe = sanitizeSegment(folderName);
  if (!safe) return;
  const supabase = await createClient();
  const base = relPath ? `${relPath}/${safe}` : safe;

  // Collect all object paths under the folder (one level of recursion via a
  // queue — covers nested folders).
  const toVisit: string[] = [base];
  const toRemove: string[] = [];
  while (toVisit.length) {
    const current = toVisit.pop()!;
    const prefix = prefixFor(projectId, current);
    const { data } = await supabase.storage
      .from(PROJECT_FILES_BUCKET)
      .list(prefix, { limit: 1000 });
    for (const item of data ?? []) {
      if (item.id === null) {
        toVisit.push(`${current}/${item.name}`);
      } else {
        toRemove.push(`${prefix}/${item.name}`);
      }
    }
  }
  if (toRemove.length) {
    await supabase.storage.from(PROJECT_FILES_BUCKET).remove(toRemove);
  }
}

// Mints a short-lived signed URL to download a file.
export async function getProjectFileUrl(
  projectId: string,
  relPath: string,
  fileName: string,
): Promise<string | null> {
  const safeName = sanitizeSegment(fileName);
  if (!safeName) return null;
  const prefix = prefixFor(projectId, relPath);
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .createSignedUrl(`${prefix}/${safeName}`, 60);
  return data?.signedUrl ?? null;
}
