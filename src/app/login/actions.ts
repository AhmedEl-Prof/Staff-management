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
    // Temporary: surface the raw Supabase error so we can debug login issues
    // in production. Revert to the generic "invalidCredentials" once login is
    // confirmed working.
    const message =
      `[${error.code ?? "no-code"}] ${error.message}` || "invalidCredentials";
    console.error("[login] auth error:", error);
    return { error: message };
  }

  revalidatePath("/", "layout");
  const target = parsed.data.redirectTo?.startsWith("/")
    ? parsed.data.redirectTo
    : "/";
  redirect(target);
}
