-- =============================================================================
-- 1.9.0 (6 Nov 2026) - EOC structure, contingency-plan clustering, barangay clusters (ADR-017).
--
-- MOO Ch.1 sec. 6.3 (Figures 1.3-1.4, Table 1.4) and Ch.2 sec. 10.1-10.2 (Annex 2-D):
-- 1. Response clusters: the City's clusters, aligned to the national cluster approach,
--    each with a lead office. Edited by the CDRRMO Head.
-- 2. Contingency plans and their activation sets: each plan lists the clusters and EOC
--    modules it switches on ('on'), seats only for its lead ('lead') or keeps on standby.
-- 3. Activating a plan (activate_contingency_plan) is an authority action: the EOC
--    Manager or CDRRMO Head, online, with the EOC at Blue or Red. It copies the plan's
--    set onto the open activation (activation_clusters) and writes a logbook decision.
--    A Blue -> Red change carries the plan and clusters forward.
-- 4. EOC positions and the designation register: a primary and two alternates per key
--    position. Proposals are offline-capable drafts; approval is the CDRRMO Head's,
--    online. v_eoc_depth shows which positions are not yet covered two deep (B4.2).
-- 5. Barangay clusters (the coordinator pilot): six clusters, a pilot flag, the cluster
--    of each barangay and hazard tags from one register (the CDRA), with their source.
--
-- Supports MR-07 (EOC operations), MR-08 (response clusters), MR-09 (staffing),
-- MR-11 (barangay interface). Indicators B1.4, B4.1, B4.2, B4.4, B6.1, A8.5, B5.2, A7.3.
-- Safe to run again.
-- =============================================================================

-- ---------------------------------------------------------------- 1. response clusters
-- Re-run safety (1.9.0 fix, 6 Nov 2026): app.track() from the core migration creates its triggers without
-- "if not exists", so running this file a second time stopped with 42710 "trigger touch_row ... already exists".
-- This redefinition drops and re-creates them, so app.track() is safe to call again. Same in 1600-1900.
create or replace function app.track(tbl regclass, audited boolean default true) returns void
language plpgsql as $$
begin
  execute format('drop trigger if exists touch_row on %s', tbl);
  execute format('create trigger touch_row before insert or update on %s for each row execute function app.touch_row()', tbl);
  if audited then
    execute format('drop trigger if exists audit_row on %s', tbl);
    execute format('create trigger audit_row after insert or update or delete on %s for each row execute function app.audit()', tbl);
  end if;
end $$;

create table if not exists public.response_clusters (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
  name              text not null,
  national_lead     text,
  lead_office_id    uuid references public.offices(id),
  mandate           text,
  sort              smallint not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  version           integer not null default 1
);
select app.track('public.response_clusters');

-- ---------------------------------------------------------------- 2. contingency plans
create table if not exists public.contingency_plans (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique check (code ~ '^CP-[A-Z0-9-]{2,30}$'),
  title               text not null,
  hazard_code         text references public.hazards(code),
  scenario            text,
  warning_time        text,
  activation_triggers text,
  status              text not null default 'to_prepare' check (status in ('to_prepare','draft','adopted','expired','retired')),
  adopted_ref         text,                    -- e.g. 'CDRRMC Res. No. 2-A, s. 2021'
  adopted_on          date,
  valid_until         date,
  vault_document_id   uuid references public.vault_documents(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1,
  check (status <> 'adopted' or adopted_ref is not null)
);
select app.track('public.contingency_plans');

create table if not exists public.cp_activation_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.contingency_plans(id) on delete cascade,
  item_kind   text not null check (item_kind in ('cluster','module')),
  item_code   text not null,
  state       text not null check (state in ('on','lead','standby')),
  min_level   public.eoc_level not null default 'red',
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (plan_id, item_kind, item_code),
  check (item_kind <> 'module' or item_code in ('operations','planning','pdra_aa_desk','logistics','finance_admin',
                                                 'cluster_desks','barangay_liaison','building_assessment_mdm'))
);
select app.track('public.cp_activation_items');

