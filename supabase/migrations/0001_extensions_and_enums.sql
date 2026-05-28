-- =============================================================================
-- Migration 0001 — Extensions & Enum types
-- Staff Management System (Everest Ads)
-- =============================================================================

-- gen_random_uuid() and crypto helpers.
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------

-- Global application role (drives the permission matrix). Note: this column is
-- an addition to the roadmap schema — the permission matrix (Super Admin /
-- Team Leader / Team Member) requires a global role on each profile.
create type app_role as enum ('super_admin', 'team_leader', 'team_member');

create type employment_type as enum ('full_time', 'part_time', 'freelance');

create type department_member_role as enum ('manager', 'member');

create type project_status as enum (
  'planning', 'active', 'on_hold', 'completed', 'cancelled'
);

create type priority_level as enum ('low', 'medium', 'high', 'urgent');

create type project_member_role as enum ('lead', 'member', 'observer');

create type task_status as enum (
  'todo', 'in_progress', 'review', 'done', 'cancelled'
);

create type kpi_period as enum ('weekly', 'monthly');

create type evaluation_period_type as enum ('weekly', 'monthly');

create type evaluation_status as enum ('draft', 'finalized', 'sent');

create type standup_mood as enum ('great', 'good', 'okay', 'stressed', 'blocked');
