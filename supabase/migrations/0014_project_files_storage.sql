-- =============================================================================
-- Migration 0014 — Project files storage (Supabase Storage)
-- A private bucket for per-project files with folder organisation. Object paths
-- are "<project_id>/<...folders...>/<filename>", so the first path segment is
-- the project id and RLS can authorise via can_access_project().
-- This is an alternative to the Google Drive integration; both can coexist.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

-- Any project member may view files in their project.
create policy "project_files_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_access_project((storage.foldername(name))[1]::uuid)
  );

-- Any project member may upload (and overwrite their own uploads).
create policy "project_files_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and public.can_access_project((storage.foldername(name))[1]::uuid)
    and owner = auth.uid()
  );

create policy "project_files_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_access_project((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'project-files'
    and public.can_access_project((storage.foldername(name))[1]::uuid)
  );

-- Delete: the uploader, a project manager, or a super admin.
create policy "project_files_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-files'
    and public.can_access_project((storage.foldername(name))[1]::uuid)
    and (
      owner = auth.uid()
      or public.manages_project((storage.foldername(name))[1]::uuid)
    )
  );
