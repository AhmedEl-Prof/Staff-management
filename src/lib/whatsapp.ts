import { createAdminClient } from "@/lib/supabase/admin";

// WhatsApp delivery via the Meta WhatsApp Business Cloud API. The channel is
// optional: without WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID every
// call is a silent no-op, so the rest of the notification pipeline never has
// to care whether WhatsApp is configured.

const GRAPH_URL = "https://graph.facebook.com/v20.0";

export function whatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
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

// Sends a plain-text WhatsApp message. Best-effort: returns false on any
// failure and never throws.
export async function sendWhatsAppMessage(
  to: string,
  body: string,
): Promise<boolean> {
  if (!whatsappConfigured()) return false;
  const number = normalizeWhatsAppNumber(to);
  if (!number) return false;

  try {
    const res = await fetch(
      `${GRAPH_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: number,
          type: "text",
          text: { body: body.slice(0, 4096) },
        }),
      },
    );
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
// (whatsapp field, falling back to phone). No-op when unconfigured, the user
// has no number, or they opted out in notification preferences.
export async function sendWhatsAppToUser(
  userId: string,
  body: string,
): Promise<boolean> {
  if (!whatsappConfigured()) return false;

  const admin = createAdminClient();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    admin
      .from("profiles")
      .select("whatsapp, phone")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("notification_preferences")
      .select("whatsapp_notifications")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (prefs && prefs.whatsapp_notifications === false) return false;
  const number = profile?.whatsapp || profile?.phone;
  if (!number) return false;

  return sendWhatsAppMessage(number, body);
}
