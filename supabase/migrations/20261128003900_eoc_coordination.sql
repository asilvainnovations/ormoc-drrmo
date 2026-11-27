-- 1.32.0 (28 Nov 2026), EOC coordination on the current activation.
--
-- 1. Repairs to the conversations migration (20261116003300), found when the panel was first mounted:
--    a. app.track() gave conversation_messages the touch_row trigger, which sets new.version; the table has no
--       version column, so every message insert failed ("record new has no field version").
--       Messages are append-only and carry no version: drop that trigger and keep the audit trigger.
--    b. conversation_threads had two touch triggers (app.track's touch_row and touch_conversation_threads). The
--       second saw the version already raised by the first and raised PT409, so every resolve or reopen failed.
--       Keep one.
--    c. The lock cascades set version = version + 1 by hand, which touch_row reads as a stale write (PT409). That
--       would have rolled back a response validation, a cycle archive, an EOC level change or a protocol close
--       whenever the parent had a thread. Let touch_row raise the version.
--    d. Any reader could set a thread to 'locked' by hand. Only the parent's cascade locks a thread now.
-- 2. Message priority (routine, priority, urgent) and kind (message, checkin, checkin_call). Urgent is for the
--    EOC Manager and the CDRRMO Head on EOC threads. A check-in answer is one of four fixed choices.
-- 3. public.eoc_call_checkin(): the EOC Manager or Head calls every EOC member on the current activation to check
--    in. An authority action: online only (RPC), never queued, at most one call every five minutes. It reaches
--    MODE users only; it is not a public warning (RA 10639 cell broadcast and the City warning system stay separate).
-- Safe to run again.

-- --------------------------------------------------------------------------- 1. repairs
drop trigger if exists touch_row on public.conversation_messages;
drop trigger if exists touch_conversation_threads on public.conversation_threads;

create or replace function app.lock_conversation_on_response() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'validated' and (old.status is distinct from 'validated') then
    update public.conversation_threads set status = 'locked'
     where parent_kind = 'response' and parent_id = new.id and status in ('open','resolved');
  end if;
  return new;
end $$;

create or replace function app.lock_conversation_on_cycle() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'archived' and (old.status is distinct from 'archived') then
    update public.conversation_threads set status = 'locked'
     where parent_kind = 'assessment_cycle' and parent_id = new.id and status in ('open','resolved');
  end if;
  return new;
end $$;

create or replace function app.lock_conversation_on_activation() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.ended_at is not null and old.ended_at is null then
    update public.conversation_threads set status = 'locked'
     where parent_kind = 'eoc_activation' and parent_id = new.id and status in ('open','resolved');
  end if;
  return new;
end $$;

create or replace function app.lock_conversation_on_protocol_run() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status in ('completed','aborted') and (old.status is distinct from new.status) then
    update public.conversation_threads set status = 'locked'
     where parent_kind = 'protocol_run' and parent_id = new.id and status in ('open','resolved');
  end if;
  return new;
end $$;

-- Only a parent's cascade (security definer, so not the 'authenticated' role) locks a thread.
create or replace function app.guard_conversation_thread_lock() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.status = 'locked' and old.status is distinct from 'locked' then
    raise exception 'A conversation locks only with its record (validated, archived, ended or closed).' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_conversation_thread_lock on public.conversation_threads;
create trigger guard_conversation_thread_lock
  before update on public.conversation_threads
  for each row execute function app.guard_conversation_thread_lock();

-- --------------------------------------------------------------------------- 2. priority and kind
alter table public.conversation_messages
  add column if not exists priority text not null default 'routine',
  add column if not exists kind text not null default 'message';

alter table public.conversation_messages drop constraint if exists conversation_messages_priority_check;
alter table public.conversation_messages add constraint conversation_messages_priority_check
  check (priority in ('routine', 'priority', 'urgent'));
alter table public.conversation_messages drop constraint if exists conversation_messages_kind_check;
alter table public.conversation_messages add constraint conversation_messages_kind_check
  check (kind in ('message', 'checkin', 'checkin_call'));

comment on column public.conversation_messages.priority is
  'routine | priority | urgent. Urgent: EOC Manager or CDRRMO Head on EOC threads.';
comment on column public.conversation_messages.kind is
  'message | checkin (fixed answer to a call) | checkin_call (only through eoc_call_checkin, online).';

create index if not exists conversation_messages_thread_kind_idx
  on public.conversation_messages (thread_id, kind, created_at);

-- The fixed check-in answers. src/domain/coordination.ts (CHECKIN_ANSWERS) mirrors this list.
create or replace function app.checkin_answers() returns text[]
language sql immutable set search_path = public, pg_temp as $$
  select array['At the EOC', 'On the way', 'In the field', 'Not available']::text[];
$$;

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

  if new.kind = 'checkin_call' then
    raise exception 'A check-in call is made with "Call a check-in" on the Coordination screen. It needs a connection.' using errcode = '42501';
  end if;
  if new.kind = 'checkin' then
    if v_kind is distinct from 'eoc_activation' then
      raise exception 'Check-ins are answered on the EOC activation only.' using errcode = '42501';
    end if;
    if not (new.body = any (app.checkin_answers())) then
      raise exception 'Choose one of the check-in answers: %.', array_to_string(app.checkin_answers(), ', ') using errcode = '42501';
    end if;
    new.priority := 'routine';
  end if;
  if new.priority = 'urgent' then
    if v_kind not in ('eoc_activation', 'protocol_run') then
      raise exception 'Urgent messages are for EOC coordination. Use Priority here.' using errcode = '42501';
    end if;
    if not app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[]) then
      raise exception 'Only the EOC Manager or the CDRRMO Head can post an urgent message. Use Priority.' using errcode = '42501';
    end if;
  end if;

  new.author_id := auth.uid();
  new.created_at := now();
  return new;
