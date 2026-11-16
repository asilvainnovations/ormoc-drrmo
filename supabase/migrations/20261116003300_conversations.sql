-- 1.22.0 (16 Nov 2026), ADR-040: object-scoped conversations for assessment and EOC coordination.
-- Slice 1 focuses on assessment (response + assessment_cycle). EOC parents are in the schema
-- so Slice 2 does not need another migration for tables.
--
-- One open/resolved thread per parent. Messages are append-only. Resolve is online-only
-- (authority). Threads lock when the parent locks (validated response, archived cycle,
-- completed/aborted protocol run, ended activation).
-- Safe to run again.

-- --------------------------------------------------------------------------- tables
create table if not exists public.conversation_threads (
  id            uuid primary key default gen_random_uuid(),
  parent_kind   text not null check (parent_kind in ('response','assessment_cycle','eoc_activation','protocol_run')),
  parent_id     uuid not null,
  title         text check (title is null or length(trim(title)) between 1 and 200),
  status        text not null default 'open' check (status in ('open','resolved','locked')),
  resolved_by   uuid references public.profiles(id),
  resolved_at   timestamptz,
  created_by    uuid default auth.uid() references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1
);
comment on table public.conversation_threads is
  'Object-scoped discussion thread (ADR-040). At most one open or resolved thread per parent. Not an SOP.';
select app.track('public.conversation_threads');

-- One non-locked thread per parent (open or resolved). Locked threads may accumulate history.
create unique index if not exists conversation_threads_one_open_per_parent
  on public.conversation_threads (parent_kind, parent_id)
  where status in ('open', 'resolved');

create index if not exists conversation_threads_parent_idx
  on public.conversation_threads (parent_kind, parent_id);

create table if not exists public.conversation_messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references public.conversation_threads(id),
  body          text not null check (length(trim(body)) between 1 and 2000),
  in_reply_to   uuid references public.conversation_messages(id),
  author_id     uuid default auth.uid() references public.profiles(id),
  created_at    timestamptz not null default now()
);
comment on table public.conversation_messages is
  'Append-only messages on a conversation thread (ADR-040). Never edited or deleted. Privacy reminder in UI.';
select app.track('public.conversation_messages');

create index if not exists conversation_messages_thread_idx
  on public.conversation_messages (thread_id, created_at);

-- --------------------------------------------------------------------------- helpers
create or replace function app.conversation_parent_exists(p_kind text, p_id uuid)
returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select case p_kind
    when 'response' then exists (select 1 from public.responses where id = p_id)
    when 'assessment_cycle' then exists (select 1 from public.assessment_cycles where id = p_id)
    when 'eoc_activation' then exists (select 1 from public.eoc_activations where id = p_id)
    when 'protocol_run' then exists (select 1 from public.protocol_runs where id = p_id)
    else false
  end;
$$;

create or replace function app.conversation_can_read(p_kind text)
returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select case
    when p_kind in ('response','assessment_cycle') then
      app.has_any_role(array['assessor','validator','cdrrmo_head','admin','lead_office_focal']::public.app_role[])
    when p_kind in ('eoc_activation','protocol_run') then
      app.has_any_role(array['eoc_manager','eoc_staff','duty_officer','cdrrmo_head','admin']::public.app_role[])
    else false
  end;
$$;

create or replace function app.conversation_can_post(p_kind text)
returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select app.conversation_can_read(p_kind);
$$;

create or replace function app.conversation_can_resolve(p_kind text)
returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select case
    when p_kind in ('response','assessment_cycle') then
      app.has_any_role(array['validator','cdrrmo_head','admin']::public.app_role[])
    when p_kind in ('eoc_activation','protocol_run') then
      app.has_any_role(array['eoc_manager','cdrrmo_head','admin']::public.app_role[])
    else false
  end;
$$;

