-- =============================================================================
-- 0010 OAUTH CLIENT TOKENS ARE READ-ONLY
-- Supabase Auth can act as an OAuth 2.1 / OpenID Connect provider ("Sign in with
-- Ormoc DRRM") for other City systems. A token issued to such an app is a normal user
-- token plus a `client_id` claim, so row-level security would otherwise let the app do
-- everything the person's role can do, including changing legal and financial records.
--
-- Rule: a request made with an OAuth client token may READ what the person may read,
-- and may not insert, update or delete anything. This covers direct table writes, the
-- RPCs (set_eoc_level, start_protocol, load_aa_checklist, which run as definer and so
-- bypass RLS) and files in storage. The app itself signs in directly, never as an OAuth
-- client, so its tokens carry no `client_id` and are unaffected.
--
-- To let a specific app write in future, add its client_id to app.oauth_write_clients
-- (by migration, with a recorded decision) rather than loosening this rule.
-- Safe to run more than once.
-- =============================================================================

create table if not exists app.oauth_write_clients (
  client_id   text primary key,
  note        text not null,
  added_at    timestamptz not null default now()
);
comment on table app.oauth_write_clients is 'OAuth client ids allowed to write. Empty by default: every OAuth app is read-only.';

-- The OAuth client this request's token was issued to, or null for the app's own sessions.
create or replace function app.oauth_client_id() returns text
language sql stable set search_path = pg_temp as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'client_id', '')
$$;

create or replace function app.is_read_only_oauth_client() returns boolean
language sql stable security definer set search_path = pg_temp as $$
  select app.oauth_client_id() is not null
     and not exists (select 1 from app.oauth_write_clients w where w.client_id = app.oauth_client_id())
$$;
grant execute on function app.oauth_client_id(), app.is_read_only_oauth_client() to authenticated, anon;

create or replace function app.block_oauth_client_writes() returns trigger
language plpgsql security definer set search_path = pg_temp as $$
begin
  if app.is_read_only_oauth_client() then
    raise exception 'Apps signed in with Ormoc DRRM can read records but cannot change them'
      using errcode = '42501', hint = 'Make the change in the Ormoc DRRM app itself.';
  end if;
  return coalesce(new, old);
end $$;

-- Every table in public, now and as listed here. Statement-level would miss nothing either,
-- but row-level keeps the error at the first row and works with INSERT ... ON CONFLICT.
do $$ declare t record; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('drop trigger if exists aa0_block_oauth_client_writes on public.%I', t.relname);
    execute format('create trigger aa0_block_oauth_client_writes before insert or update or delete on public.%I
                    for each row execute function app.block_oauth_client_writes()', t.relname);
  end loop;
end $$;

-- Files: evidence and Document Vault buckets. A restrictive policy is ANDed with the existing ones.
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists oauth_clients_no_insert on storage.objects';
    execute 'drop policy if exists oauth_clients_no_update on storage.objects';
    execute 'drop policy if exists oauth_clients_no_delete on storage.objects';
    execute 'create policy oauth_clients_no_insert on storage.objects as restrictive for insert to authenticated with check (not app.is_read_only_oauth_client())';
    execute 'create policy oauth_clients_no_update on storage.objects as restrictive for update to authenticated using (not app.is_read_only_oauth_client())';
    execute 'create policy oauth_clients_no_delete on storage.objects as restrictive for delete to authenticated using (not app.is_read_only_oauth_client())';
  end if;
end $$;

-- A table added by a later migration must call this block again (or add the trigger itself).
comment on function app.block_oauth_client_writes() is
  'Refuses writes from OAuth client tokens (client_id claim) unless the client is in app.oauth_write_clients. Attach to every public table.';
