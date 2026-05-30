-- =============================================================================
-- Migration 0022 — Self-service profile fields: WhatsApp, website, CV
-- Adds employee-editable contact/portfolio fields and an uploaded CV stored in
-- a private "cvs" bucket. Object path is "<user_id>/<filename>", so the first
-- path segment is the owner and storage RLS authorizes per user (managers who
-- manages_user() can read it).
-- =============================================================================

alter table public.profiles
  add column if not exists whatsapp    text,
  add column if not exists website_url text,
  add column if not exists cv_url      text;

insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do nothing;

create policy "cvs_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.manages_user(((storage.foldername(name))[1])::uuid)
    )
  );

create policy "cvs_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and owner = auth.uid()
  );

create policy "cvs_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "cvs_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
