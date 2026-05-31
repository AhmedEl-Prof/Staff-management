-- =============================================================================
-- Migration 0025 — Employee seniority classification
-- An admin-set level on each profile: senior / junior / trainee (nullable).
-- Added to the protected-fields trigger so a non-admin self-update can't change
-- their own classification.
-- NOTE: `create type` and use of the value can't share a transaction, so this
-- is split (enum first, then the trigger update) when applied programmatically.
-- =============================================================================

create type public.seniority_level as enum ('senior', 'junior', 'trainee');

alter table public.profiles
  add column if not exists seniority public.seniority_level;

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
  new.seniority       := old.seniority;
  return new;
end;
$$;
