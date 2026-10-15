-- =============================================================================
-- 0008 DOCUMENT VAULT
-- One register of reference documents (laws, IRRs, issuances, City ordinances and EOs,
-- plans, reports, records) and the documents gathered for Document Review (DR), each
-- linked to the indicators it can evidence.
--
-- Who: assessors, validators, administrators and CDRRMO staff (Head, EOC Manager, EOC
-- staff, duty officers). Anyone in those roles may add documents; only the person who
-- added a document, the CDRRMO Head or an admin may change it. Nothing is deleted:
-- a replaced document is marked superseded, so audit and evidence trails stay intact.
-- Files: private bucket "vault", path <document id>/<file name>, 25 MB, signed URLs only.
-- =============================================================================

create or replace function app.can_use_vault() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_any_role(array['assessor','validator','cdrrmo_head','eoc_manager','eoc_staff','duty_officer']::public.app_role[])
$$;
grant execute on function app.can_use_vault() to authenticated;

create table public.vault_documents (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (length(btrim(title)) between 3 and 300),
  category       text not null check (category in ('law','irr','issuance','framework','city_issuance','plan','report','record','other')),
  ref_key        text,                         -- reference catalogue key, e.g. 'RA 10121' (src/data/references.ts)
  doc_number     text,                         -- e.g. 'EO No. 12, s. 2026', 'Ordinance No. 2019-045'
  issuer         text,                         -- e.g. 'Office of the City Mayor', 'NDRRMC'
  doc_date       date,
  summary        text check (summary is null or length(summary) <= 2000),
  indicator_ids  text[] not null default '{}', -- IAT indicators this document can evidence
  storage_path   text,                         -- vault bucket object, when a file is attached
  file_name      text,
  mime_type      text,
  size_bytes     integer check (size_bytes is null or size_bytes between 1 and 26214400),
  url            text check (url is null or url ~ '^https://'),
  location       text,                         -- where the paper original is kept
  status         text not null default 'current' check (status in ('current','superseded','draft')),
  superseded_by  uuid references public.vault_documents(id),
  uploaded_by    uuid default auth.uid() references public.profiles(id),
  version        integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (storage_path is null or storage_path like id::text || '/%')
);
comment on table public.vault_documents is 'Document Vault: reference and Document Review documents. Institutional records only; no personal data of affected persons.';
create index vault_documents_indicators_idx on public.vault_documents using gin (indicator_ids);
create index vault_documents_ref_idx on public.vault_documents (ref_key);
select app.track('public.vault_documents');

-- Indicator links must name real indicators; the uploader is the signed-in user and
-- cannot be changed; a file, once attached, stays attached to the same object.
create or replace function app.guard_vault_document() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_bad text;
begin
  select string_agg(x, ', ') into v_bad
    from unnest(new.indicator_ids) x where not exists (select 1 from public.iat_indicators i where i.id = x);
  if v_bad is not null then
    raise exception 'Unknown indicator: %', v_bad using errcode = '23503', hint = 'Use indicator IDs such as A4.1 or B7.1.';
  end if;
  new.indicator_ids := array(select distinct x from unnest(new.indicator_ids) x order by x);
  if tg_op = 'INSERT' then
    new.uploaded_by := auth.uid();
  else
    new.uploaded_by := old.uploaded_by;
    if old.storage_path is not null and new.storage_path is distinct from old.storage_path then
      raise exception 'The attached file cannot be replaced' using errcode = '42501',
        hint = 'Add the new file as a new document and mark this one superseded.';
    end if;
  end if;
  return new;
end $$;
create trigger guard_vault_document before insert or update on public.vault_documents
  for each row execute function app.guard_vault_document();

alter table public.vault_documents enable row level security;
create policy vault_read on public.vault_documents for select to authenticated using (app.can_use_vault());
create policy vault_insert on public.vault_documents for insert to authenticated with check (app.can_use_vault());
create policy vault_update on public.vault_documents for update to authenticated
  using (app.can_use_vault() and (uploaded_by = auth.uid() or app.has_any_role(array['cdrrmo_head']::public.app_role[])))
  with check (app.can_use_vault());
grant select, insert, update on public.vault_documents to authenticated;   -- no delete: supersede instead

-- Private bucket for vault files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vault', 'vault', false, 26214400,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic',
              'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy vault_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'vault' and app.can_use_vault());

-- A file may only be uploaded into the folder of a vault document the user may edit.
create policy vault_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vault'
    and exists (
      select 1 from public.vault_documents d
      where d.id::text = (storage.foldername(name))[1]
        and app.can_use_vault()
        and (d.uploaded_by = auth.uid() or app.has_any_role(array['cdrrmo_head']::public.app_role[]))));

alter publication supabase_realtime add table public.vault_documents;
