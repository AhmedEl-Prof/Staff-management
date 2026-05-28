-- =============================================================================
-- Migration 0002 — Core tables
-- profiles, departments, department_members, projects, project_members
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles — one row per user, 1:1 with auth.users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text,
  arabic_name     text,
  avatar_url      text,
  phone           text,
  role            app_role        not null default 'team_member',
  employment_type employment_type not null default 'full_time',
  weekly_hours    int             not null default 40,
  hire_date       date,
  is_active       boolean         not null default true,
  created_at      timestamptz     not null default now(),
  updated_at      timestamptz     not null default now()
);

comment on table public.profiles is 'User profiles, 1:1 with auth.users.';

-- -----------------------------------------------------------------------------
-- departments
-- -----------------------------------------------------------------------------
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_ar     text not null,
  description text,
  color       text,
  icon        text,
  manager_id  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index departments_manager_id_idx on public.departments (manager_id);

-- -----------------------------------------------------------------------------
-- department_members
-- -----------------------------------------------------------------------------
create table public.department_members (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role          department_member_role not null default 'member',
  joined_at     timestamptz not null default now(),
  unique (department_id, user_id)
);

create index department_members_department_id_idx on public.department_members (department_id);
create index department_members_user_id_idx on public.department_members (user_id);

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  department_id   uuid not null references public.departments (id) on delete cascade,
  name            text not null,
  name_ar         text,
  description     text,
  client_name     text,
  status          project_status not null default 'planning',
  priority        priority_level not null default 'medium',
  start_date      date,
  end_date        date,
  drive_folder_id text,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index projects_department_id_idx on public.projects (department_id);
create index projects_status_idx on public.projects (status);

-- -----------------------------------------------------------------------------
-- project_members
-- -----------------------------------------------------------------------------
create table public.project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        project_member_role not null default 'member',
  assigned_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_members_project_id_idx on public.project_members (project_id);
create index project_members_user_id_idx on public.project_members (user_id);
