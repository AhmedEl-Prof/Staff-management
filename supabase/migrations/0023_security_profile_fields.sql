-- =============================================================================
-- Migration 0023 — Security fix: profile privilege-escalation + harden trigger
-- The profiles_update_self policy (0009) lets a user update their OWN row,
-- which included admin-managed columns — most critically `role`. A user could
-- therefore call the REST API directly and set their own role to 'super_admin'.
-- This trigger pins those columns to their previous values for non-admins, so a
-- self-update can only change personal fields. Super admins (and the
-- service-role admin client, which bypasses RLS) are unaffected.
--
-- Also pins set_updated_at()'s search_path (advisor 0011).
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;
  new.role            := old.role;
  new.is_active       := old.is_active;
  new.weekly_hours    := old.weekly_hours;
  new.employment_type := old.employment_type;
  new.hire_date       := old.hire_date;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_fields on public.profiles;
create trigger profiles_protect_admin_fields
  before update on public.profiles
  for each row execute function public.protect_profile_admin_fields();
