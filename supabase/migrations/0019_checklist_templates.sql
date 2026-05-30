-- =============================================================================
-- Migration 0019 — Per-department checklist templates
-- A standard checklist defined once per department. New projects created in
-- that department get these items copied into their project checklist
-- automatically (and a manager can re-apply the template to an existing
-- project on demand). Visibility = department member; edit = department
-- manager (mirrors the bonus_items model).
-- =============================================================================

create table public.checklist_templates (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  label         text not null,
  sort_order    integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index checklist_templates_department_idx
  on public.checklist_templates (department_id, sort_order);

alter table public.checklist_templates enable row level security;

-- Read: anyone in the department.
create policy checklist_templates_select on public.checklist_templates
  for select to authenticated
  using (public.is_department_member(department_id));

-- Write: department managers (or super admins).
create policy checklist_templates_manage on public.checklist_templates
  for all to authenticated
  using (public.manages_department(department_id))
  with check (public.manages_department(department_id));

create trigger checklist_templates_set_updated_at
  before update on public.checklist_templates
  for each row execute function public.set_updated_at();

create trigger audit_checklist_templates
  after insert or update or delete on public.checklist_templates
  for each row execute function public.record_audit_log();
