"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Self-serve organization signup (SaaS): creates the organization, its first
// super_admin account (joined via the org_id metadata that handle_new_user
// reads), signs the founder in, and lands them on the dashboard with a
// 14-day trial.

const TRIAL_DAYS = 14;

const signupSchema = z.object({
  company_name: z.string().trim().min(2).max(120),
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
});

export type SignupState = { error: string | null };

// URL-safe slug from the company name; a random suffix guarantees uniqueness
// without a lookup race (Arabic names often produce an empty latin base).
function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = randomBytes(3).toString("hex");
  return base ? `${base}-${suffix}` : `org-${suffix}`;
}

export async function signupOrganization(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    company_name: formData.get("company_name"),
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid" };
  const data = parsed.data;

  const admin = createAdminClient();

  const trialEndsAt = new Date(
    Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name: data.company_name,
      slug: makeSlug(data.company_name),
      plan: "trial",
      settings: { trial_ends_at: trialEndsAt },
    })
    .select("id")
    .single();
  if (orgErr || !org) return { error: "failed" };

  // Founder account: pre-confirmed so they land in the product immediately.
  const { error: userErr } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: data.full_name,
      role: "super_admin",
      org_id: org.id,
    },
  });
  if (userErr) {
    // Roll back the empty org so a retried email doesn't leave orphans.
    await admin.from("organizations").delete().eq("id", org.id);
    return {
      error: userErr.message.toLowerCase().includes("already")
        ? "emailTaken"
        : "failed",
    };
  }

  // Sign the founder in (sets the session cookies via the SSR client).
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  if (signInErr) redirect("/login");

  redirect("/");
}
