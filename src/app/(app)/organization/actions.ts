"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/token-crypto";

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

const waSchema = z.object({
  phone_number_id: z.string().trim().min(5).max(40).regex(/^\d+$/),
  access_token: z.string().trim().min(20).max(500),
});

// Connects the org's own WhatsApp Business number (Meta Cloud API). The token
// is encrypted at rest; org members can never read it back — only replace it.
export async function connectOrgWhatsApp(
  _prev: OrgState,
  formData: FormData,
): Promise<OrgState> {
  const caller = await requireRole(["super_admin"]);

  const parsed = waSchema.safeParse({
    phone_number_id: formData.get("phone_number_id"),
    access_token: formData.get("access_token"),
  });
  if (!parsed.success) return { error: "invalid", success: false };

  let tokenEnc: string;
  try {
    tokenEnc = encryptToken(parsed.data.access_token);
  } catch {
    // DRIVE_TOKEN_ENCRYPTION_KEY missing — surface as a save failure.
    return { error: "failed", success: false };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("org_integrations").upsert(
    {
      org_id: caller.profile.org_id,
      whatsapp_phone_id: parsed.data.phone_number_id,
      whatsapp_token_enc: tokenEnc,
    },
    { onConflict: "org_id" },
  );
  if (error) return { error: "failed", success: false };

  revalidatePath("/organization");
  return { error: null, success: true };
}

// Disconnects the org's WhatsApp number (notifications fall back to the
// platform-level number, if configured).
export async function disconnectOrgWhatsApp(): Promise<void> {
  const caller = await requireRole(["super_admin"]);
  const admin = createAdminClient();
  await admin
    .from("org_integrations")
    .update({ whatsapp_phone_id: null, whatsapp_token_enc: null })
    .eq("org_id", caller.profile.org_id);
  revalidatePath("/organization");
}