-- A cluster item must name a real cluster.
create or replace function app.guard_cp_item() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.item_kind = 'cluster' and not exists (select 1 from public.response_clusters c where c.code = new.item_code) then
    raise exception 'Unknown response cluster %', new.item_code using errcode = '23503';
  end if;
  return new;
end $$;
drop trigger if exists guard_cp_item on public.cp_activation_items;
create trigger guard_cp_item before insert or update on public.cp_activation_items
  for each row execute function app.guard_cp_item();

-- ---------------------------------------------------------------- 3. activation
alter table public.eoc_activations add column if not exists plan_id uuid references public.contingency_plans(id);

create table if not exists public.activation_clusters (
  id             uuid primary key default gen_random_uuid(),
  activation_id  uuid not null references public.eoc_activations(id),
  item_kind      text not null check (item_kind in ('cluster','module')),
  item_code      text not null,
  state          text not null check (state in ('on','lead','standby','stood_down')),
  changed_by     uuid references public.profiles(id),
  changed_at     timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  version        integer not null default 1,
  unique (activation_id, item_kind, item_code)
);
select app.track('public.activation_clusters');

create or replace function public.activate_contingency_plan(p_plan uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_a public.eoc_activations; v_p public.contingency_plans;
begin
  if not app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[]) then
    raise exception 'Only the EOC Manager or CDRRMO Head can activate a contingency plan' using errcode = '42501';
  end if;
  select * into v_a from public.eoc_activations where ended_at is null for update;
  if v_a.id is null then
    raise exception 'Raise the EOC to Blue or Red first; a plan is activated on an open activation' using errcode = '22023';
  end if;
  select * into v_p from public.contingency_plans where id = p_plan;
  if v_p.id is null then raise exception 'Contingency plan not found' using errcode = 'P0002'; end if;
  if v_p.status = 'retired' then raise exception 'This contingency plan is retired' using errcode = '22023'; end if;
  update public.eoc_activations set plan_id = v_p.id, version = version where id = v_a.id;
  insert into public.activation_clusters (activation_id, item_kind, item_code, state, changed_by)
  select v_a.id, i.item_kind, i.item_code,
         case when i.state = 'standby' or v_a.level < i.min_level then 'standby' else i.state end, auth.uid()
    from public.cp_activation_items i where i.plan_id = v_p.id
  on conflict (activation_id, item_kind, item_code) do update set state = excluded.state, changed_by = excluded.changed_by,
     changed_at = now(), version = public.activation_clusters.version;
  insert into public.logbook_entries (activation_id, category, entry, author)
  values (v_a.id, 'decision', format('Contingency plan activated: %s (%s). %s cluster(s) and %s EOC module(s) set from the plan%s.',
          v_p.title, v_p.code,
          (select count(*) from public.cp_activation_items where plan_id = v_p.id and item_kind = 'cluster'),
          (select count(*) from public.cp_activation_items where plan_id = v_p.id and item_kind = 'module'),
          case when v_p.status <> 'adopted' then '. The plan is not yet adopted; its activation set is a draft' else '' end),
          auth.uid());
  return v_a.id;
end $$;
grant execute on function public.activate_contingency_plan(uuid) to authenticated;

-- A cluster's state during an activation is changed by the EOC Manager or CDRRMO Head; who and when are the server's.
create or replace function app.guard_activation_cluster() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if not app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[]) then
    raise exception 'Only the EOC Manager or CDRRMO Head can change which clusters are activated' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    new.activation_id := old.activation_id; new.item_kind := old.item_kind; new.item_code := old.item_code;
    if exists (select 1 from public.eoc_activations a where a.id = old.activation_id and a.ended_at is not null) then
      raise exception 'This activation has ended; its cluster record is fixed' using errcode = '42501';
    end if;
  end if;
  new.changed_by := auth.uid(); new.changed_at := now();
  return new;
end $$;
drop trigger if exists guard_activation_cluster on public.activation_clusters;
create trigger guard_activation_cluster before insert or update on public.activation_clusters
  for each row execute function app.guard_activation_cluster();

