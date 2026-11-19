-- 1.27.0: Chapter corrections by reviewers, with a permanent log.
--
-- Before the 1-4 December 2026 validation workshop, validators, assessors, authors, lead-office focals and the CDRRMO
-- Head correct chapter text directly: add, delete or revise text in a section, and add or replace a figure. Each
-- correction:
--   * goes into a working DRAFT version of the chapter (an approved version is never changed; when the newest version
--     is not a draft, a new draft is made from the version the reviewer was reading);
--   * is checked against the text the reviewer saw: the section's "before" text must appear exactly once in the draft,
--     so two reviewers cannot overwrite each other without noticing;
--   * is written to manual_corrections, which nobody can edit or delete: who, when (server time), which document,
--     version and section, what kind of change, the section text before and after, the reason, an optional figure and
--     an optional link to a review item of the Validation Tracker.
-- Publication is unchanged: only the CDRRMO Head approves a version (guard_moo_version, promote_moo_version).
-- Figures go to the private bucket manual-figures, under <document_id>/. Safe to run again.

create table if not exists public.manual_corrections (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.moo_documents(id),
  version_id      uuid not null references public.moo_versions(id),
  section_title   text not null,
  action          text not null check (action in ('add','delete','revise','figure')),
  before_md       text not null,
  after_md        text not null,
  reason          text not null check (length(trim(reason)) between 5 and 1000),
  figure_path     text check (figure_path is null or figure_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  review_item_id  uuid references public.manual_review_items(id),
  corrected_by    uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1,
  check (length(section_title) <= 300 and before_md <> after_md)
);
create index if not exists manual_corrections_document_idx on public.manual_corrections (document_id, created_at desc);
select app.track('public.manual_corrections');

comment on table public.manual_corrections is
  'Append-only log of chapter corrections (1.27.0). Rows are written only by apply_manual_correction(); never updated or deleted.';

-- Rows come only from the function below; the log cannot be edited or deleted by anyone through the API.
create or replace function app.guard_manual_correction() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'The corrections log cannot be changed. Make a new correction instead.' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') then
    raise exception 'Corrections are saved through the correction form' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_manual_correction on public.manual_corrections;
create trigger guard_manual_correction before insert or update or delete on public.manual_corrections
  for each row execute function app.guard_manual_correction();

alter table public.manual_corrections enable row level security;
drop policy if exists manual_corrections_read on public.manual_corrections;
create policy manual_corrections_read on public.manual_corrections for select to authenticated using (app.is_active_user());
revoke insert, update, delete, truncate on public.manual_corrections from authenticated, anon;
grant select on public.manual_corrections to authenticated;

create or replace function app.can_correct_manual() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_any_role(array['validator','assessor','author','lead_office_focal','cdrrmo_head']::public.app_role[]);
$$;

-- One correction, applied and logged in one transaction. Returns the draft version and the log row.
create or replace function public.apply_manual_correction(
  p_document_id uuid, p_base_version_id uuid, p_section_title text, p_action text,
  p_before text, p_after text, p_reason text, p_figure_path text default null, p_review_item_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_doc public.moo_documents;
  v_base public.moo_versions;
  v_draft public.moo_versions;
  v_hits integer;
  v_label text;
  v_id uuid;
begin
  if auth.uid() is null or not app.is_active_user() or not app.can_correct_manual() then
    raise exception 'Only validators, assessors, authors, lead-office focals and the CDRRMO Head can correct the Manual' using errcode = '42501';
  end if;
  if p_action not in ('add','delete','revise','figure') then
    raise exception 'Choose add, delete, revise or figure' using errcode = '22023';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'Give a reason for the correction (at least a few words)' using errcode = '23514';
  end if;
  if coalesce(p_before, '') = '' or p_before = coalesce(p_after, '') then
    raise exception 'Nothing to change: the corrected text is the same as before' using errcode = '22023';
  end if;
  if p_figure_path is not null and split_part(p_figure_path, '/', 1) <> p_document_id::text then
    raise exception 'The figure belongs to another document' using errcode = '22023';
  end if;

  select * into v_doc from public.moo_documents where id = p_document_id for update;
  if not found then raise exception 'Document not found' using errcode = 'P0002'; end if;
  select * into v_base from public.moo_versions where id = p_base_version_id and document_id = p_document_id;
  if not found then raise exception 'That version does not belong to this document' using errcode = '22023'; end if;

  -- The working draft: the newest version if it is a draft, otherwise a new draft made from the version being read.
  select * into v_draft from public.moo_versions where document_id = p_document_id
   order by created_at desc, label desc limit 1;
  if v_draft.status is distinct from 'draft' then
    v_label := 'validation draft ' || to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD HH24:MI:SS');
    insert into public.moo_versions (document_id, label, body_md, change_note, status)
    values (p_document_id, v_label, v_base.body_md, 'Corrections from validation, started from ' || v_base.label, 'draft')
    returning * into v_draft;
  end if;

  v_hits := (length(v_draft.body_md) - length(replace(v_draft.body_md, p_before, ''))) / length(p_before);
  if v_hits = 0 then
    raise exception 'This section has changed since you opened it. Reload the chapter and make the correction again.' using errcode = 'PT409';
  elsif v_hits > 1 then
    raise exception 'This section text appears more than once in the chapter. Correct a smaller, unique part.' using errcode = '22023';
  end if;

  update public.moo_versions
     set body_md = replace(body_md, p_before, coalesce(p_after, ''))
   where id = v_draft.id;

  insert into public.manual_corrections (document_id, version_id, section_title, action, before_md, after_md, reason,
                                         figure_path, review_item_id, corrected_by)
  values (p_document_id, v_draft.id, left(coalesce(nullif(trim(p_section_title), ''), '(untitled section)'), 300), p_action,
          p_before, coalesce(p_after, ''), trim(p_reason), p_figure_path, p_review_item_id, auth.uid())
  returning id into v_id;

  return jsonb_build_object('version_id', v_draft.id, 'version_label', v_draft.label, 'correction_id', v_id);
end $$;
revoke all on function public.apply_manual_correction(uuid, uuid, text, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.apply_manual_correction(uuid, uuid, text, text, text, text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------- figures (private bucket)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manual-figures', 'manual-figures', false, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists manual_figures_read on storage.objects;
drop policy if exists manual_figures_insert on storage.objects;
drop policy if exists manual_figures_delete on storage.objects;
create policy manual_figures_read on storage.objects for select to authenticated
  using (bucket_id = 'manual-figures' and app.is_active_user());
create policy manual_figures_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'manual-figures' and app.can_correct_manual()
              and exists (select 1 from public.moo_documents d where d.id::text = (storage.foldername(name))[1]));
create policy manual_figures_delete on storage.objects for delete to authenticated
  using (bucket_id = 'manual-figures' and app.has_role('admin'));
