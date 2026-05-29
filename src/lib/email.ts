import { Resend } from "resend";

// Lazily instantiate so the app boots fine without RESEND_API_KEY in dev. The
// notification helper will simply skip the email send if the key is missing.
let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export interface EmailMessage {
  to: string;
  subject: string;
  /** Pre-rendered Arabic-RTL body HTML (just the inner content). */
  bodyHtml: string;
  /** Optional click-through URL surfaced as a primary CTA button. */
  link?: string;
  linkLabel?: string;
}

const FROM_FALLBACK = "Everest Ads <noreply@everestads.com>";

// Wraps the message body in an RTL Arabic email shell. Inlined styles only —
// no external CSS in emails.
function renderEmail({ bodyHtml, link, linkLabel }: EmailMessage): string {
  const cta = link
    ? `<p style="margin:24px 0 0 0;text-align:center">
         <a href="${link}" style="background:#0a0a0a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;display:inline-block">
           ${linkLabel ?? "افتح"}
         </a>
       </p>`
    : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f7f7f8;font-family:Arial,Tahoma,sans-serif;color:#0a0a0a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f8;padding:24px 0">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:12px;padding:32px;direction:rtl">
            <tr>
              <td>
                <h1 style="margin:0 0 16px 0;font-size:20px">إدارة الموظفين — Everest Ads</h1>
                <div style="font-size:14px;line-height:1.7;color:#1a1a1a">${bodyHtml}</div>
                ${cta}
                <p style="margin:32px 0 0 0;font-size:12px;color:#777">
                  هذه رسالة آلية — يمكنك تعديل تفضيلات الإشعارات من ملفك الشخصي.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Sends an email via Resend. Returns true on success; false (and logs) on any
// failure — callers should treat email as best-effort.
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const from = process.env.RESEND_FROM ?? FROM_FALLBACK;
  try {
    const { error } = await client.emails.send({
      from,
      to: msg.to,
      subject: msg.subject,
      html: renderEmail(msg),
    });
    if (error) {
      console.error("[email] resend error", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] resend exception", err);
    return false;
  }
}
