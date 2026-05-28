"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  arabic_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
});

export type ProfileState = { error: string | null; success: boolean };

// Updates the signed-in user's own editable profile fields. Role, employment
// type and weekly hours are managed by an administrator and are not editable
// here. RLS (profiles_update_self) restricts this to the caller's own row.
export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name") || undefined,
    arabic_name: formData.get("arabic_name") || undefined,
    phone: formData.get("phone") || undefined,
  });

  if (!parsed.success) {
    return { error: "invalid", success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized", success: false };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name ?? null,
      arabic_name: parsed.data.arabic_name ?? null,
      phone: parsed.data.phone ?? null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message, success: false };

  revalidatePath("/profile");
  return { error: null, success: true };
}
