-- =============================================================================
-- Migration 0010 — Storage bucket for task attachments + Realtime publication
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Private storage bucket. Files are addressed by the path
-- `<task_id>/<uuid>-<filename>`, which lets the RLS policies below parse the
-- task id out of the path and reuse the task-access helpers from 0008.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Storage RLS — only authenticated users with access to the parent task may
-- read / upload, and only the uploader (or super admins) may delete.
-- -----------------------------------------------------------------------------
create policy "task_attachments_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-attachments'
    and public.can_access_task((storage.foldername(name))[1]::uuid)
  );

create policy "task_attachments_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-attachments'
    and public.can_access_task((storage.foldername(name))[1]::uuid)
    and owner = auth.uid()
  );

create policy "task_attachments_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-attachments'
    and (owner = auth.uid() or public.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- Realtime — add the tables that Phase 4 streams (tasks, comments, attachments)
-- to the Supabase publication so clients can subscribe via the realtime API.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_comments;
alter publication supabase_realtime add table public.task_attachments;
