-- =============================================================================
-- Migration 0020 — Web Push subscriptions
-- Stores each browser/device push subscription per user. The endpoint is
-- unique (the browser may re-subscribe with the same endpoint, so upsert on
-- it). Sending happens server-side via the service-role client; users only
-- manage their own rows.
-- =============================================================================

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Users manage only their own subscriptions. Server-initiated sends use the
-- service-role client, which bypasses RLS.
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());
