-- =============================================================================
-- Migration 0013 — Extend audit logging to all employee-activity tables
-- The generic record_audit_log() trigger (from 0007) already captures who /
-- when / what-changed. Here we attach it to the remaining tables that
-- represent things employees do, so the audit log is a complete activity feed.
-- =============================================================================

create trigger audit_task_comments
  after insert or update or delete on public.task_comments
  for each row execute function public.record_audit_log();

create trigger audit_task_attachments
  after insert or update or delete on public.task_attachments
  for each row execute function public.record_audit_log();

create trigger audit_task_dependencies
  after insert or update or delete on public.task_dependencies
  for each row execute function public.record_audit_log();

create trigger audit_time_logs
  after insert or update or delete on public.time_logs
  for each row execute function public.record_audit_log();

create trigger audit_peer_reviews
  after insert or update or delete on public.peer_reviews
  for each row execute function public.record_audit_log();

create trigger audit_standup_responses
  after insert or update or delete on public.standup_responses
  for each row execute function public.record_audit_log();

create trigger audit_project_members
  after insert or update or delete on public.project_members
  for each row execute function public.record_audit_log();

create trigger audit_department_members
  after insert or update or delete on public.department_members
  for each row execute function public.record_audit_log();

create trigger audit_kpi_logs
  after insert or update or delete on public.kpi_logs
  for each row execute function public.record_audit_log();
