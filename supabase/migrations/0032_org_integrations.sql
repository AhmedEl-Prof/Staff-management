-- =============================================================================
-- Migration 0032 — Per-organization integration credentials
-- Each company connects its own WhatsApp Business number. The access token is
-- stored AES-256-GCM-encrypted (token-crypto), and the table has RLS enabled
-- with NO policies on purpose: only the service role (server actions) can
-- read or write it — org members must never see the raw credentials.
-- =============================================================================

create table public.org_integrations (
  org_id             uuid primary key references public.organizations (id) on delete cascade,
  whatsapp_phone_id  text,
  whatsapp_token_enc text,
  updated_at         timestamptz not null default now()
);

alter table public.org_integrations enable row level security;

create trigger org_integrations_set_updated_at
  before update on public.org_integrations
  for each row execute function public.set_updated_at();
