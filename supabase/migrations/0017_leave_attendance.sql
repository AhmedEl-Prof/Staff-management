-- =============================================================================
-- Migration 0017 — Leave management & simple attendance
-- * leave_balances: yearly quota per employee (annual / sick / casual). Used
--   days are derived from approved requests, so only the quota is stored.
-- * leave_requests: a request with a date range, day count, type and an
--   approval status reviewed by a manager.
-- * attendance: one row per employee per day with check-in / check-out times.
-- Visibility uses manages_user() (super admin, or a team leader who manages a
-- department the employee belongs to).
-- =============================================================================

create type public.leave_type as enum ('annual', 'sick', 'casual');
create type public.leave_status as enum (
  'pending', 'approved', 'rejected', 'cancelled'
);

create table public.leave_balances (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  year         integer not null,
  annual_quota numeric not null default 21,
  sick_quota   numeric not null default 7,
  casual_quota numeric not null default 7,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, year)
);

create table public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  type          public.leave_type not null,
  start_date    date not null,
  end_date      date not null,
  days          numeric not null default 0,
  reason        text,
  status        public.leave_status not null default 'pending',
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.attendance (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  date       date not null,
  check_in   timestamptz,
  check_out  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index leave_requests_user_idx on public.leave_requests (user_id, start_date);
create index attendance_user_date_idx on public.attendance (user_id, date);

alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.attendance enable row level security;

-- Leave balances: employee reads own; a manager reads/sets their team's.
create policy leave_balances_select on public.leave_balances
  for select to authenticated
  using (user_id = auth.uid() or public.manages_user(user_id));
create policy leave_balances_manage on public.leave_balances
  for all to authenticated
  using (public.manages_user(user_id))
  with check (public.manages_user(user_id));

-- Leave requests: employee manages their own; a manager sees/reviews their team.
create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (user_id = auth.uid() or public.manages_user(user_id));
create policy leave_requests_manage on public.leave_requests
  for all to authenticated
  using (user_id = auth.uid() or public.manages_user(user_id))
  with check (user_id = auth.uid() or public.manages_user(user_id));

-- Attendance: employee records their own; a manager views their team.
create policy attendance_select on public.attendance
  for select to authenticated
  using (user_id = auth.uid() or public.manages_user(user_id));
create policy attendance_manage on public.attendance
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger leave_balances_set_updated_at
  before update on public.leave_balances
  for each row execute function public.set_updated_at();
create trigger leave_requests_set_updated_at
  before update on public.leave_requests
  for each row execute function public.set_updated_at();
create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

create trigger audit_leave_requests
  after insert or update or delete on public.leave_requests
  for each row execute function public.record_audit_log();
create trigger audit_leave_balances
  after insert or update or delete on public.leave_balances
  for each row execute function public.record_audit_log();
