-- =============================================================================
-- Migration 0021 — HR role
-- Adds a company-wide "hr" role: oversees every employee's people-data
-- (employees, leave, attendance, evaluations, KPIs, bonus) across all
-- departments, without super-admin reach (no audit log, no department/project
-- structure changes).
--
-- NOTE: `alter type ... add value` cannot run in the same transaction as code
-- that uses the new value, so this is split: the enum value is added first,
-- then (in a separate migration / statement) the helpers + policies below.
-- =============================================================================

-- 1) Enum value (must be committed before use).
alter type public.app_role add value if not exists 'hr';

-- 2) Helper + policy updates (run after the enum value is committed).
create or replace function public.is_hr()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_app_role() = 'hr', false);
$$;

-- HR satisfies manages_user(), which powers leave / attendance / evaluation /
-- KPI / standup read + write policies — granting HR oversight of all employees.
create or replace function public.manages_user(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin()
    or public.is_hr()
    or exists (
      select 1 from public.department_members dm
      where dm.user_id = target
        and public.manages_department(dm.department_id)
    );
$$;

-- Bonus (department-scoped) — add an HR override so HR can read/manage across
-- departments.
drop policy if exists bonus_periods_select on public.bonus_periods;
create policy bonus_periods_select on public.bonus_periods
  for select to authenticated
  using (user_id = auth.uid() or public.manages_department(department_id) or public.is_hr());

drop policy if exists bonus_periods_manage on public.bonus_periods;
create policy bonus_periods_manage on public.bonus_periods
  for all to authenticated
  using (public.manages_department(department_id) or public.is_hr())
  with check (public.manages_department(department_id) or public.is_hr());

drop policy if exists bonus_awards_select on public.bonus_awards;
create policy bonus_awards_select on public.bonus_awards
  for select to authenticated
  using (user_id = auth.uid() or public.manages_department(department_id) or public.is_hr());

drop policy if exists bonus_awards_manage on public.bonus_awards;
create policy bonus_awards_manage on public.bonus_awards
  for all to authenticated
  using (public.manages_department(department_id) or public.is_hr())
  with check (public.manages_department(department_id) or public.is_hr());

drop policy if exists bonus_items_select on public.bonus_items;
create policy bonus_items_select on public.bonus_items
  for select to authenticated
  using (public.is_department_member(department_id) or public.is_hr());

drop policy if exists bonus_items_manage on public.bonus_items;
create policy bonus_items_manage on public.bonus_items
  for all to authenticated
  using (public.manages_department(department_id) or public.is_hr())
  with check (public.manages_department(department_id) or public.is_hr());
