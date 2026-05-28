"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TASK_ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
  buildAttachmentPath,
} from "@/lib/storage";

const uploadSchema = z.object({
  project_id: z.string().uuid(),
  task_id: z.string().uuid(),
});

export type UploadState = { error: string | null };

// Uploads a file to the task-attachments bucket and records it in
// task_attachments. Storage and table writes are both governed by RLS, so the
// path encodes the task id (see migration 0010).
export async function uploadAttachment(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const caller = await requireUser();
  const parsed = uploadSchema.safeParse({
    project_id: formData.get("project_id"),
    task_id: formData.get("task_id"),
  });
  if (!parsed.success) return { error: "invalid" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "invalid" };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { error: "tooLarge" };
  }

  const supabase = await createClient();
  const path = buildAttachmentPath(parsed.data.task_id, file.name);

  const { error: storageError } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (storageError) return { error: "uploadFailed" };

  const { error: insertError } = await supabase.from("task_attachments").insert({
    task_id: parsed.data.task_id,
    file_name: file.name,
    file_url: path,
    file_size: file.size,
    uploaded_by: caller.id,
  });

  if (insertError) {
    // Roll back the storage upload so we don't leave an orphan object.
    await supabase.storage.from(TASK_ATTACHMENTS_BUCKET).remove([path]);
    return { error: "uploadFailed" };
  }

  revalidatePath(`/projects/${parsed.data.project_id}/tasks/${parsed.data.task_id}`);
  return { error: null };
}

export async function deleteAttachment(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Look up the storage path so we can remove the underlying object too.
  const { data: row } = await supabase
    .from("task_attachments")
    .select("file_url")
    .eq("id", id)
    .single();

  await supabase.from("task_attachments").delete().eq("id", id);
  if (row?.file_url) {
    await supabase.storage.from(TASK_ATTACHMENTS_BUCKET).remove([row.file_url]);
  }

  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

// Returns a short-lived signed URL for an attachment so the client can
// download it without exposing the bucket publicly.
export async function getAttachmentDownloadUrl(
  attachmentId: string,
): Promise<string | null> {
  await requireUser();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("task_attachments")
    .select("file_url")
    .eq("id", attachmentId)
    .single();
  if (!row?.file_url) return null;

  const { data } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .createSignedUrl(row.file_url, 60);
  return data?.signedUrl ?? null;
}
