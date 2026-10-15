-- =============================================================================
-- 0003 MOO / SOP LIBRARY, TRACEABILITY, CDRRMO PROTOCOLS
-- Manual chapters, SOPs, forms and annexes with versioned content and an
-- approval workflow. Protocols are SOPs that can be run step by step.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;  -- already true on Supabase

create table public.moo_documents (
  id                  uuid primary key default gen_random_uuid(),
  manual              text not null check (manual in ('MOO','EOC')),
  kind                text not null check (kind in ('chapter','sop','form','annex')),
  code                text not null unique,        -- 'MOO Ch.4', 'EOC Ch.2', 'SOP-EOC-01', 'FORM-SITREP'
  title               text not null,
  parent_id           uuid references public.moo_documents(id),
  summary             text,
  status              text not null default 'draft' check (status in ('draft','in_review','approved','superseded')),
  owner_office_id     uuid references public.offices(id),
  current_version_id  uuid,
  sort                smallint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1
);

create table public.moo_versions (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.moo_documents(id) on delete cascade,
  label          text not null,                    -- 'v0.1 draft', 'v1.0'
  body_md        text not null default '',
  change_note    text,
  status         text not null default 'draft' check (status in ('draft','in_review','approved','rejected')),
  author         uuid default auth.uid() references public.profiles(id),
  reviewed_by    uuid references public.profiles(id),
  review_note    text,
  approved_by    uuid references public.profiles(id),
  approved_at    timestamptz,
  effective_date date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  version        integer not null default 1,
  unique (document_id, label)
);
alter table public.moo_documents
  add constraint moo_documents_current_version_fk foreign key (current_version_id) references public.moo_versions(id);

-- Which indicators a document answers (gap → chapter routing, MR-14).
create table public.moo_document_indicators (
  document_id   uuid not null references public.moo_documents(id) on delete cascade,
  indicator_id  text not null references public.iat_indicators(id) on delete cascade,
  primary key (document_id, indicator_id)
);

select app.track('public.moo_documents');
select app.track('public.moo_versions');

-- Approved versions are immutable; approval promotes the version to current.
create or replace function app.guard_moo_version() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and old.status = 'approved' then
    raise exception 'Approved versions cannot be edited. Create a new version.' using errcode = '42501';
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    if not app.has_any_role(array['cdrrmo_head']::public.app_role[]) then
      raise exception 'Only the CDRRMO Head can approve a manual section' using errcode = '42501';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  if new.status = 'in_review' and tg_op = 'UPDATE' and old.status = 'draft' then
    null; -- authors submit for review
  end if;
  return new;
end $$;
create trigger guard_moo_version before insert or update on public.moo_versions
  for each row execute function app.guard_moo_version();

create or replace function app.promote_moo_version() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    update public.moo_documents d
       set current_version_id = new.id, status = 'approved', version = d.version
     where d.id = new.document_id;
  end if;
  return null;
end $$;
create trigger promote_moo_version after insert or update on public.moo_versions
  for each row execute function app.promote_moo_version();

-- Traceability explorer: indicator → master requirements → documents → open actions.
create view public.v_traceability with (security_invoker = true) as
select
  i.id as indicator_id, i.domain, d.part, i.statement, i.type, i.weight, i.moo_chapter, i.tags,
  coalesce((select array_agg(ir.mr_id order by ir.mr_id) from public.indicator_requirements ir where ir.indicator_id = i.id), '{}') as requirements,
  coalesce((select jsonb_agg(jsonb_build_object('id', md.id, 'code', md.code, 'title', md.title, 'status', md.status) order by md.code)
            from public.moo_document_indicators mdi join public.moo_documents md on md.id = mdi.document_id
            where mdi.indicator_id = i.id), '[]'::jsonb) as documents
from public.iat_indicators i join public.iat_domains d on d.code = i.domain
where i.is_active;

-- ----------------------------------------------------------- protocols ------
create table public.protocol_templates (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,               -- 'PR-DUTY-HANDOVER'
  title         text not null,
  purpose       text,
  trigger_text  text,                               -- when to run it
  document_id   uuid references public.moo_documents(id),
  owner_role    public.app_role not null default 'duty_officer',
  category      text not null check (category in ('daily_operations','warning','eoc','anticipatory_action','council','reporting','recovery')),
  status        text not null default 'draft' check (status in ('draft','approved','retired')),
  template_rev  integer not null default 1,         -- bumps when steps change
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1
);

create table public.protocol_steps (
  id                  uuid primary key default gen_random_uuid(),
  template_id         uuid not null references public.protocol_templates(id) on delete cascade,
  seq                 smallint not null,
  instruction         text not null,
  role_hint           text,
  due_offset_minutes  integer,                      -- target time from protocol start
  is_critical         boolean not null default false,
  requires_note       boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1,
  unique (template_id, seq)
);

create table public.protocol_runs (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.protocol_templates(id),
  template_rev    integer not null,
  title           text not null,
  context_type    text check (context_type in ('activation','incident','declaration','pdra','drill','none')),
  context_id      uuid,
  status          text not null default 'running' check (status in ('running','completed','aborted')),
  started_by      uuid default auth.uid() references public.profiles(id),
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  abort_reason    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1,
  check (status <> 'aborted' or coalesce(length(trim(abort_reason)),0) > 0)
);

create table public.protocol_run_steps (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.protocol_runs(id) on delete cascade,
  step_id      uuid not null references public.protocol_steps(id),
  seq          smallint not null,
  instruction  text not null,                       -- snapshot: the step as it read when the run began
  is_critical  boolean not null default false,
  requires_note boolean not null default false,
  due_at       timestamptz,
  status       text not null default 'pending' check (status in ('pending','done','skipped','not_applicable')),
  done_by      uuid references public.profiles(id),
  done_at      timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1,
  unique (run_id, seq),
  check (status = 'pending' or not requires_note or coalesce(length(trim(note)),0) > 0),
  check (status <> 'skipped' or coalesce(length(trim(note)),0) > 0)
);

