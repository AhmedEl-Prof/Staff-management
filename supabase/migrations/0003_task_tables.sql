-- =============================================================================
-- Migration 0003 — Task tables
-- tasks, task_comments, task_attachments, task_dependencies, time_logs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- tasks (self-referencing for subtasks via parent_task_id)
-- -----------------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  parent_task_id  uuid references public.tasks (id) on delete cascade,
  title           text not null,
  description     text,
  status          task_status not null default 'todo',
  priority        priority_level not null default 'medium',
  assigned_to     uuid references public.profiles (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null,
  estimated_hours numeric(6, 2),
  actual_hours    numeric(6, 2),
  start_date      date,
  due_date        date,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_parent_task_id_idx on public.tasks (parent_task_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_status_idx on public.tasks (status);

-- -----------------------------------------------------------------------------
-- task_comments (mentions = array of profile ids referenced via @username)
-- -----------------------------------------------------------------------------
create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  content    text not null,
  mentions   uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index task_comments_task_id_idx on public.task_comments (task_id);

-- -----------------------------------------------------------------------------
-- task_attachments
-- -----------------------------------------------------------------------------
create table public.task_attachments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  file_name   text not null,
  file_url    text not null,
  file_size   bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index task_attachments_task_id_idx on public.task_attachments (task_id);

-- -----------------------------------------------------------------------------
-- task_dependencies (task depends_on another task)
-- -----------------------------------------------------------------------------
create table public.task_dependencies (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references public.tasks (id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks (id) on delete cascade,
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create index task_dependencies_task_id_idx on public.task_dependencies (task_id);

-- -----------------------------------------------------------------------------
-- time_logs
-- -----------------------------------------------------------------------------
create table public.time_logs (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  hours       numeric(6, 2) not null,
  description text,
  logged_date date not null default current_date,
  created_at  timestamptz not null default now()
);

create index time_logs_task_id_idx on public.time_logs (task_id);
create index time_logs_user_id_idx on public.time_logs (user_id);
