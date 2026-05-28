-- =============================================================================
-- Migration 0007 — Functions & triggers
-- updated_at maintenance, new-user provisioning, automatic audit logging
-- =============================================================================

-- -----------------------------------------------------------------------------
-- set_updated_at — keep updated_at fresh on UPDATE
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger drive_connections_set_updated_at
  before update on public.drive_connections
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- handle_new_user — create a profile + default preferences for each new auth
-- user. Accounts are provisioned by an admin (no public signup), so the role
-- and other details are passed via auth user metadata where available.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, arabic_name, role, employment_type)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'arabic_name',
    coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'team_member'),
    coalesce((new.raw_user_meta_data ->> 'employment_type')::employment_type, 'full_time')
  )
  on conflict (id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- record_audit_log — generic trigger that snapshots row changes into
-- audit_logs. Attach to any table that needs change tracking.
-- -----------------------------------------------------------------------------
create or replace function public.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id uuid;
  v_changes   jsonb;
begin
  if (tg_op = 'DELETE') then
    v_entity_id := old.id;
    v_changes := jsonb_build_object('old', to_jsonb(old));
  elsif (tg_op = 'UPDATE') then
    v_entity_id := new.id;
    v_changes := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else -- INSERT
    v_entity_id := new.id;
    v_changes := jsonb_build_object('new', to_jsonb(new));
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, changes)
  values (auth.uid(), tg_op, tg_table_name, v_entity_id, v_changes);

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

-- Attach audit logging to the business-critical tables.
create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.record_audit_log();

create trigger audit_departments
  after insert or update or delete on public.departments
  for each row execute function public.record_audit_log();

create trigger audit_projects
  after insert or update or delete on public.projects
  for each row execute function public.record_audit_log();

create trigger audit_tasks
  after insert or update or delete on public.tasks
  for each row execute function public.record_audit_log();

create trigger audit_evaluations
  after insert or update or delete on public.evaluations
  for each row execute function public.record_audit_log();
