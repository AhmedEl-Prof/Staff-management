"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageUser, getManagedDepartmentIds } from "@/lib/permissions";
import { employeeLimitFor } from "@/lib/org";
import { sendEmail } from "@/lib/email";

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().trim().max(120).optional(),
  arabic_name: z.string().trim().max(120).optional(),
  role: z.enum(["super_admin", "team_leader", "team_member", "hr"]),
  employment_type: z.enum(["full_time", "part_time", "freelance"]),
  seniority: z.enum(["senior", "junior", "trainee"]).optional(),
  weekly_hours: z.coerce.number().int().min(0).max(168).default(40),
  department_id: z.string().uuid().optional(),
  hire_date: z.string().optional(),
});

// Credentials surfaced to the admin after creating the account, so they can be
// shared even when email delivery isn't configured.
export interface CreatedCredentials {
  email: string;
  password: string;
  loginUrl: string;
  emailed: boolean;
}

export type InviteState = {
  error: string | null;
  success: boolean;
  credentials?: CreatedCredentials;
};

// Generates a readable but unguessable temporary password (e.g. "Ev7k2m9q4x").
// Starts with "Ev" so it's clearly a system-issued password.
function generateTempPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous chars
  const bytes = randomBytes(10);
  let out = "Ev";
  for (let i = 0; i < 10; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// Creates a new employee account directly with a temporary password (the
// account is pre-confirmed, so they can sign in immediately). Returns the
// credentials to the caller AND emails them when Resend is configured.
//
// Super admins may create any role in any department; team leaders may only
// create team members in departments they manage.
export async function inviteEmployee(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const caller = await requireRole(["super_admin", "team_leader", "hr"]);

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name") || undefined,
    arabic_name: formData.get("arabic_name") || undefined,
    role: formData.get("role"),
    employment_type: formData.get("employment_type"),
    seniority: formData.get("seniority") || undefined,
    weekly_hours: formData.get("weekly_hours") ?? 40,
    department_id: formData.get("department_id") || undefined,
    hire_date: formData.get("hire_date") || undefined,
  });

  if (!parsed.success) {
    return { error: "invalid", success: false };
  }

  const data = parsed.data;

  // Team leaders are constrained: only team_member role, only into a
  // department they manage.
  if (caller.profile.role === "team_leader") {
    if (data.role !== "team_member") {
      return { error: "notAllowed", success: false };
    }
    const managed = await getManagedDepartmentIds(caller.id);
    if (!data.department_id || !managed.includes(data.department_id)) {
      return { error: "notAllowed", success: false };
    }
  }

  // HR may create employees company-wide, but not another super admin.
  if (caller.profile.role === "hr" && data.role === "super_admin") {
    return { error: "notAllowed", success: false };
  }

  const admin = createAdminClient();

  // Plan ceiling: active employees per organization.
  const [{ data: orgRow }, { count: activeCount }] = await Promise.all([
    admin
      .from("organizations")
      .select("plan")
      .eq("id", caller.profile.org_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", caller.profile.org_id)
      .eq("is_active", true),
  ]);
  if ((activeCount ?? 0) >= employeeLimitFor(orgRow?.plan ?? "trial")) {
    return { error: "limitReached", success: false };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const password = generateTempPassword();

  // Create the user pre-confirmed with the temporary password.
  const { data: created, error } = await admin.auth.admin.createUser({
    email: data.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: data.full_name,
      arabic_name: data.arabic_name,
      role: data.role,
      employment_type: data.employment_type,
      // New employees always join the inviter's organization.
      org_id: caller.profile.org_id,
    },
  });

  if (error || !created?.user) {
    const alreadyExists =
      error?.message?.toLowerCase().includes("already") ||
      error?.message?.toLowerCase().includes("registered");
    return { error: alreadyExists ? "emailExists" : "invalid", success: false };
  }

  const userId = created.user.id;

  // The handle_new_user trigger created the profile from metadata; fill the
  // remaining fields here.
  await admin
    .from("profiles")
    .update({
      weekly_hours: data.weekly_hours,
      hire_date: data.hire_date ?? null,
      seniority: data.seniority ?? null,
    })
    .eq("id", userId);

  if (data.department_id) {
    await admin.from("department_members").insert({
      department_id: data.department_id,
      user_id: userId,
      role: "member",
    });
  }

  // Email the credentials (best-effort — only sends if Resend is configured).
  const loginUrl = `${appUrl}/login`;
  const displayName = data.arabic_name || data.full_name || data.email;
  const emailed = await sendEmail({
    to: data.email,
    subject: "تم إنشاء حسابك — Everest Ads",
    bodyHtml: `
      <p style="margin:0 0 12px 0">أهلاً ${escapeHtml(displayName)} 👋</p>
      <p style="margin:0 0 12px 0">تم إنشاء حسابك في نظام إدارة موظفين Everest Ads. دي بيانات دخولك:</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#777">البريد الإلكتروني</td>
            <td style="padding:4px 0"><b dir="ltr">${escapeHtml(data.email)}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#777">كلمة السر المؤقتة</td>
            <td style="padding:4px 0"><b dir="ltr">${escapeHtml(password)}</b></td></tr>
      </table>
      <p style="margin:12px 0 0 0;font-size:13px;color:#777">يُفضّل تغيير كلمة السر بعد أول دخول من خلال "نسيت كلمة السر؟".</p>
    `,
    link: loginUrl,
    linkLabel: "تسجيل الدخول",
  });

  revalidatePath("/employees");
  return {
    error: null,
    success: true,
    credentials: { email: data.email, password, loginUrl, emailed },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Activates or deactivates an employee account. Authorized for super admins
// (anyone) and team leaders (members of departments they manage).
export async function setEmployeeActive(formData: FormData) {
  const caller = await requireRole(["super_admin", "team_leader", "hr"]);
  const userId = String(formData.get("user_id") ?? "");
  const isActive = String(formData.get("is_active")) === "true";

  if (!userId) return;
  if (!(await canManageUser(caller.profile, userId))) return;

  const admin = createAdminClient();
  await admin.from("profiles").update({ is_active: isActive }).eq("id", userId);

  revalidatePath("/employees");
}

// Sets an employee's seniority (senior / junior / trainee, or unset). Same
// authorization as the activate toggle.
export async function setEmployeeSeniority(formData: FormData) {
  const caller = await requireRole(["super_admin", "team_leader", "hr"]);
  const userId = String(formData.get("user_id") ?? "");
  const value = String(formData.get("seniority") ?? "");
  const seniority = ["senior", "junior", "trainee"].includes(value)
    ? (value as "senior" | "junior" | "trainee")
    : null;

  if (!userId) return;
  if (!(await canManageUser(caller.profile, userId))) return;

  const admin = createAdminClient();
  await admin.from("profiles").update({ seniority }).eq("id", userId);

  revalidatePath("/employees");
}

// Permanently deletes an employee account — super admins only. Removes the
// auth user (which cascades to their profile and all owned rows via the
// schema's ON DELETE CASCADE). Irreversible. A super admin cannot delete
// themselves (guards against locking everyone out).
export async function deleteEmployee(formData: FormData) {
  const caller = await requireRole(["super_admin"]);
  const userId = String(formData.get("user_id") ?? "");
  if (!userId || userId === caller.id) return;

  const admin = createAdminClient();
  // Deleting the auth user cascades to public.profiles (FK on delete cascade).
  await admin.auth.admin.deleteUser(userId);

  revalidatePath("/employees");
}
