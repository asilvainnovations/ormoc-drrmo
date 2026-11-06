-- =============================================================================
-- 1.9.0 (6 Nov 2026) - Forms for protocol and workflow steps (ADR-016).
--
-- * A form template (form_templates) is a small field list taken from the Manual's
--   forms and registers (GOV-F.., HR-F.., EOC-GIS-..). The CDRRMO Head approves it, like a
--   protocol; an approved form's fields are fixed (set it back to draft to revise).
-- * A protocol step may name a form (protocol_steps.form_code). When a run starts,
--   start_protocol() copies the form's fields into the run step (form_schema), so a
--   later revision never changes a run in progress.
-- * A step with a form cannot be marked done until the form is complete:
--   required fields filled, values of the right type, no fields the form does not have.
--   The same check runs on the device (src/domain/forms.ts) and here (app.form_problems).
-- * New categories for the DRRM module: governance, workforce, budget, response
--   clusters and geospatial workflows sit beside the incident protocols.
-- * Forms hold institutional records only. A form never asks for the names of
--   affected persons, evacuees, patients or informants (RA 10173); aggregate counts only.
--
-- Supports MR-06 (protocols), MR-12 (forms and records), MR-15 (records and audit).
-- Safe to run again.
-- =============================================================================

create table if not exists public.form_templates (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[A-Z][A-Z0-9-]{2,30}$'),
  title        text not null check (length(btrim(title)) between 3 and 200),
  purpose      text,
  document_id  uuid references public.moo_documents(id),
  schema       jsonb not null,
  status       text not null default 'draft' check (status in ('draft','approved','retired')),
  rev          integer not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1
);
comment on table public.form_templates is
  'Forms used to accomplish protocol and workflow steps. Institutional records only: never names of affected persons (RA 10173).';
select app.track('public.form_templates');

-- A form's field list: {"fields":[{"key","label","type","required","options","hint"}]}.
create or replace function app.form_schema_problem(p jsonb) returns text
language plpgsql immutable set search_path = pg_temp as $$
declare f jsonb; keys text[] := '{}'; k text; t text;
begin
  if p is null or jsonb_typeof(p -> 'fields') <> 'array' or jsonb_array_length(p -> 'fields') = 0 then
    return 'A form needs at least one field';
  end if;
  for f in select * from jsonb_array_elements(p -> 'fields') loop
    k := f ->> 'key'; t := f ->> 'type';
    if k is null or k !~ '^[a-z][a-z0-9_]{0,40}$' then return format('Field key %s is not valid', coalesce(k, '(blank)')); end if;
    if k = any(keys) then return format('Field %s appears twice', k); end if;
    keys := keys || k;
    if coalesce(btrim(f ->> 'label'), '') = '' then return format('Field %s needs a label', k); end if;
    if t is null or t not in ('text','textarea','number','integer','date','datetime','time','select','multiselect','checkbox') then
      return format('Field %s has an unknown type %s', k, coalesce(t, '(blank)'));
    end if;
    if t in ('select','multiselect') and (jsonb_typeof(f -> 'options') <> 'array' or jsonb_array_length(f -> 'options') = 0) then
      return format('Field %s needs a list of options', k);
    end if;
  end loop;
  return null;
end $$;

-- What is still missing or wrong in a filled form, in the user's words; null when complete.
create or replace function app.form_problems(p_schema jsonb, p_data jsonb) returns text
language plpgsql immutable set search_path = pg_temp as $$
declare f jsonb; v jsonb; k text; t text; missing text[] := '{}'; bad text[] := '{}'; known text[] := '{}'; extra text;
        empty boolean;