-- Same signature as before. A Blue -> Red (or Red -> Blue) change carries the plan and the cluster states forward.
create or replace function public.set_eoc_level(p_level public.eoc_level, p_reason text,
  p_hazard text default null, p_authority text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_open public.eoc_activations; v_new uuid;
begin
  if not app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[]) then
    raise exception 'Only the EOC Manager or CDRRMO Head can change the activation level' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_reason)),0) = 0 then
    raise exception 'Give the reason for the level change' using errcode = '23514';
  end if;
  select * into v_open from public.eoc_activations where ended_at is null for update;
  if (v_open.id is null and p_level = 'white') or (v_open.id is not null and v_open.level = p_level) then
    raise exception 'The EOC is already at % level', p_level using errcode = '22023';
  end if;
  if v_open.id is not null then
    update public.eoc_activations set ended_at = now(), ended_by = auth.uid(), version = version where id = v_open.id;
  end if;
  if p_level = 'white' then
    v_new := v_open.id;
  else
    insert into public.eoc_activations (level, reason, hazard_code, authority_ref, plan_id)
    values (p_level, p_reason, coalesce(p_hazard, v_open.hazard_code), p_authority, v_open.plan_id) returning id into v_new;
    if v_open.id is not null then
      insert into public.activation_clusters (activation_id, item_kind, item_code, state, changed_by)
      select v_new, c.item_kind, c.item_code,
             case when c.state = 'standby' and p_level = 'red' and i.state in ('on','lead') then i.state else c.state end,
             auth.uid()
        from public.activation_clusters c
        left join public.cp_activation_items i on i.plan_id = v_open.plan_id and i.item_kind = c.item_kind and i.item_code = c.item_code
       where c.activation_id = v_open.id
      on conflict do nothing;
    end if;
  end if;
  insert into public.logbook_entries (activation_id, category, entry, author)
  values (v_new, 'level_change',
          format('EOC level changed %s → %s. Reason: %s', coalesce(upper(v_open.level::text), 'WHITE'), upper(p_level::text), p_reason),
          auth.uid());
  return v_new;
end $$;

drop view if exists public.v_eoc_status;
create view public.v_eoc_status with (security_invoker = true) as
select coalesce(a.level, 'white'::public.eoc_level) as level, a.id as activation_id, a.reason, a.hazard_code,
       a.started_at, a.started_by, a.plan_id, p.code as plan_code, p.title as plan_title
from (select 1) one
left join public.eoc_activations a on a.ended_at is null
left join public.contingency_plans p on p.id = a.plan_id;

-- ---------------------------------------------------------------- 4. EOC positions and designations
create table if not exists public.eoc_positions (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[A-Z][A-Z0-9-]{1,30}$'),
  title           text not null,
  section         text not null check (section in ('command','command_staff','operations','planning','logistics',
                                                     'finance_admin','cluster_desk','barangay_desk')),
  min_level       public.eoc_level not null default 'red',
  cluster_code    text references public.response_clusters(code) on update cascade,
  required_depth  smallint not null default 3 check (required_depth between 1 and 3),
  sort            smallint not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1
);
select app.track('public.eoc_positions');

create table if not exists public.eoc_designations (
  id                uuid primary key default gen_random_uuid(),
  position_id       uuid not null references public.eoc_positions(id),
  rank              smallint not null check (rank between 1 and 3),     -- 1 primary, 2 first alternate, 3 second alternate
  person_id         uuid references public.profiles(id),
  office_id         uuid references public.offices(id),
  designee_position text check (designee_position is null or length(designee_position) <= 160), -- a position title, not a name
  status            text not null default 'proposed' check (status in ('proposed','approved','withdrawn')),
  valid_from        date not null default current_date,
  valid_until       date,
  note              text,
  proposed_by       uuid default auth.uid() references public.profiles(id),
  approved_by       uuid references public.profiles(id),
  approved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  version           integer not null default 1,
  check (person_id is not null or office_id is not null),
  check (valid_until is null or valid_until >= valid_from)
);
create unique index if not exists eoc_designation_one_per_rank on public.eoc_designations (position_id, rank)
  where status in ('proposed','approved');
