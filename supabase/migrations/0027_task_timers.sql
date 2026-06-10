-- =============================================================================
-- Migration 0027 — Live task timers
-- One running timer per user (user_id is the PK). Starting a timer on another
-- task stops & logs the current one first (handled in the server action).
-- Ephemeral state: stopping the timer turns it into a time_logs row, so no
-- audit trigger here.
-- =============================================================================

create table public.task_timers (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  task_id    uuid not null references public.tasks (id) on delete cascade,
  started_at timestamptz not null default now()
);

alter table public.task_timers enable row level security;

-- Strictly own-row: nobody needs to see anyone else's running timer.
create policy task_timers_select on public.task_timers
  for select to authenticated
  using (user_id = auth.uid());

create policy task_timers_insert on public.task_timers
  for insert to authenticated
  with check (user_id = auth.uid());

create policy task_timers_update on public.task_timers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy task_timers_delete on public.task_timers
  for delete to authenticated
  using (user_id = auth.uid());