end $$;

-- --------------------------------------------------------------------------- 3. check-in call
create or replace function public.eoc_call_checkin(p_activation_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_thread uuid;
  v_status text;
  v_last   timestamptz;
  v_note   text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not app.is_active_user() or not app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[]) then
    raise exception 'Only the EOC Manager or the CDRRMO Head can call a check-in.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.eoc_activations where id = p_activation_id and ended_at is null) then
    raise exception 'A check-in is called only while this activation is open. Open the current level on the EOC board.' using errcode = '42501';
  end if;
  if v_note is not null and length(v_note) > 300 then
    raise exception 'Keep the note to 300 characters.' using errcode = '22023';
  end if;

  select id, status into v_thread, v_status
    from public.conversation_threads
   where parent_kind = 'eoc_activation' and parent_id = p_activation_id and status in ('open', 'resolved')
   for update;

  if v_thread is null then
    insert into public.conversation_threads (parent_kind, parent_id, title, status, created_by)
    values ('eoc_activation', p_activation_id, 'EOC coordination', 'open', auth.uid())
    returning id into v_thread;
  elsif v_status = 'resolved' then
    update public.conversation_threads set status = 'open', resolved_by = null, resolved_at = null where id = v_thread;
  end if;

  select max(created_at) into v_last from public.conversation_messages
   where thread_id = v_thread and kind = 'checkin_call';
  if v_last is not null and v_last > now() - interval '5 minutes' then
    raise exception 'A check-in was called at %. Wait five minutes before calling another.',
      to_char(v_last at time zone 'Asia/Manila', 'HH24:MI') using errcode = '55000';
  end if;

  insert into public.conversation_messages (thread_id, body, priority, kind, author_id, created_at)
  values (v_thread,
          'Check-in: every EOC member, answer with where you are.' || coalesce(' ' || v_note, ''),
          'urgent', 'checkin_call', auth.uid(), now());

  insert into public.logbook_entries (activation_id, category, entry, author)
  values (p_activation_id, 'decision', 'Check-in called for all EOC members' || coalesce('. Note: ' || v_note, '') || '.', auth.uid());

  return v_thread;
end $$;

revoke all on function public.eoc_call_checkin(uuid, text) from public, anon;
grant execute on function public.eoc_call_checkin(uuid, text) to authenticated;

-- --------------------------------------------------------------------------- 4. live updates and read-only apps
-- The Coordination screen refreshes when a message or a check-in arrives.
do $$ declare t text; begin
  foreach t in array array['conversation_threads','conversation_messages'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object or undefined_object then null; end;
  end loop;
end $$;

-- ADR-010: apps signed in with MODE read but never write. 31 tables made after 1.10 (conversations, DDRiVE, EOC
-- capability, RACI, manual governance, training runs, cut-offs) were created without the block. Attach it to every
-- public table that lacks it, as 20261031001000 did. The trigger acts only on OAuth app tokens.
do $$ declare t record; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p')
             and not exists (select 1 from pg_trigger g where g.tgrelid = c.oid and g.tgname = 'aa0_block_oauth_client_writes') loop
    execute format('create trigger aa0_block_oauth_client_writes before insert or update or delete on public.%I
                    for each row execute function app.block_oauth_client_writes()', t.relname);
  end loop;
end $$;
