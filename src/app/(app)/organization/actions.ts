"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/token-crypto";
import { isValidSlug } from "@/lib/tenant";

const orgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  logo_url: z
    .string()
    .trim()
    .max(300)
    .optional()
    .refine((v) => !v || /^https?:\/\/.+/i.test(v), { message: "url" }),
  slug: z.string().trim().toLowerCase().max(40).optional(),
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
    slug: formData.get("slug") || undefined,
  });
  if (!parsed.success) return { error: "invalid", success: false };

  // Subdomain slug: validated against the pattern + reserved names, and must
  // be unique across organizations.
  const slug = parsed.data.slug || null;
  if (slug && !isValidSlug(slug)) {
    return { error: "invalidSlug", success: false };
  }

  const admin = createAdminClient();
  if (slug) {
    const { data: taken } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .neq("id", caller.profile.org_id)
      .maybeSingle();
    if (taken) return { error: "slugTaken", success: false };
  }

  const { error } = await admin
    .from("organizations")
    .update({
      name: parsed.data.name,
      logo_url: parsed.data.logo_url || null,
      ...(slug ? { slug } : {}),
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

const metaAdsSchema = z.object({
  ad_account_id: z.string().trim().min(5).max(40).regex(/^(act_)?\d+$/),
  access_token: z.string().trim().min(20).max(500),
});

// Connects the org's Meta Ads account (token encrypted at rest, same model as
// WhatsApp). Powers the live ads KPIs on the analytics page.
export async function connectOrgMetaAds(
  _prev: OrgState,
  formData: FormData,
): Promise<OrgState> {
  const caller = await requireRole(["super_admin"]);

  const parsed = metaAdsSchema.safeParse({
    ad_account_id: formData.get("ad_account_id"),
    access_token: formData.get("access_token"),
  });
  if (!parsed.success) return { error: "invalid", success: false };

  let tokenEnc: string;
  try {
    tokenEnc = encryptToken(parsed.data.access_token);
  } catch {
    return { error: "failed", success: false };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("org_integrations").upsert(
    {
      org_id: caller.profile.org_id,
      meta_ad_account_id: parsed.data.ad_account_id.replace(/^act_/, ""),
      meta_ads_token_enc: tokenEnc,
    },
    { onConflict: "org_id" },
  );
  if (error) return { error: "failed", success: false };

  revalidatePath("/organization");
  revalidatePath("/analytics");
  return { error: null, success: true };
}

export async function disconnectOrgMetaAds(): Promise<void> {
  const caller = await requireRole(["super_admin"]);
  const admin = createAdminClient();
  await admin
    .from("org_integrations")
    .update({ meta_ad_account_id: null, meta_ads_token_enc: null })
    .eq("org_id", caller.profile.org_id);
  revalidatePath("/organization");
  revalidatePath("/analytics");
}