-- --------------------------------------------------------------------------- RLS
alter table public.conversation_threads enable row level security;
drop policy if exists conversation_threads_select on public.conversation_threads;
drop policy if exists conversation_threads_insert on public.conversation_threads;
drop policy if exists conversation_threads_update on public.conversation_threads;
drop policy if exists conversation_threads_delete on public.conversation_threads;

create policy conversation_threads_select on public.conversation_threads
  for select to authenticated
  using (app.is_active_user() and app.conversation_can_read(parent_kind));

create policy conversation_threads_insert on public.conversation_threads
  for insert to authenticated
  with check (
    app.is_active_user()
    and app.conversation_can_post(parent_kind)
    and app.conversation_parent_exists(parent_kind, parent_id)
    and status = 'open'
  );

create policy conversation_threads_update on public.conversation_threads
  for update to authenticated
  using (app.is_active_user() and app.conversation_can_read(parent_kind))
  with check (app.is_active_user() and app.conversation_can_read(parent_kind));

-- No delete: threads are corrected by status, never removed.
create policy conversation_threads_delete on public.conversation_threads
  for delete to authenticated
  using (false);

grant select, insert, update on public.conversation_threads to authenticated;
revoke delete on public.conversation_threads from authenticated;

alter table public.conversation_messages enable row level security;
drop policy if exists conversation_messages_select on public.conversation_messages;
drop policy if exists conversation_messages_insert on public.conversation_messages;
drop policy if exists conversation_messages_update on public.conversation_messages;
drop policy if exists conversation_messages_delete on public.conversation_messages;

create policy conversation_messages_select on public.conversation_messages
  for select to authenticated
  using (
    app.is_active_user()
    and exists (
      select 1 from public.conversation_threads t
      where t.id = thread_id and app.conversation_can_read(t.parent_kind)
    )
  );

create policy conversation_messages_insert on public.conversation_messages
  for insert to authenticated
  with check (
    app.is_active_user()
    and exists (
      select 1 from public.conversation_threads t
      where t.id = thread_id
        and t.status = 'open'
        and app.conversation_can_post(t.parent_kind)
    )
  );

create policy conversation_messages_update on public.conversation_messages
  for update to authenticated using (false) with check (false);

create policy conversation_messages_delete on public.conversation_messages
  for delete to authenticated using (false);

grant select, insert on public.conversation_messages to authenticated;
revoke update, delete on public.conversation_messages from authenticated;

-- --------------------------------------------------------------------------- guards
create or replace function app.guard_conversation_thread() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'A conversation thread is not deleted. Resolve or lock it.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if not app.conversation_parent_exists(new.parent_kind, new.parent_id) then
      raise exception 'The parent record for this conversation does not exist.' using errcode = '42501';
    end if;
    if new.status is distinct from 'open' then
      raise exception 'A new conversation starts open.' using errcode = '42501';
    end if;
    new.created_by := auth.uid();
    return new;
  end if;

  -- UPDATE
  if old.status = 'locked' and new.status is distinct from 'locked' then
    if not app.has_any_role(array['cdrrmo_head','admin']::public.app_role[]) then
      raise exception 'Only the CDRRMO Head or an administrator can reopen a locked conversation.' using errcode = '42501';
    end if;
  end if;

  if old.status = 'locked' and new.status = 'locked' then
    -- no field changes on a locked thread except version/timestamps from touch
    if new.parent_kind is distinct from old.parent_kind
       or new.parent_id is distinct from old.parent_id
       or new.title is distinct from old.title then
      raise exception 'A locked conversation cannot be edited.' using errcode = '42501';
    end if;
  end if;

  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    if not app.conversation_can_resolve(old.parent_kind) then
      raise exception 'You do not have authority to resolve this conversation.' using errcode = '42501';
    end if;
    new.resolved_by := auth.uid();
    new.resolved_at := now();
  end if;

  if new.status = 'open' and old.status = 'resolved' then
    if not app.conversation_can_resolve(old.parent_kind) then
      raise exception 'You do not have authority to reopen this conversation.' using errcode = '42501';
    end if;
    new.resolved_by := null;
    new.resolved_at := null;
  end if;

  -- parent_kind / parent_id never change
  if new.parent_kind is distinct from old.parent_kind or new.parent_id is distinct from old.parent_id then
    raise exception 'A conversation stays on the same parent record.' using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists guard_conversation_thread on public.conversation_threads;
