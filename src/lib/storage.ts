// Storage helpers for task attachments.

export const TASK_ATTACHMENTS_BUCKET = "task-attachments";

// Maximum upload size: 10 MB. Keep in sync with any Supabase project-level
// limit set in the dashboard.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// Builds the storage object path for a task attachment. The first segment is
// the task id so storage RLS can authorize via can_access_task() (see 0010).
export function buildAttachmentPath(taskId: string, fileName: string): string {
  const safe = fileName.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 200);
  return `${taskId}/${crypto.randomUUID()}-${safe}`;
}
