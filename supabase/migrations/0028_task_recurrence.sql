-- =============================================================================
-- Migration 0028 — Recurring tasks
-- Optional recurrence on a task (daily / weekly / monthly). When a recurring
-- task transitions to "done", the app spawns the next occurrence (same title,
-- description, assignee, priority; due date advanced by the interval) and
-- moves the recurrence flag to the new instance so the chain never forks.
-- NOTE: `create type` and use of the value can't share a transaction, so this
-- is split (enum first, then the column) when applied programmatically.
-- =============================================================================

create type public.task_recurrence as enum ('daily', 'weekly', 'monthly');

alter table public.tasks
  add column if not exists recurrence public.task_recurrence;