create trigger guard_conversation_thread
  before insert or update or delete on public.conversation_threads
  for each row execute function app.guard_conversation_thread();

drop trigger if exists touch_conversation_threads on public.conversation_threads;
create trigger touch_conversation_threads
  before update on public.conversation_threads
  for each row execute function app.touch_row();

create or replace function app.guard_conversation_message() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_status text;
  v_kind   text;
begin
  if current_user not in ('authenticated', 'anon') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'Conversation messages are append-only. Post a new message to correct one.' using errcode = '42501';
  end if;

  select t.status, t.parent_kind into v_status, v_kind
  from public.conversation_threads t where t.id = new.thread_id;

  if v_status is null then
    raise exception 'The conversation thread does not exist.' using errcode = '42501';
  end if;
  if v_status is distinct from 'open' then
    raise exception 'This conversation is % and does not accept new messages.', v_status using errcode = '42501';
  end if;
  if not app.conversation_can_post(v_kind) then
    raise exception 'You do not have permission to post on this conversation.' using errcode = '42501';
  end if;

  new.author_id := auth.uid();
  return new;
end $$;

drop trigger if exists guard_conversation_message on public.conversation_messages;
create trigger guard_conversation_message
  before insert or update or delete on public.conversation_messages
  for each row execute function app.guard_conversation_message();

-- --------------------------------------------------------------------------- lock cascades from parent records
create or replace function app.lock_conversation_on_response() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'validated' and (old.status is distinct from 'validated') then
    update public.conversation_threads
       set status = 'locked', updated_at = now(), version = version + 1
     where parent_kind = 'response' and parent_id = new.id and status in ('open','resolved');
  end if;
  return new;
end $$;

drop trigger if exists lock_conversation_on_response on public.responses;
create trigger lock_conversation_on_response
  after update of status on public.responses
  for each row execute function app.lock_conversation_on_response();

create or replace function app.lock_conversation_on_cycle() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'archived' and (old.status is distinct from 'archived') then
    update public.conversation_threads
       set status = 'locked', updated_at = now(), version = version + 1
     where parent_kind = 'assessment_cycle' and parent_id = new.id and status in ('open','resolved');
  end if;
  return new;
end $$;

drop trigger if exists lock_conversation_on_cycle on public.assessment_cycles;
create trigger lock_conversation_on_cycle
  after update of status on public.assessment_cycles
  for each row execute function app.lock_conversation_on_cycle();

create or replace function app.lock_conversation_on_activation() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.ended_at is not null and old.ended_at is null then
    update public.conversation_threads
       set status = 'locked', updated_at = now(), version = version + 1
     where parent_kind = 'eoc_activation' and parent_id = new.id and status in ('open','resolved');
  end if;
  return new;
end $$;

drop trigger if exists lock_conversation_on_activation on public.eoc_activations;
create trigger lock_conversation_on_activation
  after update of ended_at on public.eoc_activations
  for each row execute function app.lock_conversation_on_activation();

create or replace function app.lock_conversation_on_protocol_run() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status in ('completed','aborted') and (old.status is distinct from new.status) then
    update public.conversation_threads
       set status = 'locked', updated_at = now(), version = version + 1
     where parent_kind = 'protocol_run' and parent_id = new.id and status in ('open','resolved');
  end if;
  return new;
end $$;

drop trigger if exists lock_conversation_on_protocol_run on public.protocol_runs;
create trigger lock_conversation_on_protocol_run
  after update of status on public.protocol_runs
  for each row execute function app.lock_conversation_on_protocol_run();