begin
  if p_schema is null then return null; end if;
  p_data := coalesce(p_data, '{}'::jsonb);
  if jsonb_typeof(p_data) <> 'object' then return 'The form data is not valid'; end if;
  for f in select * from jsonb_array_elements(p_schema -> 'fields') loop
    k := f ->> 'key'; t := f ->> 'type'; v := p_data -> k; known := known || k;
    empty := v is null or jsonb_typeof(v) = 'null'
             or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '')
             or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0)
             or (t = 'checkbox' and v = 'false'::jsonb);
    if empty then
      if coalesce((f ->> 'required')::boolean, false) then missing := missing || (f ->> 'label'); end if;
      continue;
    end if;
    if (t in ('text','textarea','select','date','datetime','time') and jsonb_typeof(v) <> 'string')
       or (t in ('number','integer') and jsonb_typeof(v) <> 'number')
       or (t = 'integer' and jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric))
       or (t = 'checkbox' and jsonb_typeof(v) <> 'boolean')
       or (t = 'multiselect' and jsonb_typeof(v) <> 'array')
       or (t = 'date' and jsonb_typeof(v) = 'string' and (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$')
       or (t = 'time' and jsonb_typeof(v) = 'string' and (v #>> '{}') !~ '^\d{2}:\d{2}$')
       or (t = 'datetime' and jsonb_typeof(v) = 'string' and (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}')
       or (t = 'select' and jsonb_typeof(v) = 'string' and not (f -> 'options') ? (v #>> '{}'))
       or (t = 'multiselect' and jsonb_typeof(v) = 'array'
           and exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) <> 'string' or not (f -> 'options') ? (x #>> '{}')))
       or (t in ('number','integer') and jsonb_typeof(v) = 'number' and (f ->> 'min') is not null
           and (v #>> '{}')::numeric < (f ->> 'min')::numeric)
       or (t in ('text','textarea') and jsonb_typeof(v) = 'string' and length(v #>> '{}') > coalesce((f ->> 'max_length')::int, 4000)) then
      bad := bad || (f ->> 'label');
    end if;
  end loop;
  select string_agg(x, ', ') into extra from jsonb_object_keys(p_data) x where not (x = any(known));
  if extra is not null then return 'The form has fields it does not define: ' || extra; end if;
  if cardinality(missing) > 0 then return 'Complete the form first: ' || array_to_string(missing, ', '); end if;
  if cardinality(bad) > 0 then return 'Check these entries: ' || array_to_string(bad, ', '); end if;
  return null;
end $$;
grant execute on function app.form_schema_problem(jsonb), app.form_problems(jsonb, jsonb) to authenticated;

-- Like protocols: the Head approves; an approved form is fixed; rev moves when the fields change.
create or replace function app.guard_form_template() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v text := app.form_schema_problem(new.schema);
begin
  if v is not null then raise exception '%', v using errcode = '23514'; end if;
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' and new.schema is distinct from old.schema then new.rev := old.rev + 1;
    elsif tg_op = 'UPDATE' then new.rev := old.rev; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' and not app.has_role('cdrrmo_head') then
      raise exception 'A new form starts as a draft. Only the CDRRMO Head approves it.' using errcode = '42501';
    end if;
    new.rev := 1;
    return new;
  end if;
  if new.status is distinct from old.status and not app.has_role('cdrrmo_head') then
    raise exception 'Only the CDRRMO Head can approve, retire or reopen a form.' using errcode = '42501';
  end if;
  if old.status <> 'draft' and new.status = old.status
     and row(new.code, new.title, new.purpose, new.document_id, new.schema)
         is distinct from row(old.code, old.title, old.purpose, old.document_id, old.schema) then
    raise exception 'This form is %. Its fields are fixed; the CDRRMO Head sets it back to draft to revise it.', old.status
      using errcode = '42501';
  end if;
  new.rev := case when new.schema is distinct from old.schema then old.rev + 1 else old.rev end;
  return new;
end $$;
drop trigger if exists guard_form_template on public.form_templates;
create trigger guard_form_template before insert or update on public.form_templates
  for each row execute function app.guard_form_template();

alter table public.form_templates enable row level security;
drop policy if exists forms_read on public.form_templates;
drop policy if exists forms_insert on public.form_templates;
drop policy if exists forms_update on public.form_templates;
create policy forms_read on public.form_templates for select to authenticated using (app.is_active_user());
create policy forms_insert on public.form_templates for insert to authenticated
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));
create policy forms_update on public.form_templates for update to authenticated
  using (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]))
  with check (app.has_any_role(array['author','cdrrmo_head']::public.app_role[]));
revoke delete, truncate on public.form_templates from authenticated, anon;
grant select, insert, update on public.form_templates to authenticated;
drop trigger if exists aa0_block_oauth_client_writes on public.form_templates;
create trigger aa0_block_oauth_client_writes before insert or update or delete on public.form_templates
  for each row execute function app.block_oauth_client_writes();

-- ---------------------------------------------------------------- steps and runs
alter table public.protocol_steps add column if not exists form_code text;
do $$ begin
  alter table public.protocol_steps add constraint protocol_steps_form_fk
    foreign key (form_code) references public.form_templates(code) on update cascade;
exception when duplicate_object then null; end $$;

alter table public.protocol_run_steps add column if not exists form_code text;
alter table public.protocol_run_steps add column if not exists form_rev integer;
alter table public.protocol_run_steps add column if not exists form_schema jsonb;
alter table public.protocol_run_steps add column if not exists form_data jsonb not null default '{}';
do $$ begin
  alter table public.protocol_run_steps add constraint run_step_form_size_chk check (pg_column_size(form_data) <= 32768);
exception when duplicate_object then null; end $$;
comment on column public.protocol_run_steps.form_schema is 'The form''s fields as they stood when the run started (snapshot).';

-- The snapshot is the server's; a step with a form closes only when the form is complete.
create or replace function app.guard_run_step_form() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v text;
begin
  new.form_code := old.form_code; new.form_rev := old.form_rev; new.form_schema := old.form_schema;
  if new.form_schema is null and new.form_data <> '{}'::jsonb then
    raise exception 'This step has no form' using errcode = '23514';
  end if;
  if new.status = 'done' and new.form_schema is not null then
    v := app.form_problems(new.form_schema, new.form_data);
    if v is not null then raise exception '%', v using errcode = '23514'; end if;
  end if;
  return new;
end $$;
drop trigger if exists aab_guard_run_step_form on public.protocol_run_steps;
create trigger aab_guard_run_step_form before update on public.protocol_run_steps
  for each row execute function app.guard_run_step_form();

-- Same signature as before: the run copies each step's form as it stands now.
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
  if v_t.status = 'draft' and coalesce(p_context_type, 'none') <> 'drill'
     and not app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[]) then
    raise exception 'This protocol is still a draft. Run it as a drill, or ask the EOC Manager or CDRRMO Head to start it.'
      using errcode = '42501';
  end if;
  insert into public.protocol_runs (id, template_id, template_rev, template_status, title, context_type, context_id, started_at)
  values (p_run_id, v_t.id, v_t.template_rev, v_t.status, coalesce(p_title, v_t.title), p_context_type, p_context_id, v_now);
  insert into public.protocol_run_steps (id, run_id, step_id, seq, instruction, is_critical, requires_note, due_at,
                                         form_code, form_rev, form_schema)
  select extensions.uuid_generate_v5(p_run_id, s.seq::text), p_run_id, s.id, s.seq, s.instruction, s.is_critical, s.requires_note,
         case when s.due_offset_minutes is not null then v_now + make_interval(mins => s.due_offset_minutes) end,
         f.code, f.rev, f.schema
  from public.protocol_steps s
  left join public.form_templates f on f.code = s.form_code and f.status <> 'retired'
  where s.template_id = v_t.id order by s.seq;
  return p_run_id;
end $$;

-- ---------------------------------------------------------------- categories
do $$ declare c text; begin
  select conname into c from pg_constraint
   where conrelid = 'public.protocol_templates'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%daily_operations%';
  if c is not null then execute format('alter table public.protocol_templates drop constraint %I', c); end if;
end $$;
alter table public.protocol_templates add constraint protocol_templates_category_check check (category in (
  'daily_operations','warning','eoc','anticipatory_action','council','reporting','recovery',
  'governance','workforce','budget','response_clusters','geospatial'));
comment on column public.protocol_templates.category is
  'Incident protocols: warning, eoc, anticipatory_action, reporting, recovery. Workflows (normal operations): daily_operations, council, governance, workforce, budget, response_clusters, geospatial.';

do $$ begin
  alter publication supabase_realtime add table public.form_templates;
exception when duplicate_object then null; end $$;
