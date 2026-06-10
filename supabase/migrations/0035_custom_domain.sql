-- =============================================================================
-- Migration 0035 — Custom domain per organization
-- A company can be served from its own domain (e.g. hr.acme.com) instead of
-- (or in addition to) its <slug> subdomain. The domain must also be added to
-- the Vercel project (manual step) so TLS is issued; the platform admin then
-- records it here from the platform dashboard.
-- =============================================================================

alter table public.organizations
  add column if not exists custom_domain text unique;
