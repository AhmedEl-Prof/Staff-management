-- =============================================================================
-- Migration 0030 — Multi-tenant foundation (Phase 1)
--
-- Introduces organizations and scopes every cross-company surface to the
-- caller's organization:
--   1. organizations table + the founding org (Everest Ads).
--   2. org_id on the root tables (profiles, departments, kpi_definitions,
--      audit_logs). Child tables (projects, tasks, …) inherit isolation
--      through their department/project, whose helpers become org-aware.
--   3. current_org_id()/same_org()/org_department() helpers, and org guards in
--      manages_department() / manages_user() — the two functions nearly every
--      policy delegates to, so scoping them closes most leaks centrally.
--   4. Rewrites of the policies that reference is_super_admin()/is_hr()
--      without row context (those would otherwise let an admin of org B touch
--      org A rows), plus the company-wide reads (profiles, points, badges).
--
-- Existing rows are backfilled to the founding org, and org_id DEFAULTs to it
-- for now, so the running single-tenant deployment behaves identically until
-- Phase 2 (self-serve signup) starts creating other organizations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Organizations
-- -----------------------------------------------------------------------------
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique,
  logo_url   text,
  plan       text not null default 'internal',
  is_active  boolean not null default true,
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- The founding organization. Existing data is backfilled to it, and org_id
-- columns default to it until self-serve signup (Phase 2) takes over.
insert into public.organizations (id, name, slug, plan)
values ('00000000-0000-0000-0000-000000000001', 'Everest Ads', 'everest', 'internal');

-- -----------------------------------------------------------------------------
-- 2) org_id on root tables
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists org_id uuid not null
    default '00000000-0000-0000-0000-000000000001'
    references public.organizations (id);

alter table public.departments
  add column if not exists org_id uuid not null
    default '00000000-0000-0000-0000-000000000001'
    references public.organizations (id);

alter table public.kpi_definitions
  add column if not exists org_id uuid not null
    default '00000000-0000-0000-0000-000000000001'
    references public.organizations (id);

alter table public.audit_logs
  add column if not exists org_id uuid
    references public.organizations (id);
update public.audit_logs
  set org_id = '00000000-0000-0000-0000-000000000001'
  where org_id is null;

create index if not exists profiles_org_idx on public.profiles (org_id);
create index if not exists departments_org_idx on public.departments (org_id);
create index if not exists kpi_definitions_org_idx on public.kpi_definitions (org_id);
create index if not exists audit_logs_org_idx on public.audit_logs (org_id);

-- -----------------------------------------------------------------------------
-- 3) Org helpers + org-aware role helpers
-- -----------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- True if the target user belongs to the caller's organization.
create or replace function public.same_org(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target and p.org_id = public.current_org_id()
  );
$$;

-- True if the department belongs to the caller's organization.
create or replace function public.org_department(dept uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.departments d
    where d.id = dept and d.org_id = public.current_org_id()
  );
$$;

-- manages_department: the super-admin branch is now limited to departments in
-- the admin's own organization. The manager/membership branches are
-- intrinsically same-org (you can only be a member of your org's departments).
create or replace function public.manages_department(dept uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select (public.is_super_admin() and public.org_department(dept))
    or exists (
      select 1 from public.departments d
      where d.id = dept and d.manager_id = auth.uid()
    )
    or exists (
      select 1 from public.department_members dm
      where dm.department_id = dept
        and dm.user_id = auth.uid()
        and dm.role = 'manager'
    );
$$;

-- manages_user: super admin / HR reach is limited to their own organization.
create or replace function public.manages_user(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select ((public.is_super_admin() or public.is_hr()) and public.same_org(target))
    or exists (
      select 1 from public.department_members dm
      where dm.user_id = target
        and public.manages_department(dm.department_id)
    );
$$;

-- -----------------------------------------------------------------------------
-- 4) organizations policies — members read their org; org admins update it.
--    Creation/deactivation is platform-level (service role only).
-- -----------------------------------------------------------------------------
create policy organizations_select_own on public.organizations
  for select to authenticated
  using (id = public.current_org_id());

create policy organizations_admin_update on public.organizations
  for update to authenticated
  using (id = public.current_org_id() and public.is_super_admin())
  with check (id = public.current_org_id() and public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 5) profiles — visible within one's organization only
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid()
         or (public.is_super_admin() and org_id = public.current_org_id()))
  with check (id = auth.uid()
              or (public.is_super_admin() and org_id = public.current_org_id()));

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (public.is_super_admin() and org_id = public.current_org_id());

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using (public.is_super_admin() and org_id = public.current_org_id());

-- -----------------------------------------------------------------------------
-- 6) departments
-- -----------------------------------------------------------------------------
drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments
  for select to authenticated
  using (
    ((public.is_super_admin() or public.is_hr())
      and org_id = public.current_org_id())
    or public.is_department_member(id)
  );

drop policy if exists departments_admin_write on public.departments;
create policy departments_admin_write on public.departments
  for all to authenticated
  using (public.is_super_admin() and org_id = public.current_org_id())
  with check (public.is_super_admin() and org_id = public.current_org_id());

