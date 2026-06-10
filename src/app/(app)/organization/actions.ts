"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const orgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  logo_url: z
    .string()
    .trim()
    .max(300)
    .optional()
    .refine((v) => !v || /^https?:\/\/.+/i.test(v), { message: "url" }),
});

export type OrgState = { error: string | null; success: boolean };

// Updates the caller's OWN organization (super admin only). Authorized in app
// code then executed with the admin client, mirroring the other write actions;
// the .eq("id", caller org) keeps it impossible to touch another org.
export async function updateOrganization(
  _prev: OrgState,
  formData: FormData,
): Promise<OrgState> {
  const caller = await requireRole(["super_admin"]);

  const parsed = orgSchema.safeParse({
    name: formData.get("name"),
    logo_url: formData.get("logo_url") || undefined,
  });
  if (!parsed.success) return { error: "invalid", success: false };

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      name: parsed.data.name,
      logo_url: parsed.data.logo_url || null,
    })
    .eq("id", caller.profile.org_id);
  if (error) return { error: "failed", success: false };

  revalidatePath("/organization");
  return { error: null, success: true };
}
