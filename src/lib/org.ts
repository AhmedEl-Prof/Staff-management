import { createAdminClient } from "@/lib/supabase/admin";
import type { OrganizationRow } from "@/types/database";

// Active-employee ceiling per plan. Unknown plans get the trial limit, which
// fails safe (small) rather than open.
const PLAN_EMPLOYEE_LIMITS: Record<string, number> = {
  trial: 10,
  starter: 10,
  business: 30,
  enterprise: Number.POSITIVE_INFINITY,
  internal: Number.POSITIVE_INFINITY,
};

export function employeeLimitFor(plan: string): number {
  return PLAN_EMPLOYEE_LIMITS[plan] ?? PLAN_EMPLOYEE_LIMITS.trial;
}

export interface OrgAccess {
  org: OrganizationRow | null;
  /** True when the org may use the app (active + trial not expired). */
  allowed: boolean;
  reason: "suspended" | "trial_expired" | null;
  trialEndsAt: string | null;
}

// Resolves whether an organization currently has access. Trials lock softly
// after settings.trial_ends_at; suspended orgs (is_active = false) lock
// immediately. Paid/internal plans have no trial gate.
export async function getOrgAccess(orgId: string): Promise<OrgAccess> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return { org: null, allowed: false, reason: "suspended", trialEndsAt: null };

  if (!org.is_active) {
    return { org, allowed: false, reason: "suspended", trialEndsAt: null };
  }

  const settings = (org.settings ?? {}) as { trial_ends_at?: string };
  const trialEndsAt = settings.trial_ends_at ?? null;
  if (org.plan === "trial" && trialEndsAt && trialEndsAt < new Date().toISOString()) {
    return { org, allowed: false, reason: "trial_expired", trialEndsAt };
  }

  return { org, allowed: true, reason: null, trialEndsAt };
}