-- -----------------------------------------------------------------------------
-- 7) kpi_definitions — org-scoped ("global" definitions are per-org globals)
-- -----------------------------------------------------------------------------
drop policy if exists kpi_definitions_select on public.kpi_definitions;
create policy kpi_definitions_select on public.kpi_definitions
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (public.is_super_admin()
         or public.is_hr()
         or department_id is null
         or public.is_department_member(department_id))
  );

drop policy if exists kpi_definitions_manage on public.kpi_definitions;
create policy kpi_definitions_manage on public.kpi_definitions
  for all to authenticated
  using (
    org_id = public.current_org_id()
    and (public.is_super_admin()
         or public.manages_department(department_id))
  )
  with check (
    org_id = public.current_org_id()
    and (public.is_super_admin()
         or public.manages_department(department_id))
  );

-- -----------------------------------------------------------------------------
-- 8) gamification — leaderboard reads stay inside the organization
-- -----------------------------------------------------------------------------
drop policy if exists points_log_select on public.points_log;
create policy points_log_select on public.points_log
  for select to authenticated
  using (public.same_org(user_id));

drop policy if exists points_log_admin_write on public.points_log;
create policy points_log_admin_write on public.points_log
  for all to authenticated
  using (public.is_super_admin() and public.same_org(user_id))
  with check (public.is_super_admin() and public.same_org(user_id));

-- Badge catalogue stays a shared platform asset: readable by everyone,
-- writable only by the platform (service role) — an org admin must not edit
-- another org's badge labels.
drop policy if exists badges_admin_write on public.badges;

drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges
  for select to authenticated
  using (public.same_org(user_id));

drop policy if exists user_badges_admin_write on public.user_badges;
create policy user_badges_admin_write on public.user_badges
  for all to authenticated
  using (public.is_super_admin() and public.same_org(user_id))
  with check (public.is_super_admin() and public.same_org(user_id));

-- -----------------------------------------------------------------------------
-- 9) audit_logs — org admins see their org's trail only
-- -----------------------------------------------------------------------------
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_super_admin() and org_id = public.current_org_id());

-- Stamp the org on every audited change. Session-based when available;
-- otherwise derived from the audited row itself (org_id / user_id /
-- department_id / project_id / task_id) so service-role writes still land in
-- the right organization's audit trail.
create or replace function public.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id uuid;
  v_changes   jsonb;
  v_row       jsonb;
  v_org       uuid;
begin
  if (tg_op = 'DELETE') then
    v_entity_id := old.id;
    v_row := to_jsonb(old);
    v_changes := jsonb_build_object('old', v_row);
  elsif (tg_op = 'UPDATE') then
    v_entity_id := new.id;
    v_row := to_jsonb(new);
    v_changes := jsonb_build_object('old', to_jsonb(old), 'new', v_row);
  else -- INSERT
    v_entity_id := new.id;
    v_row := to_jsonb(new);
    v_changes := jsonb_build_object('new', v_row);
  end if;

  v_org := public.current_org_id();
  if v_org is null then
    if (v_row ? 'org_id') and (v_row->>'org_id') is not null then
      v_org := (v_row->>'org_id')::uuid;
    elsif (v_row ? 'user_id') and (v_row->>'user_id') is not null then
      select p.org_id into v_org
        from public.profiles p where p.id = (v_row->>'user_id')::uuid;
    elsif (v_row ? 'department_id') and (v_row->>'department_id') is not null then
      select d.org_id into v_org
        from public.departments d where d.id = (v_row->>'department_id')::uuid;
    elsif (v_row ? 'project_id') and (v_row->>'project_id') is not null then
      select d.org_id into v_org
        from public.projects p
        join public.departments d on d.id = p.department_id
        where p.id = (v_row->>'project_id')::uuid;
    elsif (v_row ? 'task_id') and (v_row->>'task_id') is not null then
      select d.org_id into v_org
        from public.tasks t
        join public.projects p on p.id = t.project_id
        join public.departments d on d.id = p.department_id
        where t.id = (v_row->>'task_id')::uuid;
    end if;
  end if;

  insert into public.audit_logs (user_id, org_id, action, entity_type, entity_id, changes)
  values (auth.uid(), v_org, tg_op, tg_table_name, v_entity_id, v_changes);

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10) Row-context guards for the remaining bare is_super_admin()/is_hr() uses
-- -----------------------------------------------------------------------------
drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert on public.notifications
  for insert to authenticated
  with check (public.is_super_admin() and public.same_org(user_id));

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = auth.uid()
         or (public.is_super_admin() and public.same_org(user_id)));

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid()
         or (public.is_super_admin() and public.same_org(user_id)))
  with check (user_id = auth.uid()
              or (public.is_super_admin() and public.same_org(user_id)));

drop policy if exists task_comments_delete_own on public.task_comments;
create policy task_comments_delete_own on public.task_comments
  for delete to authenticated
  using (user_id = auth.uid()
         or (public.is_super_admin() and public.same_org(user_id)));

drop policy if exists task_attachments_delete on public.task_attachments;
create policy task_attachments_delete on public.task_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid()
         or (public.is_super_admin() and public.same_org(uploaded_by)));

