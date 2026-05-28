"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().email() });

export type ForgotState = { sent: boolean };

// Sends a password-reset email. Always reports success regardless of whether
// the address exists, to avoid leaking which emails are registered.
export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { sent: true };

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  });

  return { sent: true };
}
