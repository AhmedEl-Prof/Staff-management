"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, type SessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

// Platform-level org management (plans, suspension, trial extension).
// Restricted to platform admins — the people running the SaaS itself.

const PLANS = ["trial", "starter", "business", "enterprise", "internal"] as const;

async function requirePlatformAdmin(): Promise<SessionUser | null> {
  const caller = await requireUser();
  return caller.profile.is_platform_admin ? caller : null;
}

const idSchema = z.string().uuid();

// Changes an org's plan. Moving OFF trial clears the trial deadline; moving
// (back) TO trial restarts a fresh 14-day window.
export async function setOrgPlan(formData: FormData) {
  if (!(await requirePlatformAdmin())) return;
  const orgId = idSchema.parse(formData.get("org_id"));
  const plan = z.enum(PLANS).parse(formData.get("plan"));

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return;

  const settings = { ...((org.settings ?? {}) as Record<string, Json>) };
  if (plan === "trial") {
    settings.trial_ends_at = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString();
  } else {
    delete settings.trial_ends_at;
  }

  await admin
    .from("organizations")
    .update({ plan, settings })
    .eq("id", orgId);
  revalidatePath("/platform");
}

// Extends a trial by 14 days from now (or from its current end, whichever is
// later) — the "give them more time" button.
export async function extendTrial(formData: FormData) {
  if (!(await requirePlatformAdmin())) return;
  const orgId = idSchema.parse(formData.get("org_id"));

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return;

  const settings = { ...((org.settings ?? {}) as Record<string, Json>) };
  const current =
    typeof settings.trial_ends_at === "string" ? settings.trial_ends_at : null;
  const base = current && current > new Date().toISOString()
    ? new Date(current).getTime()
    : Date.now();
  settings.trial_ends_at = new Date(
    base + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  await admin.from("organizations").update({ settings }).eq("id", orgId);
  revalidatePath("/platform");
}

// Suspends / reactivates an organization (its users hit the lock screen).
export async function toggleOrgActive(formData: FormData) {
  const caller = await requirePlatformAdmin();
  if (!caller) return;
  const orgId = idSchema.parse(formData.get("org_id"));
  // Never let the platform admin suspend their own org by accident.
  if (orgId === caller.profile.org_id) return;
  const next = formData.get("is_active") === "true";

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({ is_active: next })
    .eq("id", orgId);
  revalidatePath("/platform");
}
