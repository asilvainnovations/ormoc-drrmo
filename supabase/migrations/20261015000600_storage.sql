-- =============================================================================
-- 0006 STORAGE: private evidence bucket
-- Object path: <cycle_id>/<response_id>/<file name>
-- Files are served only through short-lived signed URLs.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 15728640,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy evidence_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and app.is_active_user());

create policy evidence_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and exists (
      select 1 from public.responses r
      where r.id::text = (storage.foldername(name))[2]
        and r.cycle_id::text = (storage.foldername(name))[1]
        and app.can_answer(r.indicator_id)));

create policy evidence_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and app.has_role('admin'));
