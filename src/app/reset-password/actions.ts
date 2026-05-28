"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z
  .object({
    password: z.string().min(8),
    confirm: z.string().min(8),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"] });

export type ResetState = { error: string | null; success: boolean };

// Sets a new password for the user whose recovery/invite session was just
// established by /auth/callback. Requires an active session.
export async function updatePassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const parsed = schema.safeParse({ password, confirm });
  if (!parsed.success) {
    const tooShort = password.length < 8 || confirm.length < 8;
    return {
      error: tooShort ? "passwordTooShort" : "passwordsDontMatch",
      success: false,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "sessionExpired", success: false };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "sessionExpired", success: false };

  return { error: null, success: true };
}
