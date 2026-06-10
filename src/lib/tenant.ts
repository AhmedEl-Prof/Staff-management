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

// Resolves the organization for a host's subdomain (active orgs only).
export async function orgFromHost(
  host: string | null,
): Promise<OrganizationRow | null> {
  const slug = slugFromHost(host);
  if (!slug) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return (data as OrganizationRow | null) ?? null;
}

// The canonical URL for an org (its subdomain when configured, else the app
// URL). Used for "share your company's login page" UI.
export function orgUrl(slug: string | null): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && slug) return `https://${slug}.${root}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
