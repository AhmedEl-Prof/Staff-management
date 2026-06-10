-- =============================================================================
-- Migration 0033 — Meta Ads integration credentials
-- Per-org Meta (Facebook) Ads account: encrypted access token + ad account id
-- on the service-role-only org_integrations table (same model as WhatsApp).
-- Used to pull live account KPIs (spend, impressions, clicks, CTR, CPC) into
-- the analytics page.
-- =============================================================================

alter table public.org_integrations
  add column if not exists meta_ad_account_id text,
  add column if not exists meta_ads_token_enc text;
