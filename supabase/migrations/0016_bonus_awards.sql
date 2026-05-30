-- =============================================================================
-- Migration 0016 — Bonus awards (monthly bonus calculation)
-- Builds on the bonus_items "structure" table: for each employee and month a
-- manager records how much of each bonus item was achieved (0–100%), and the
-- system stores the earned amount (achievement × the item's max). A per-period
-- header row tracks approval / payout status.
-- =============================================================================

create type public.bonus_status as enum ('draft', 'approved', 'paid');

-- Per employee, per month: approval / payout status for the whole sheet.
create table public.bonus_periods (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  period        date not null, -- first day of the month
  status        public.bonus_status not null default 'draft',
  note          text,
  approved_by   uuid references public.profiles (id) on delete set null,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, period)
);

-- Per employee, per month, per bonus item: achievement and earned amount.
create table public.bonus_awards (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  department_id       uuid not null references public.departments (id) on delete cascade,
  period              date not null,
  bonus_item_id       uuid not null references public.bonus_items (id) on delete cascade,
  achievement_percent numeric not null default 0,
  amount              numeric not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, period, bonus_item_id)
);

create index bonus_periods_lookup_idx
  on public.bonus_periods (department_id, period);
create index bonus_awards_lookup_idx
  on public.bonus_awards (user_id, period);

alter table public.bonus_periods enable row level security;
alter table public.bonus_awards enable row level security;

-- Read: the employee sees their own; a department manager sees their team's.
create policy bonus_periods_select on public.bonus_periods
  for select to authenticated
  using (user_id = auth.uid() or public.manages_department(department_id));

create policy bonus_awards_select on public.bonus_awards
  for select to authenticated
  using (user_id = auth.uid() or public.manages_department(department_id));

-- Write: only department managers (or super admins).
create policy bonus_periods_manage on public.bonus_periods
  for all to authenticated
  using (public.manages_department(department_id))
  with check (public.manages_department(department_id));

create policy bonus_awards_manage on public.bonus_awards
  for all to authenticated
  using (public.manages_department(department_id))
  with check (public.manages_department(department_id));

create trigger bonus_periods_set_updated_at
  before update on public.bonus_periods
  for each row execute function public.set_updated_at();
create trigger bonus_awards_set_updated_at
  before update on public.bonus_awards
  for each row execute function public.set_updated_at();

create trigger audit_bonus_periods
  after insert or update or delete on public.bonus_periods
  for each row execute function public.record_audit_log();
create trigger audit_bonus_awards
  after insert or update or delete on public.bonus_awards
  for each row execute function public.record_audit_log();
