"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, type SessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import type { Json } from "@/types/database";

// Platform-level org management (plans, suspension, trial extension).
// Restricted to platform admins — the people running the SaaS itself.

const PLANS = ["trial", "monthly", "yearly", "internal"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const PLAN_PERIOD_DAYS: Record<string, number> = {
  trial: 14,
  monthly: 30,
  yearly: 365,
};

async function requirePlatformAdmin(): Promise<SessionUser | null> {
  const caller = await requireUser();
  return caller.profile.is_platform_admin ? caller : null;
}

const idSchema = z.string().uuid();

const createOrgSchema = z.object({
  company_name: z.string().trim().min(2).max(120),
  admin_name: z.string().trim().min(2).max(120),
  admin_email: z.string().trim().email().max(254),
  plan: z.enum(PLANS),
});

export type CreateOrgState = {
  error: string | null;
  credentials?: { email: string; password: string; orgName: string };
};

function tempPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "Or";
  for (let i = 0; i < 10; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base ? `${base}-${randomBytes(3).toString("hex")}` : `org-${randomBytes(3).toString("hex")}`;
}

// Sales-led onboarding: the platform admin creates a company + its founder
// account manually (deal closed offline). Returns the temporary credentials
// to hand over, and emails them too when Resend is configured.
export async function createOrganization(
  _prev: CreateOrgState,
  formData: FormData,
): Promise<CreateOrgState> {
  if (!(await requirePlatformAdmin())) return { error: "forbidden" };

  const parsed = createOrgSchema.safeParse({
    company_name: formData.get("company_name"),
    admin_name: formData.get("admin_name"),
    admin_email: formData.get("admin_email"),
    plan: formData.get("plan"),
  });
  if (!parsed.success) return { error: "invalid" };
  const data = parsed.data;

  const admin = createAdminClient();

  const settings: Record<string, Json> = {};
  if (data.plan === "trial") {
    settings.trial_ends_at = new Date(
      Date.now() + PLAN_PERIOD_DAYS.trial * DAY_MS,
    ).toISOString();
  } else if (data.plan === "monthly" || data.plan === "yearly") {
    settings.subscription_ends_at = new Date(
      Date.now() + PLAN_PERIOD_DAYS[data.plan] * DAY_MS,
    ).toISOString();
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name: data.company_name,
      slug: makeSlug(data.company_name),
      plan: data.plan,
      settings,
    })
    .select("id, name")
    .single();
  if (orgErr || !org) return { error: "failed" };

  const password = tempPassword();
  const { error: userErr } = await admin.auth.admin.createUser({
    email: data.admin_email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: data.admin_name,
      role: "super_admin",
      org_id: org.id,
    },
  });
  if (userErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    return {
      error: userErr.message.toLowerCase().includes("already")
        ? "emailTaken"
        : "failed",
    };
  }

  // Best-effort welcome email with the credentials.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await sendEmail({
    to: data.admin_email,
    subject: `حساب شركتك جاهز — ${org.name}`,
    bodyHtml: `
      <p style="margin:0 0 8px 0">أهلاً ${escapeHtml(data.admin_name)} 👋</p>
      <p style="margin:0 0 8px 0">تم إنشاء حساب شركة <b>${escapeHtml(org.name)}</b> على نظام إدارة الموظفين.</p>
      <p style="margin:0">البريد: <b dir="ltr">${escapeHtml(data.admin_email)}</b><br/>كلمة السر المؤقتة: <b dir="ltr">${password}</b></p>
      <p style="margin:8px 0 0 0">ننصح بتغيير كلمة السر بعد أول دخول.</p>
    `,
    link: `${appUrl}/login`,
    linkLabel: "تسجيل الدخول",
  });

  revalidatePath("/platform");
  return {
    error: null,
    credentials: { email: data.admin_email, password, orgName: org.name },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Changes an org's plan and starts a fresh period for it: trial = 14 days,
// monthly = 30 days, yearly = 365 days, internal = no expiry.
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
  delete settings.trial_ends_at;
  delete settings.subscription_ends_at;
  if (plan === "trial") {
    settings.trial_ends_at = new Date(
      Date.now() + PLAN_PERIOD_DAYS.trial * DAY_MS,
    ).toISOString();
  } else if (plan === "monthly" || plan === "yearly") {
    settings.subscription_ends_at = new Date(
      Date.now() + PLAN_PERIOD_DAYS[plan] * DAY_MS,
    ).toISOString();
  }

  await admin
    .from("organizations")
    .update({ plan, settings })
    .eq("id", orgId);
  revalidatePath("/platform");
}

// Extends the org's current period by one unit of its plan (trial +14 days,
// monthly +30, yearly +365), counted from its current end when still in the
// future (so renewing early never loses days) or from now when already past.
// This is the manual-billing "تجديد" button.
export async function extendPlanPeriod(formData: FormData) {
  if (!(await requirePlatformAdmin())) return;
  const orgId = idSchema.parse(formData.get("org_id"));

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("plan, settings")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return;
  const days = PLAN_PERIOD_DAYS[org.plan];
  if (!days) return; // internal / unknown plans have no period

  const key = org.plan === "trial" ? "trial_ends_at" : "subscription_ends_at";
  const settings = { ...((org.settings ?? {}) as Record<string, Json>) };
  const current = typeof settings[key] === "string" ? (settings[key] as string) : null;
  const base =
    current && current > new Date().toISOString()
      ? new Date(current).getTime()
      : Date.now();
  settings[key] = new Date(base + days * DAY_MS).toISOString();

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

// Permanently deletes an organization and everything it owns. Guard rails:
// platform admins only, never one's own org, and the org must already be
// SUSPENDED (a deliberate two-step: suspend first, then delete).
//
// Deletion order respects the FK rules:
//   departments  -> cascades projects -> tasks/comments/attachments/portal
//                   links, bonus, checklists, dept tools, dept KPI defs
//   org KPI defs + audit trail (NO ACTION on org_id, removed explicitly)
//   profiles     -> cascades all user-scoped rows (notifications, points,
//                   leave, attendance, standups, timers, …)
//   auth users   -> the accounts themselves
//   organization -> org_integrations cascades with it
// Storage objects under deleted project ids become unreachable orphans
// (bucket-level cleanup can be done from the Supabase dashboard if needed).
export async function deleteOrganization(formData: FormData) {
  const caller = await requirePlatformAdmin();
  if (!caller) return;
  const orgId = idSchema.parse(formData.get("org_id"));
  if (orgId === caller.profile.org_id) return;

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, is_active")
    .eq("id", orgId)
    .maybeSingle();
  if (!org || org.is_active) return;

  const { data: members } = await admin
    .from("profiles")
    .select("id")
    .eq("org_id", orgId);
  const memberIds = (members ?? []).map((m) => m.id);

  await admin.from("departments").delete().eq("org_id", orgId);
  await admin.from("kpi_definitions").delete().eq("org_id", orgId);
  await admin.from("audit_logs").delete().eq("org_id", orgId);
  if (memberIds.length) {
    await admin.from("profiles").delete().in("id", memberIds);
    for (const id of memberIds) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) console.error("[platform] auth user delete failed", id, error);
    }
  }
  await admin.from("organizations").delete().eq("id", orgId);

  revalidatePath("/platform");
}
