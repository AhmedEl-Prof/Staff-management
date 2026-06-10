"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CVS_BUCKET = "cvs";
const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB
const CV_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Allow empty (cleared field) or a valid http(s) URL.
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .refine((v) => !v || /^https?:\/\/.+/i.test(v), { message: "url" });

const profileSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  arabic_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  website_url: optionalUrl,
});

export type ProfileState = { error: string | null; success: boolean };

// Updates the signed-in user's own editable profile fields, including an
// optional CV upload (stored in the private "cvs" bucket at <uid>/<file>).
// Role, employment type and weekly hours stay admin-managed. RLS restricts the
// row update + storage object to the caller's own id.
export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name") || undefined,
    arabic_name: formData.get("arabic_name") || undefined,
    phone: formData.get("phone") || undefined,
    whatsapp: formData.get("whatsapp") || undefined,
    website_url: formData.get("website_url") || undefined,
  });

  if (!parsed.success) {
    return { error: "invalid", success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized", success: false };

  // Optional CV upload.
  let cvPath: string | undefined;
  const cv = formData.get("cv");
  if (cv instanceof File && cv.size > 0) {
    if (cv.size > MAX_CV_BYTES) return { error: "cv_too_large", success: false };
    if (!CV_TYPES.includes(cv.type)) {
      return { error: "cv_type", success: false };
    }
    // Allowlist the stored extension so the object key can't carry an
    // unexpected suffix regardless of the uploaded filename.
    const CV_EXTS = new Set(["pdf", "doc", "docx"]);
    const rawExt = cv.name.match(/\.(\w+)$/)?.[1]?.toLowerCase() ?? "pdf";
    const ext = CV_EXTS.has(rawExt) ? rawExt : "pdf";
    const path = `${user.id}/cv-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(CVS_BUCKET)
      .upload(path, cv, { upsert: true, contentType: cv.type });
    if (upErr) return { error: "cv_upload", success: false };
    cvPath = path;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name ?? null,
      arabic_name: parsed.data.arabic_name ?? null,
      phone: parsed.data.phone ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      website_url: parsed.data.website_url || null,
      ...(cvPath ? { cv_url: cvPath } : {}),
    })
    .eq("id", user.id);

  if (error) return { error: error.message, success: false };

  revalidatePath("/profile");
  return { error: null, success: true };
}

// Returns a short-lived signed URL to download the caller's own CV.
export async function getCvDownloadUrl(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("cv_url")
    .eq("id", user.id)
    .single();
  if (!profile?.cv_url) return null;

  const { data } = await supabase.storage
    .from(CVS_BUCKET)
    .createSignedUrl(profile.cv_url, 60);
  return data?.signedUrl ?? null;
}
