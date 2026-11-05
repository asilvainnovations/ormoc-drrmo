-- =============================================================================
-- 1.8.0: Error reports from the app (audit 31 Oct 2026, #19).
--
-- When a screen crashes, the app shows a recovery screen and sends a short report here, to
-- the City's own project: no third-party service, no new address in the CSP.
--
-- What a report holds: the app version, the screen path (no query string), the error
-- message and stack, and the browser name. No form contents, record data, names or
-- coordinates (RA 10173). Who and when are the server's.
--
-- Rules:
--   * Any signed-in account may send a report (also one waiting for approval, since
--     crashes there matter too). Reports cannot be edited.
--   * Only the administrator reads them, and deletes old ones (keep 90 days; DEPLOY §11).
--   * At most 30 reports per account per hour; more are dropped quietly by the app and
--     refused by the server.
--   * OAuth apps cannot write here (ADR-010).
--
-- Supports MR-10 (digital continuity) and MR-15 (records). Safe to run again.
-- =============================================================================

create table if not exists public.client_errors (
  id           uuid primary key default gen_random_uuid(),
  received_at  timestamptz not null default now(),
  user_id      uuid references public.profiles(id) on delete set null,
  app_version  text not null check (length(app_version) <= 20),
  route        text check (length(route) <= 200),
  kind         text not null check (kind in ('render', 'error', 'unhandled_rejection', 'chunk_load')),
  message      text not null check (length(message) <= 500),
  stack        text check (length(stack) <= 4000),
  user_agent   text check (length(user_agent) <= 300)
);
create index if not exists client_errors_received_idx on public.client_errors(received_at desc);
create index if not exists client_errors_user_idx on public.client_errors(user_id, received_at desc);
comment on table public.client_errors is 'Crash and error reports sent by the app. No form contents or personal data beyond the reporting account. Admin only; keep 90 days.';

create or replace function app.stamp_client_error() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.user_id := auth.uid();
  new.received_at := now();
  if new.user_id is null then
    raise exception 'Sign in to send an error report' using errcode = '42501';
  end if;
  if (select count(*) from public.client_errors where user_id = new.user_id and received_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many error reports from this account in the last hour' using errcode = '54000';
  end if;
  -- The path only: a query string or fragment could carry a record id or search text.
  new.route := nullif(split_part(split_part(coalesce(new.route, ''), '?', 1), '#', 1), '');
  return new;
end $$;
drop trigger if exists stamp_client_error on public.client_errors;
create trigger stamp_client_error before insert on public.client_errors
  for each row execute function app.stamp_client_error();

alter table public.client_errors enable row level security;
drop policy if exists client_errors_insert on public.client_errors;
drop policy if exists client_errors_read   on public.client_errors;
drop policy if exists client_errors_delete on public.client_errors;
create policy client_errors_insert on public.client_errors for insert to authenticated with check (auth.uid() is not null);
create policy client_errors_read   on public.client_errors for select to authenticated using (app.has_role('admin'));
create policy client_errors_delete on public.client_errors for delete to authenticated using (app.has_role('admin'));

revoke all on public.client_errors from anon, authenticated;
grant insert on public.client_errors to authenticated;
grant select, delete on public.client_errors to authenticated;   -- RLS: admin only

drop trigger if exists aa0_block_oauth_client_writes on public.client_errors;
create trigger aa0_block_oauth_client_writes before insert or update or delete on public.client_errors
  for each row execute function app.block_oauth_client_writes();
