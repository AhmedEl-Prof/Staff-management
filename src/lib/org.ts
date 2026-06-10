import { createAdminClient } from "@/lib/supabase/admin";
import type { OrganizationRow } from "@/types/database";

// Plans: a 14-day trial, then time-based paid plans (monthly / yearly) with a
// subscription end date; "internal" is the platform owner's own org.
export const PLANS = ["trial", "monthly", "yearly", "internal"] as const;
export type Plan = (typeof PLANS)[number];

// Active-employee ceiling per plan. Unknown plans get the trial limit, which
// fails safe (small) rather than open.
const PLAN_EMPLOYEE_LIMITS: Record<string, number> = {
  trial: 10,
  monthly: Number.POSITIVE_INFINITY,
  yearly: Number.POSITIVE_INFINITY,
  internal: Number.POSITIVE_INFINITY,
};

export function employeeLimitFor(plan: string): number {
  return PLAN_EMPLOYEE_LIMITS[plan] ?? PLAN_EMPLOYEE_LIMITS.trial;
}

export type LockReason = "suspended" | "trial_expired" | "subscription_expired";

export interface OrgAccess {
  org: OrganizationRow | null;
  /** True when the org may use the app (active + plan not expired). */
  allowed: boolean;
  reason: LockReason | null;
  /** When the current plan period ends (trial or paid), if any. */
  endsAt: string | null;
}

// Resolves whether an organization currently has access. Trials lock softly
// after settings.trial_ends_at, paid plans after settings.subscription_ends_at;
// suspended orgs (is_active = false) lock immediately. "internal" never locks.
export async function getOrgAccess(orgId: string): Promise<OrgAccess> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return { org: null, allowed: false, reason: "suspended", endsAt: null };

  if (!org.is_active) {
    return { org, allowed: false, reason: "suspended", endsAt: null };
  }

  const settings = (org.settings ?? {}) as {
    trial_ends_at?: string;
    subscription_ends_at?: string;
  };
  const now = new Date().toISOString();

  if (org.plan === "trial") {
    const endsAt = settings.trial_ends_at ?? null;
    if (endsAt && endsAt < now) {
      return { org, allowed: false, reason: "trial_expired", endsAt };
    }
    return { org, allowed: true, reason: null, endsAt };
  }

  if (org.plan === "monthly" || org.plan === "yearly") {
    const endsAt = settings.subscription_ends_at ?? null;
    if (endsAt && endsAt < now) {
      return { org, allowed: false, reason: "subscription_expired", endsAt };
    }
    return { org, allowed: true, reason: null, endsAt };
  }

  return { org, allowed: true, reason: null, endsAt: null };
}
