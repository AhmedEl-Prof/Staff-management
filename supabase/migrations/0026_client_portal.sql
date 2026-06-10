-- =============================================================================
-- Migration 0026 — Client portal links
-- A manager can generate a secret tokenized link for a project. Anyone holding
-- the link sees a read-only, client-safe status page (progress, milestones,
-- recent deliverables) without logging in. The public page reads through the
-- service-role client after validating the token, so NO anon RLS policy is
-- added here — authenticated policies only cover in-app management of links.
-- =============================================================================

create table public.project_portal_links (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  token        text not null unique,
  client_label text,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);

create index project_portal_links_project_idx
  on public.project_portal_links (project_id);

alter table public.project_portal_links enable row level security;

-- See links: anyone who can access the project (the link itself is shown only
-- to managers in the UI, but visibility scoping mirrors the project).
create policy project_portal_links_select on public.project_portal_links
  for select to authenticated
  using (public.can_access_project(project_id));

-- Create / revoke / delete links: project managers (or super admins) only.
create policy project_portal_links_insert on public.project_portal_links
  for insert to authenticated
  with check (public.manages_project(project_id));

create policy project_portal_links_update on public.project_portal_links
  for update to authenticated
  using (public.manages_project(project_id))
  with check (public.manages_project(project_id));

create policy project_portal_links_delete on public.project_portal_links
  for delete to authenticated
  using (public.manages_project(project_id));

create trigger audit_project_portal_links
  after insert or update or delete on public.project_portal_links
  for each row execute function public.record_audit_log();
