-- =============================================================================
-- Migration 0008 — RLS helper functions
-- SECURITY DEFINER functions used by policies. They run as the table owner and
-- therefore bypass RLS, which avoids infinite recursion when a policy needs to
-- look up the caller's role or memberships.
-- =============================================================================

-- Current caller's global application role.
create or replace function public.current_app_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_app_role() = 'super_admin', false);
$$;

create or replace function public.is_team_leader()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_app_role() = 'team_leader', false);
$$;

-- True if the caller manages the given department (super admin, the named
-- department manager, or a department_members row with role = 'manager').
create or replace function public.manages_department(dept uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin()
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

-- True if the caller belongs to the given department (or manages it).
create or replace function public.is_department_member(dept uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.manages_department(dept)
    or exists (
      select 1 from public.department_members dm
      where dm.department_id = dept and dm.user_id = auth.uid()
    );
$$;

-- True if the caller can access the given project: super admin, manager of the
-- project's department, or an explicit project member.
create or replace function public.can_access_project(p uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
      select 1 from public.projects pr
      where pr.id = p and public.manages_department(pr.department_id)
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = p and pm.user_id = auth.uid()
    );
$$;

-- True if the caller manages the given project's department (create/delete
-- tasks, manage members, etc.).
create or replace function public.manages_project(p uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p and public.manages_department(pr.department_id)
  );
$$;

-- True if the caller can access the project that owns the given task.
create or replace function public.can_access_task(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tasks tk
    where tk.id = t and public.can_access_project(tk.project_id)
  );
$$;

-- True if the caller may oversee the given user's performance data: super
-- admin, or a team leader who manages a department the target belongs to.
-- Used by evaluation / KPI / standup read policies (the permission matrix:
-- "رؤية التقييمات" — super admin all, team leader own department, member self).
create or replace function public.manages_user(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.department_members dm
      where dm.user_id = target
        and public.manages_department(dm.department_id)
    );
$$;
