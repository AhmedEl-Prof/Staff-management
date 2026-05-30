-- =============================================================================
-- Migration 0015 — Bonus structure per department
-- A small, manager-editable reference table shown to every member of a
-- department: each bonus item, its weight, the maximum payout and how it is
-- calculated. Visibility follows department membership; only department
-- managers (or super admins) may create/edit/delete rows — enforced via RLS,
-- mirroring the projects model.
-- =============================================================================

create table public.bonus_items (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references public.departments (id) on delete cascade,
  item           text not null,
  weight_percent numeric,
  max_amount     numeric,
  method         text,
  sort_order     integer not null default 0,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index bonus_items_department_idx
  on public.bonus_items (department_id, sort_order);

alter table public.bonus_items enable row level security;

-- Read: anyone in the department (members, managers, super admin).
create policy bonus_items_select on public.bonus_items
  for select to authenticated
  using (public.is_department_member(department_id));

-- Write: only department managers (or super admins).
create policy bonus_items_manage on public.bonus_items
  for all to authenticated
  using (public.manages_department(department_id))
  with check (public.manages_department(department_id));

create trigger bonus_items_set_updated_at
  before update on public.bonus_items
  for each row execute function public.set_updated_at();

create trigger audit_bonus_items
  after insert or update or delete on public.bonus_items
  for each row execute function public.record_audit_log();
