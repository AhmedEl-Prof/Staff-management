-- =============================================================================
-- Migration 0018 — Per-project checklists
-- A customizable checklist for each project: a manager adds/edits/removes
-- items (label, optional assignee, notes), and any project member can tick an
-- item done. Visibility + write access follow project access (RLS reuses
-- can_access_project / manages_project).
-- =============================================================================

create table public.project_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  label       text not null,
  done        boolean not null default false,
  assigned_to uuid references public.profiles (id) on delete set null,
  notes       text,
  sort_order  integer not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index project_checklist_items_project_idx
  on public.project_checklist_items (project_id, sort_order);

alter table public.project_checklist_items enable row level security;

-- Read + tick done: anyone who can access the project.
create policy project_checklist_select on public.project_checklist_items
  for select to authenticated
  using (public.can_access_project(project_id));

create policy project_checklist_update on public.project_checklist_items
  for update to authenticated
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

-- Add / remove items: project managers (or super admins) only.
create policy project_checklist_insert on public.project_checklist_items
  for insert to authenticated
  with check (public.manages_project(project_id));

create policy project_checklist_delete on public.project_checklist_items
  for delete to authenticated
  using (public.manages_project(project_id));

create trigger project_checklist_set_updated_at
  before update on public.project_checklist_items
  for each row execute function public.set_updated_at();

create trigger audit_project_checklist
  after insert or update or delete on public.project_checklist_items
  for each row execute function public.record_audit_log();
