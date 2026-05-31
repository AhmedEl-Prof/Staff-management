-- =============================================================================
-- Migration 0024 — Per-department tools / credentials directory
-- name, login URL, username, password, notes. Visible to department members;
-- editable by department managers / HR / super admin (mirrors bonus_items).
-- No audit trigger is attached on purpose: the audit log snapshots row changes
-- as JSON, which would persist plaintext passwords there.
-- =============================================================================

create table public.department_tools (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  name          text not null,
  url           text,
  username      text,
  password      text,
  notes         text,
  sort_order    integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index department_tools_department_idx
  on public.department_tools (department_id, sort_order);

alter table public.department_tools enable row level security;

create policy department_tools_select on public.department_tools
  for select to authenticated
  using (public.is_department_member(department_id) or public.is_hr());

create policy department_tools_manage on public.department_tools
  for all to authenticated
  using (public.manages_department(department_id) or public.is_hr())
  with check (public.manages_department(department_id) or public.is_hr());

create trigger department_tools_set_updated_at
  before update on public.department_tools
  for each row execute function public.set_updated_at();