drop policy if exists time_logs_delete_own on public.time_logs;
create policy time_logs_delete_own on public.time_logs
  for delete to authenticated
  using (user_id = auth.uid()
         or (public.is_super_admin() and public.same_org(user_id)));

drop policy if exists peer_reviews_insert on public.peer_reviews;
create policy peer_reviews_insert on public.peer_reviews
  for insert to authenticated
  with check (reviewer_id = auth.uid() and public.same_org(reviewee_id));

drop policy if exists peer_reviews_delete on public.peer_reviews;
create policy peer_reviews_delete on public.peer_reviews
  for delete to authenticated
  using (reviewer_id = auth.uid()
         or (public.is_super_admin() and public.same_org(reviewer_id)));

drop policy if exists standup_responses_delete on public.standup_responses;
create policy standup_responses_delete on public.standup_responses
  for delete to authenticated
  using (user_id = auth.uid()
         or (public.is_super_admin() and public.same_org(user_id)));

-- Bonus + department tools: HR reach scoped to the HR user's organization.
drop policy if exists bonus_periods_select on public.bonus_periods;
create policy bonus_periods_select on public.bonus_periods
  for select to authenticated
  using (user_id = auth.uid()
         or public.manages_department(department_id)
         or (public.is_hr() and public.org_department(department_id)));

drop policy if exists bonus_periods_manage on public.bonus_periods;
create policy bonus_periods_manage on public.bonus_periods
  for all to authenticated
  using (public.manages_department(department_id)
         or (public.is_hr() and public.org_department(department_id)))
  with check (public.manages_department(department_id)
              or (public.is_hr() and public.org_department(department_id)));

drop policy if exists bonus_awards_select on public.bonus_awards;
create policy bonus_awards_select on public.bonus_awards
  for select to authenticated
  using (user_id = auth.uid()
         or public.manages_department(department_id)
         or (public.is_hr() and public.org_department(department_id)));

drop policy if exists bonus_awards_manage on public.bonus_awards;
create policy bonus_awards_manage on public.bonus_awards
  for all to authenticated
  using (public.manages_department(department_id)
         or (public.is_hr() and public.org_department(department_id)))
  with check (public.manages_department(department_id)
              or (public.is_hr() and public.org_department(department_id)));

drop policy if exists bonus_items_select on public.bonus_items;
create policy bonus_items_select on public.bonus_items
  for select to authenticated
  using (public.is_department_member(department_id)
         or (public.is_hr() and public.org_department(department_id)));

drop policy if exists bonus_items_manage on public.bonus_items;
create policy bonus_items_manage on public.bonus_items
  for all to authenticated
  using (public.manages_department(department_id)
         or (public.is_hr() and public.org_department(department_id)))
  with check (public.manages_department(department_id)
              or (public.is_hr() and public.org_department(department_id)));

drop policy if exists department_tools_select on public.department_tools;
create policy department_tools_select on public.department_tools
  for select to authenticated
  using (public.is_department_member(department_id)
         or (public.is_hr() and public.org_department(department_id)));

drop policy if exists department_tools_manage on public.department_tools;
create policy department_tools_manage on public.department_tools
  for all to authenticated
  using (public.manages_department(department_id)
         or (public.is_hr() and public.org_department(department_id)))
  with check (public.manages_department(department_id)
              or (public.is_hr() and public.org_department(department_id)));

-- -----------------------------------------------------------------------------
-- 11) New users join the organization passed in their invite metadata
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, arabic_name, role, employment_type, org_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'arabic_name',
    coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'team_member'),
    coalesce((new.raw_user_meta_data ->> 'employment_type')::employment_type, 'full_time'),
    coalesce(
      (new.raw_user_meta_data ->> 'org_id')::uuid,
      '00000000-0000-0000-0000-000000000001'
    )
  )
  on conflict (id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12) Lock down RPC surface: helper functions are for policies, not for
--     anonymous PostgREST calls. Trigger functions need no caller EXECUTE.
-- -----------------------------------------------------------------------------
revoke execute on function public.current_app_role() from anon, public;
revoke execute on function public.is_super_admin() from anon, public;
revoke execute on function public.is_team_leader() from anon, public;
revoke execute on function public.is_hr() from anon, public;
revoke execute on function public.manages_department(uuid) from anon, public;
revoke execute on function public.is_department_member(uuid) from anon, public;
revoke execute on function public.can_access_project(uuid) from anon, public;
revoke execute on function public.manages_project(uuid) from anon, public;
revoke execute on function public.can_access_task(uuid) from anon, public;
revoke execute on function public.manages_user(uuid) from anon, public;
revoke execute on function public.current_org_id() from anon, public;
revoke execute on function public.same_org(uuid) from anon, public;
revoke execute on function public.org_department(uuid) from anon, public;
revoke execute on function public.record_audit_log() from anon, public, authenticated;
revoke execute on function public.handle_new_user() from anon, public, authenticated;
revoke execute on function public.protect_profile_admin_fields() from anon, public, authenticated;
revoke execute on function public.rls_auto_enable() from anon, public, authenticated;
