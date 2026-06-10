-- =============================================================================
-- Migration 0034 — Fix the platform-admin seed
-- 0031's seed UPDATE was silently reverted by protect_profile_admin_fields():
-- migrations run over a direct database connection, which carries no JWT, so
-- auth.role() returned null — neither 'service_role' nor a bypass. Direct
-- connections are inherently privileged (only the platform owner has them),
-- so treat a null auth.role() as trusted, then re-run the seed.
-- =============================================================================

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role writes (server actions) and direct DB connections
  -- (migrations / owner tooling) are trusted.
  if auth.role() = 'service_role' or auth.role() is null then
    return new;
  end if;

  -- Platform-admin status is never changeable from the app side.
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