select app.track('public.eoc_designations');

create or replace function app.guard_eoc_designation() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'proposed' then
      raise exception 'A designation starts as a proposal; the CDRRMO Head approves it' using errcode = '42501';
    end if;
    new.proposed_by := auth.uid(); new.approved_by := null; new.approved_at := null;
    return new;
  end if;
  new.position_id := old.position_id; new.rank := old.rank; new.proposed_by := old.proposed_by;
  if old.status = 'withdrawn' then
    raise exception 'A withdrawn designation is kept as a record; propose a new one' using errcode = '42501';
  end if;
  if new.status = 'approved' and old.status <> 'approved' then
    if not app.has_role('cdrrmo_head') then
      raise exception 'Only the CDRRMO Head approves EOC designations' using errcode = '42501';
    end if;
    new.approved_by := auth.uid(); new.approved_at := now();
  elsif old.status = 'approved' then
    if new.status = 'approved' and row(new.person_id, new.office_id, new.designee_position, new.valid_from)
         is distinct from row(old.person_id, old.office_id, old.designee_position, old.valid_from) then
      raise exception 'An approved designation is fixed. Withdraw it and propose a new one.' using errcode = '42501';
    end if;
    if new.status = 'withdrawn' and not app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]) then
      raise exception 'Only the CDRRMO Head or EOC Manager can withdraw an approved designation' using errcode = '42501';
    end if;
    new.approved_by := old.approved_by; new.approved_at := old.approved_at;
  else
    new.approved_by := null; new.approved_at := null;
  end if;
  return new;
end $$;
drop trigger if exists guard_eoc_designation on public.eoc_designations;
create trigger guard_eoc_designation before insert or update on public.eoc_designations
  for each row execute function app.guard_eoc_designation();

drop view if exists public.v_eoc_depth;
create view public.v_eoc_depth with (security_invoker = true) as
select p.id as position_id, p.code, p.title, p.section, p.min_level, p.cluster_code, p.required_depth, p.sort,
       count(d.id) filter (where d.status = 'approved' and (d.valid_until is null or d.valid_until >= current_date)) as approved,
       count(d.id) filter (where d.status = 'proposed') as proposed,
       bool_or(d.rank = 1 and d.status = 'approved') is true as has_primary,
       count(d.id) filter (where d.status = 'approved' and (d.valid_until is null or d.valid_until >= current_date)) >= 2 as two_deep
from public.eoc_positions p
left join public.eoc_designations d on d.position_id = p.id
where p.is_active
group by p.id;

-- ---------------------------------------------------------------- 5. barangay clusters
create table if not exists public.barangay_clusters (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^D[1-9]$'),
  name        text not null,
  is_pilot    boolean not null default false,
  pilot_from  date,
  pilot_to    date,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  check (pilot_to is null or pilot_from is null or pilot_to >= pilot_from)
);
select app.track('public.barangay_clusters');

alter table public.barangays add column if not exists cluster_id uuid references public.barangay_clusters(id);
alter table public.barangays add column if not exists hazard_tags text[] not null default '{}';
alter table public.barangays add column if not exists hazard_tag_source text;
do $$ begin
  alter table public.barangays add constraint barangays_hazard_tags_chk check (hazard_tags <@ array[
    'flood','flash_flood','storm_surge','landslide','earthquake','liquefaction','tsunami','drought']::text[]);
exception when duplicate_object then null; end $$;

-- Cluster roll-up for the Barangay Liaison Desk: barangays, reports in the open activation, silent barangays.
drop view if exists public.v_cluster_status;
create view public.v_cluster_status with (security_invoker = true) as
with open_act as (select id from public.eoc_activations where ended_at is null),
latest as (
  select distinct on (r.barangay_psgc) r.barangay_psgc, r.reported_at, r.condition, r.persons_evacuated
    from public.barangay_reports r where r.activation_id = (select id from open_act)
   order by r.barangay_psgc, r.reported_at desc)
