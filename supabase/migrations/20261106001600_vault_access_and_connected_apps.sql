-- =============================================================================
-- 1.9.0 (6 Nov 2026) - Document Vault access levels; City approval of connected apps.
--
-- 1. Vault access levels (ADR-015)
--    * Every Vault document is 'standard' (everyone who may use the Vault) or
--      'restricted' (only the roles listed in allowed_roles; the CDRRMO Head always).
--      Personnel information (the office chart) and internal staff papers are restricted.
--    * The same rule covers the files in the private "vault" bucket.
--    * Only the CDRRMO Head changes a document's access level after it is added.
-- 2. Connected apps (ADR-010 amended by ADR-018)
--    * An app that signs people in with "Sign in with MODE" must also be approved by the
--      City in Settings -> Connected apps. Until it is, its tokens read nothing: the role
--      checks (has_role, has_any_role, is_active_user) return false for a token whose
--      client_id is not approved. Apps stay read-only either way (ADR-010).
--
-- Supports MR-12 (document control), MR-14 (data privacy), MR-15 (records and audit).
-- Safe to run again.
-- =============================================================================

-- ---------------------------------------------------------------- 1. Vault access
alter table public.vault_documents add column if not exists access_class text not null default 'standard';
alter table public.vault_documents add column if not exists allowed_roles public.app_role[] not null default '{}';
do $$ begin
  alter table public.vault_documents add constraint vault_access_class_chk
    check (access_class in ('standard', 'restricted'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.vault_documents add constraint vault_restricted_roles_chk
    check (access_class = 'standard' or cardinality(allowed_roles) > 0);
exception when duplicate_object then null; end $$;
comment on column public.vault_documents.access_class is
  'standard: everyone who may use the Vault. restricted: allowed_roles and the CDRRMO Head only (personnel information, internal staff papers).';

create or replace function app.can_read_vault_doc(p_class text, p_roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.can_use_vault()
     and (p_class = 'standard' or app.has_role('cdrrmo_head') or app.has_any_role(coalesce(p_roles, '{}')))
$$;
grant execute on function app.can_read_vault_doc(text, public.app_role[]) to authenticated;

-- The access level is set when the document is added; afterwards only the CDRRMO Head changes it.
create or replace function app.guard_vault_access() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  new.allowed_roles := array(select distinct r from unnest(new.allowed_roles) r order by r);
  if tg_op = 'UPDATE' and (new.access_class, new.allowed_roles) is distinct from (old.access_class, old.allowed_roles)
     and not app.has_role('cdrrmo_head') then
    raise exception 'Only the CDRRMO Head can change who may open this document' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_vault_access on public.vault_documents;
create trigger guard_vault_access before insert or update on public.vault_documents
  for each row execute function app.guard_vault_access();

drop policy if exists vault_read on public.vault_documents;
create policy vault_read on public.vault_documents for select to authenticated
  using (app.can_read_vault_doc(access_class, allowed_roles));
drop policy if exists vault_update on public.vault_documents;
create policy vault_update on public.vault_documents for update to authenticated
  using (app.can_read_vault_doc(access_class, allowed_roles)
         and (uploaded_by = auth.uid() or app.has_any_role(array['cdrrmo_head']::public.app_role[])))
  with check (app.can_use_vault());

drop policy if exists vault_objects_read on storage.objects;
create policy vault_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'vault' and exists (
    select 1 from public.vault_documents d
    where d.id::text = (storage.foldername(name))[1] and app.can_read_vault_doc(d.access_class, d.allowed_roles)));

-- ---------------------------------------------------------------- 2. Connected apps
create table if not exists public.connected_apps (
  id               uuid primary key default gen_random_uuid(),
  client_id        text not null unique check (length(btrim(client_id)) between 8 and 200),
  name             text not null check (length(btrim(name)) between 2 and 120),
  purpose          text not null check (length(btrim(purpose)) between 10 and 1000),
  owner_office_id  uuid references public.offices(id),
  contact_position text check (contact_position is null or length(contact_position) <= 160),  -- a position, not a name
  redirect_uri     text not null check (redirect_uri ~ '^(https://|http://localhost)'),
  data_scope       text not null check (length(btrim(data_scope)) between 5 and 1000),     -- what it will read, in plain words
  status           text not null default 'requested' check (status in ('requested','approved','suspended','retired')),
  reviewed_by      uuid references public.profiles(id),
  reviewed_at      timestamptz,
  review_due       date,
  created_by       uuid default auth.uid() references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  version          integer not null default 1
);
comment on table public.connected_apps is
  'City register of apps allowed to use "Sign in with MODE". An app''s tokens read nothing until it is approved here (ADR-018).';
select app.track('public.connected_apps');

-- True for the app's own sessions and for tokens issued to an approved connected app.
create or replace function app.oauth_client_allowed() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.oauth_client_id() is null
      or exists (select 1 from public.connected_apps c where c.client_id = app.oauth_client_id() and c.status = 'approved')
$$;
grant execute on function app.oauth_client_allowed() to authenticated, anon;

create or replace function app.has_role(r public.app_role) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.oauth_client_allowed() and exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.is_active
    where ur.user_id = auth.uid() and (ur.role = r or ur.role = 'admin')
  )
$$;
create or replace function app.has_any_role(rs public.app_role[]) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.oauth_client_allowed() and exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.is_active
    where ur.user_id = auth.uid() and (ur.role = any(rs) or ur.role = 'admin')
  )
