import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/token-crypto";

// WhatsApp delivery via the Meta WhatsApp Business Cloud API.
//
// Credential resolution, per recipient: their organization's own connected
// number (org_integrations, token encrypted at rest) first, then the
// platform-level env vars as a fallback. With neither configured every call
// is a silent no-op, so the notification pipeline never has to care.

const GRAPH_URL = "https://graph.facebook.com/v20.0";

interface WhatsAppCreds {
  token: string;
  phoneNumberId: string;
}

function envCreds(): WhatsAppCreds | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return token && phoneNumberId ? { token, phoneNumberId } : null;
}

// The org's own connected number, when set up and decryptable.
async function orgCreds(orgId: string): Promise<WhatsAppCreds | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_integrations")
    .select("whatsapp_phone_id, whatsapp_token_enc")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data?.whatsapp_phone_id || !data.whatsapp_token_enc) return null;
  try {
    return {
      token: decryptToken(data.whatsapp_token_enc),
      phoneNumberId: data.whatsapp_phone_id,
    };
  } catch (err) {
    console.error("[whatsapp] org token decrypt failed", err);
    return null;
  }
}

// Normalizes a stored number to international digits for the API.
// "0101 234 5678" (Egyptian local format) becomes "201012345678"; numbers
// already in international form ("+2010...", "0020...") just lose the symbols.
export function normalizeWhatsAppNumber(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Local Egyptian mobile (e.g. 01012345678) -> prepend country code.
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = `2${digits}`;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

// Sends a plain-text WhatsApp message with the given credentials.
// Best-effort: returns false on any failure and never throws.
export async function sendWhatsAppMessage(
  to: string,
  body: string,
  creds: WhatsAppCreds | null = envCreds(),
): Promise<boolean> {
  if (!creds) return false;
  const number = normalizeWhatsAppNumber(to);
  if (!number) return false;

  try {
    const res = await fetch(`${GRAPH_URL}/${creds.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: number,
        type: "text",
        text: { body: body.slice(0, 4096) },
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp] send failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] send failed", err);
    return false;
  }
}

// Sends a WhatsApp message to a user via the number on their profile
// (whatsapp field, falling back to phone), using their org's credentials
// (falling back to the platform's). No-op when unconfigured, the user has no
// number, or they opted out in notification preferences.
export async function sendWhatsAppToUser(
  userId: string,
  body: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    admin
      .from("profiles")
      .select("whatsapp, phone, org_id")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("notification_preferences")
      .select("whatsapp_notifications")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!profile) return false;
  if (prefs && prefs.whatsapp_notifications === false) return false;
  const number = profile.whatsapp || profile.phone;
  if (!number) return false;

  const creds = (await orgCreds(profile.org_id)) ?? envCreds();
  if (!creds) return false;

  return sendWhatsAppMessage(number, body, creds);
}

// True when the org has its own WhatsApp number connected (used by the UI to
// show connection state without ever exposing the token).
export async function orgWhatsAppConnected(orgId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_integrations")
    .select("whatsapp_phone_id, whatsapp_token_enc")
    .eq("org_id", orgId)
    .maybeSingle();
  return Boolean(data?.whatsapp_phone_id && data.whatsapp_token_enc);
}