select c.id as cluster_id, c.code, c.name, c.is_pilot,
       count(b.psgc) as barangays,
       count(l.barangay_psgc) as reporting,
       count(b.psgc) - count(l.barangay_psgc) as silent,
       count(*) filter (where l.condition in ('affected','isolated','evacuating')) as affected,
       coalesce(sum(l.persons_evacuated), 0) as persons_evacuated,
       max(l.reported_at) as last_report_at
from public.barangay_clusters c
left join public.barangays b on b.cluster_id = c.id
left join latest l on l.barangay_psgc = b.psgc
group by c.id;

-- ---------------------------------------------------------------- RLS
alter table public.response_clusters   enable row level security;
alter table public.contingency_plans   enable row level security;
alter table public.cp_activation_items enable row level security;
alter table public.activation_clusters enable row level security;
alter table public.eoc_positions       enable row level security;
alter table public.eoc_designations    enable row level security;
alter table public.barangay_clusters   enable row level security;

do $$ declare t text; begin
  foreach t in array array['response_clusters','contingency_plans','cp_activation_items','activation_clusters',
                           'eoc_positions','eoc_designations','barangay_clusters'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (app.is_active_user())', t);
    execute format('revoke truncate on public.%1$s from authenticated, anon', t);
    execute format('drop trigger if exists aa0_block_oauth_client_writes on public.%1$s', t);
    execute format('create trigger aa0_block_oauth_client_writes before insert or update or delete on public.%1$s
                    for each row execute function app.block_oauth_client_writes()', t);
  end loop;
end $$;

-- Reference-like lists: the CDRRMO Head (and EOC Manager for plans' activation sets).
create policy response_clusters_insert on public.response_clusters for insert to authenticated with check (app.has_role('cdrrmo_head'));
create policy response_clusters_update on public.response_clusters for update to authenticated
  using (app.has_role('cdrrmo_head')) with check (app.has_role('cdrrmo_head'));
create policy contingency_plans_insert on public.contingency_plans for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]));
create policy contingency_plans_update on public.contingency_plans for update to authenticated
  using (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]));
create policy cp_activation_items_insert on public.cp_activation_items for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]));
create policy cp_activation_items_update on public.cp_activation_items for update to authenticated
  using (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]));
create policy cp_activation_items_delete on public.cp_activation_items for delete to authenticated
  using (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]));
create policy activation_clusters_insert on public.activation_clusters for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]));
create policy activation_clusters_update on public.activation_clusters for update to authenticated
  using (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]));
create policy eoc_positions_insert on public.eoc_positions for insert to authenticated with check (app.has_role('cdrrmo_head'));
create policy eoc_positions_update on public.eoc_positions for update to authenticated
  using (app.has_role('cdrrmo_head')) with check (app.has_role('cdrrmo_head'));
-- Anyone who staffs the EOC may propose; the guard keeps approval with the Head.
create policy eoc_designations_insert on public.eoc_designations for insert to authenticated
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff']::public.app_role[]));
create policy eoc_designations_update on public.eoc_designations for update to authenticated
  using (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff']::public.app_role[]));
create policy barangay_clusters_insert on public.barangay_clusters for insert to authenticated with check (app.has_role('cdrrmo_head'));
create policy barangay_clusters_update on public.barangay_clusters for update to authenticated
  using (app.has_role('cdrrmo_head')) with check (app.has_role('cdrrmo_head'));

revoke delete on public.response_clusters, public.contingency_plans, public.activation_clusters,
  public.eoc_positions, public.eoc_designations, public.barangay_clusters from authenticated, anon;
grant select, insert, update on public.response_clusters, public.contingency_plans, public.activation_clusters,
  public.eoc_positions, public.eoc_designations, public.barangay_clusters to authenticated;
grant select, insert, update, delete on public.cp_activation_items to authenticated;
grant select on public.v_eoc_depth, public.v_cluster_status, public.v_eoc_status to authenticated;

do $$ declare t text; begin
  foreach t in array array['activation_clusters','eoc_designations','contingency_plans'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