select app.track('public.protocol_templates');
select app.track('public.protocol_steps');
select app.track('public.protocol_runs');
select app.track('public.protocol_run_steps');

create or replace function app.bump_template_rev() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.protocol_templates t set template_rev = t.template_rev + 1, version = t.version
   where t.id = coalesce(new.template_id, old.template_id);
  return null;
end $$;
create trigger bump_template_rev after insert or update or delete on public.protocol_steps
  for each row execute function app.bump_template_rev();

-- Start a run: snapshots the steps so later template edits never rewrite history.
create or replace function public.start_protocol(p_template uuid, p_title text default null,
  p_context_type text default 'none', p_context_id uuid default null, p_run_id uuid default gen_random_uuid())
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_t public.protocol_templates; v_now timestamptz := now();
begin
  if not app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]) then
    raise exception 'Your role cannot start protocols' using errcode = '42501';
  end if;
  if exists (select 1 from public.protocol_runs where id = p_run_id) then
    return p_run_id;  -- idempotent: a replayed offline request is a no-op
  end if;
  select * into v_t from public.protocol_templates where id = p_template;
  if v_t.id is null then raise exception 'Protocol not found' using errcode = 'P0002'; end if;
  if v_t.status = 'retired' then raise exception 'This protocol is retired' using errcode = '22023'; end if;
  insert into public.protocol_runs (id, template_id, template_rev, title, context_type, context_id, started_at)
  values (p_run_id, v_t.id, v_t.template_rev, coalesce(p_title, v_t.title), p_context_type, p_context_id, v_now);
  -- Step ids are UUIDv5(namespace = run id, name = seq) so an offline client can
  -- compute the same ids before the run reaches the server.
  insert into public.protocol_run_steps (id, run_id, step_id, seq, instruction, is_critical, requires_note, due_at)
  select extensions.uuid_generate_v5(p_run_id, s.seq::text), p_run_id, s.id, s.seq, s.instruction, s.is_critical, s.requires_note,
         case when s.due_offset_minutes is not null then v_now + make_interval(mins => s.due_offset_minutes) end
  from public.protocol_steps s where s.template_id = v_t.id order by s.seq;
  return p_run_id;
end $$;
grant execute on function public.start_protocol(uuid, text, text, uuid, uuid) to authenticated;

-- A run can only be completed when every critical step is done.
create or replace function app.guard_run_completion() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_open int;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    select count(*) into v_open from public.protocol_run_steps
     where run_id = new.id and (status = 'pending' or (is_critical and status <> 'done'));
    if v_open > 0 then
      raise exception '% step(s) still open. Critical steps must be done before completing.', v_open using errcode = '23514';
    end if;
    new.completed_at := now();
  end if;
  return new;
end $$;
create trigger guard_run_completion before update on public.protocol_runs
  for each row execute function app.guard_run_completion();

create or replace function app.stamp_run_step() returns trigger
language plpgsql as $$
begin
  if new.status <> 'pending' and old.status = 'pending' then
    new.done_by := coalesce(new.done_by, auth.uid());
    new.done_at := coalesce(new.done_at, now());
  elsif new.status = 'pending' then
    new.done_by := null; new.done_at := null;
  end if;
  return new;
end $$;
create trigger stamp_run_step before update on public.protocol_run_steps
  for each row execute function app.stamp_run_step();

-- ----------------------------------------------------------- RLS ------------
alter table public.moo_documents enable row level security;
alter table public.moo_versions enable row level security;
alter table public.moo_document_indicators enable row level security;
alter table public.protocol_templates enable row level security;
alter table public.protocol_steps enable row level security;
alter table public.protocol_runs enable row level security;
alter table public.protocol_run_steps enable row level security;

create policy moo_docs_read on public.moo_documents for select to authenticated using (app.is_active_user());
create policy moo_docs_write on public.moo_documents for all to authenticated
  using (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));

-- Drafts are visible to authors and reviewers; everyone sees approved text.
create policy moo_versions_read on public.moo_versions for select to authenticated
  using (app.is_active_user() and (status = 'approved' or app.has_any_role(array['author','cdrrmo_head','validator']::public.app_role[])));
create policy moo_versions_write on public.moo_versions for all to authenticated
  using (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));

create policy moo_links_read on public.moo_document_indicators for select to authenticated using (app.is_active_user());
create policy moo_links_write on public.moo_document_indicators for all to authenticated
  using (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));

create policy ptpl_read on public.protocol_templates for select to authenticated using (app.is_active_user());
create policy ptpl_write on public.protocol_templates for all to authenticated
  using (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));
create policy psteps_read on public.protocol_steps for select to authenticated using (app.is_active_user());
create policy psteps_write on public.protocol_steps for all to authenticated
  using (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));

create policy pruns_read on public.protocol_runs for select to authenticated using (app.is_active_user());
create policy pruns_update on public.protocol_runs for update to authenticated
  using (app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]));
create policy prsteps_read on public.protocol_run_steps for select to authenticated using (app.is_active_user());
create policy prsteps_update on public.protocol_run_steps for update to authenticated
  using (app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['duty_officer','eoc_staff','eoc_manager','cdrrmo_head']::public.app_role[]));
-- runs and run steps are created only through start_protocol(); no insert/delete policies.

grant select, insert, update, delete on public.moo_documents, public.moo_versions, public.moo_document_indicators,
  public.protocol_templates, public.protocol_steps to authenticated;
grant select, update on public.protocol_runs, public.protocol_run_steps to authenticated;
grant select on public.v_traceability to authenticated;
