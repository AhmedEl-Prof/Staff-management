"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  redirectTo: z.string().optional(),
});

export type LoginState = { error: string | null };

// Authenticates a user with email + password via Supabase Auth. There is no
// public signup in this system — accounts are provisioned by an administrator.
export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "invalidCredentials" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "invalidCredentials" };
  }

  revalidatePath("/", "layout");
  const target = parsed.data.redirectTo?.startsWith("/")
    ? parsed.data.redirectTo
    : "/";

  // 2FA: a user with a verified TOTP factor signs in at aal1 and must present
  // a code to reach aal2 before touching the app.
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
    redirect(`/login/mfa?redirectTo=${encodeURIComponent(target)}`);
  }

  redirect(target);
}
