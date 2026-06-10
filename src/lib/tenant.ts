import { createAdminClient } from "@/lib/supabase/admin";
import type { OrganizationRow } from "@/types/database";

// Subdomain tenancy helpers. With NEXT_PUBLIC_ROOT_DOMAIN=deepentry.net and a
// wildcard DNS record (*.deepentry.net -> the app), each organization is
// reachable at <slug>.deepentry.net. Without the env var everything below is
// a no-op and the app behaves as a single host.

const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "static",
  "assets",
  "platform",
  "portal",
  "signup",
  "login",
]);

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}

// Extracts the org slug from a request host, or null when the host is the
// apex/www, a non-production host (vercel.app previews, localhost), or the
// feature is unconfigured.
export function slugFromHost(host: string | null): string | null {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!root || !host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  if (hostname === root || !hostname.endsWith(`.${root}`)) return null;
  const sub = hostname.slice(0, -(root.length + 1));
  if (!sub || sub.includes(".") || RESERVED_SLUGS.has(sub)) return null;
  return sub;
}

// Hostname pattern for custom domains (e.g. hr.acme.com): labels of letters,
// digits and dashes, at least one dot, max 253 chars.
export const DOMAIN_PATTERN =
  /^(?=.{4,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export function isValidCustomDomain(domain: string): boolean {
  if (!DOMAIN_PATTERN.test(domain)) return false;
  // Anything under the platform's root domain belongs to slug routing, and
  // the root itself is the marketing/app host.
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && (domain === root || domain.endsWith(`.${root}`))) return false;
  return true;
}

// Resolves the organization for a request host (active orgs only): an exact
// custom-domain match first, then the <slug>.<root> subdomain.
export async function orgFromHost(
  host: string | null,
): Promise<OrganizationRow | null> {
  if (!host) return null;
  const admin = createAdminClient();

  const hostname = host.split(":")[0].toLowerCase();
  const { data: byDomain } = await admin
    .from("organizations")
    .select("*")
    .eq("custom_domain", hostname)
    .eq("is_active", true)
    .maybeSingle();
  if (byDomain) return byDomain as OrganizationRow;

  const slug = slugFromHost(host);
  if (!slug) return null;
  const { data: bySlug } = await admin
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return (bySlug as OrganizationRow | null) ?? null;
}

// The canonical URL for an org: its custom domain first, then its subdomain,
// else the app URL. Used for "share your company's login page" + redirects.
export function orgUrl(
  slug: string | null,
  customDomain?: string | null,
): string {
  if (customDomain) return `https://${customDomain}`;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && slug) return `https://${slug}.${root}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
