-- =============================================================================
-- Migration 0031 — Platform admin + profile-protection fix
--
-- 1. is_platform_admin on profiles: marks the people who run the SaaS itself
--    (see every organization, change plans, suspend orgs). Granted only via
--    the service role — org super admins cannot self-escalate.
-- 2. protect_profile_admin_fields(): the trigger fired for service-role writes
--    too (auth.uid() is null there → is_super_admin() false), silently
--    reverting role/is_active/seniority changes made by server actions through
--    the admin client. Service-role writes are now trusted; app-side writes
--    additionally can never change is_platform_admin.
-- 3. The founding organization's super admins become platform admins.
-- =============================================================================

alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server actions / platform tooling use the service role and are trusted.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Platform-admin status is never changeable from the app side — not even by
  -- an org super admin (that would be escalation to platform level).
  new.is_platform_admin := old.is_platform_admin;

  if public.is_super_admin() then
    return new;
  end if;
  new.role            := old.role;
  new.is_active       := old.is_active;
  new.weekly_hours    := old.weekly_hours;
  new.employment_type := old.employment_type;
  new.hire_date       := old.hire_date;
  new.seniority       := old.seniority;
  return new;
end;
$$;

update public.profiles
  set is_platform_admin = true
  where org_id = '00000000-0000-0000-0000-000000000001'
    and role = 'super_admin';