$$;
create or replace function app.is_active_user() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.oauth_client_allowed() and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
      and exists (select 1 from public.user_roles ur where ur.user_id = p.id)
  )
$$;

-- Who reviewed and when is the server's; only an administrator or the CDRRMO Head changes the status.
create or replace function app.guard_connected_app() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'requested' then
      raise exception 'A new app starts as a request. Approve it after reviewing what it will read.' using errcode = '42501';
    end if;
    new.reviewed_by := null; new.reviewed_at := null; new.created_by := auth.uid();
    return new;
  end if;
  new.client_id := old.client_id; new.created_by := old.created_by;
  if new.status is distinct from old.status then
    if not app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]) then
      raise exception 'Only an administrator or the CDRRMO Head can approve, suspend or retire an app' using errcode = '42501';
    end if;
    if old.status = 'retired' then
      raise exception 'A retired app cannot come back. Register it again as a new request.' using errcode = '42501';
    end if;
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
    if new.status = 'approved' and new.review_due is null then new.review_due := (now() + interval '1 year')::date; end if;
  else
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end $$;
drop trigger if exists guard_connected_app on public.connected_apps;
create trigger guard_connected_app before insert or update on public.connected_apps
  for each row execute function app.guard_connected_app();

alter table public.connected_apps enable row level security;
drop policy if exists capps_read on public.connected_apps;
drop policy if exists capps_insert on public.connected_apps;
drop policy if exists capps_update on public.connected_apps;
create policy capps_read on public.connected_apps for select to authenticated
  using (app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]));
create policy capps_insert on public.connected_apps for insert to authenticated
  with check (app.has_role('admin'));
create policy capps_update on public.connected_apps for update to authenticated
  using (app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['admin','cdrrmo_head']::public.app_role[]));
revoke delete, truncate on public.connected_apps from authenticated, anon;
grant select, insert, update on public.connected_apps to authenticated;

-- The consent screen asks whether an app may be offered at all (no other detail is shown).
create or replace function public.connected_app_status(p_client_id text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select status from public.connected_apps where client_id = p_client_id), 'unregistered')
$$;
revoke execute on function public.connected_app_status(text) from anon;
grant execute on function public.connected_app_status(text) to authenticated;

drop trigger if exists aa0_block_oauth_client_writes on public.connected_apps;
create trigger aa0_block_oauth_client_writes before insert or update or delete on public.connected_apps
  for each row execute function app.block_oauth_client_writes();
