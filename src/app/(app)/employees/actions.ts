"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageUser, getManagedDepartmentIds } from "@/lib/permissions";

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().trim().max(120).optional(),
  arabic_name: z.string().trim().max(120).optional(),
  role: z.enum(["super_admin", "team_leader", "team_member"]),
  employment_type: z.enum(["full_time", "part_time", "freelance"]),
  weekly_hours: z.coerce.number().int().min(0).max(168).default(40),
  department_id: z.string().uuid().optional(),
  hire_date: z.string().optional(),
});

export type InviteState = { error: string | null; success: boolean };

// Invites a new employee. Super admins may invite into any department with any
// role; team leaders may only invite team members into departments they manage.
// The invite email contains a link to /reset-password where the user sets their
// password (there is no public signup).
export async function inviteEmployee(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const caller = await requireRole(["super_admin", "team_leader"]);

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name") || undefined,
    arabic_name: formData.get("arabic_name") || undefined,
    role: formData.get("role"),
    employment_type: formData.get("employment_type"),
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

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(
    data.email,
    {
      data: {
        full_name: data.full_name,
        arabic_name: data.arabic_name,
        role: data.role,
        employment_type: data.employment_type,
      },
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    },
  );

  if (error || !invited?.user) {
    const alreadyExists = error?.message?.toLowerCase().includes("already");
    return { error: alreadyExists ? "emailExists" : "invalid", success: false };
  }

  const userId = invited.user.id;

  // The handle_new_user trigger has created the profile from metadata; fill in
  // the remaining fields here.
  await admin
    .from("profiles")
    .update({
      weekly_hours: data.weekly_hours,
      hire_date: data.hire_date ?? null,
    })
    .eq("id", userId);

  if (data.department_id) {
    await admin
      .from("department_members")
      .insert({
        department_id: data.department_id,
        user_id: userId,
        role: "member",
      });
  }

  revalidatePath("/employees");
  return { error: null, success: true };
}

// Activates or deactivates an employee account. Authorized for super admins
// (anyone) and team leaders (members of departments they manage).
export async function setEmployeeActive(formData: FormData) {
  const caller = await requireRole(["super_admin", "team_leader"]);
  const userId = String(formData.get("user_id") ?? "");
  const isActive = String(formData.get("is_active")) === "true";

  if (!userId) return;
  if (!(await canManageUser(caller.profile, userId))) return;

  const admin = createAdminClient();
  await admin.from("profiles").update({ is_active: isActive }).eq("id", userId);

  revalidatePath("/employees");
}
