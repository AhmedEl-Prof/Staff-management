-- =============================================================================
-- Migration 0006 — Gamification & audit tables
-- points_log, badges, user_badges, audit_logs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- points_log — gamification points ledger
-- -----------------------------------------------------------------------------
create table public.points_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  points      int not null,
  reason      text,
  source_type text,
  source_id   uuid,
  created_at  timestamptz not null default now()
);

create index points_log_user_id_idx on public.points_log (user_id);

-- -----------------------------------------------------------------------------
-- badges — achievement definitions
-- -----------------------------------------------------------------------------
create table public.badges (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_ar     text,
  description text,
  icon        text,
  criteria    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- user_badges — earned badges
-- -----------------------------------------------------------------------------
create table public.user_badges (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles (id) on delete cascade,
  badge_id  uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create index user_badges_user_id_idx on public.user_badges (user_id);

-- -----------------------------------------------------------------------------
-- audit_logs — automatic change tracking (populated by triggers)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  changes     jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_user_id_idx on public.audit_logs (user_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
