-- =============================================================================
-- Migration 0004 — Integration & notification tables
-- drive_connections, drive_folders, notifications, notification_preferences
-- =============================================================================

-- -----------------------------------------------------------------------------
-- drive_connections — per-user Google Drive OAuth tokens (encrypted at rest)
-- -----------------------------------------------------------------------------
create table public.drive_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id)
);

-- -----------------------------------------------------------------------------
-- drive_folders — Drive folder mapped to a project
-- -----------------------------------------------------------------------------
create table public.drive_folders (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  folder_id  text not null,
  folder_url text,
  synced_at  timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id)
);

-- -----------------------------------------------------------------------------
-- notifications — in-app notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  message    text,
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id);
create index notifications_user_unread_idx
  on public.notifications (user_id) where is_read = false;

-- -----------------------------------------------------------------------------
-- notification_preferences — one row per user
-- -----------------------------------------------------------------------------
create table public.notification_preferences (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  email_task_assigned  boolean not null default true,
  email_task_deadline  boolean not null default true,
  email_mentions       boolean not null default true,
  email_evaluations    boolean not null default true,
  in_app_notifications boolean not null default true,
  unique (user_id)
);
