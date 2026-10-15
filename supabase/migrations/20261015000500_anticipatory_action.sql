-- =============================================================================
-- 0005 ANTICIPATORY ACTION — RA 12287 and its IRR (signed 14 Sep 2026)
-- PDRA → (city early action | request to RDRRMC VIII → Mayor's EO) →
-- AA checklist → AA fund with graduated disbursement → lifting → 45-day report.
-- =============================================================================

-- Rule parameters. Values from the IRR; editable by admin when the NDRRMC
-- operational guidelines and DBM–COA funding guidelines are issued.
create table public.aa_rules (
  key         text primary key,
  value       numeric not null,
  label       text not null,
  source_ref  text not null,
  updated_at  timestamptz not null default now(),
  version     integer not null default 1
);
insert into public.aa_rules (key, value, label, source_ref) values
  ('aa_share_of_ldrrmf_70',  0.10, 'Maximum AA share of the 70% LDRRMF', 'IRR Rule V Sec. 1(b)'),
  ('tranche_beyond_max',     0.30, 'Maximum share of the AA allocation for interventions beyond the lead-time threshold', 'IRR Rule V Sec. 2'),
  ('tranche_within_max',     0.70, 'Maximum share of the AA allocation for interventions within the lead-time threshold', 'IRR Rule V Sec. 2'),
  ('lead_threshold_hours',   72,   'Lead-time threshold (3 days)', 'RA 12287 Sec. 6(b); IRR Rule II Sec. 3, Rule V Sec. 2'),
  ('min_declaration_lead_hours', 72, 'Minimum lead time for a declaration', 'RA 12287 Sec. 6(b)'),
  ('rdrrmc_reply_hours',     24,   'RDRRMC recommendation time on a city request', 'IRR Rule III Sec. 2'),
  ('report_days',            45,   'Report to OCD after lifting', 'RA 12287 Sec. 8; IRR Rule VI Sec. 1');
select app.track('public.aa_rules');

create or replace function public.aa_rule(p_key text) returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select value from public.aa_rules where key = p_key
$$;
grant execute on function public.aa_rule(text) to authenticated;

-- ------------------------------------------------------------- PDRA ---------
create table public.pdra_sessions (
  id                   uuid primary key default gen_random_uuid(),
  hazard_code          text not null references public.hazards(code),
  forecast_source      text not null,            -- e.g. 'PAGASA Severe Weather Bulletin #3'
  forecast_issued_at   timestamptz not null,
  expected_impact_at   timestamptz not null,
  conducted_at         timestamptz not null default now(),
  impact_class         text not null check (impact_class in ('severe','moderate','minor','uncertain')),
  affected_barangays   text[] not null default '{}',
  cascading_risks      text,
  sectors_at_risk      text[] not null default '{}',  -- agriculture, business, critical infrastructure …
  summary              text,
  decision             text not null default 'monitor'
                       check (decision in ('monitor','local_early_action','request_declaration')),
  decision_basis       text,
  created_by           uuid default auth.uid() references public.profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  version              integer not null default 1,
  check (expected_impact_at > forecast_issued_at)
);

-- Hours of lead time left when the PDRA was held.
create or replace function public.pdra_lead_hours(p public.pdra_sessions) returns numeric
language sql stable as $$
  select round(extract(epoch from (p.expected_impact_at - p.conducted_at)) / 3600.0, 1)
$$;

-- A declaration request needs a severe impact classification and at least the
-- minimum lead time (RA 12287 Sec. 6). Shorter-lead hazards use city early action.
create or replace function app.guard_pdra_decision() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_lead numeric := extract(epoch from (new.expected_impact_at - new.conducted_at)) / 3600.0;
begin
  if new.decision = 'request_declaration' then
    if new.impact_class <> 'severe' then
      raise exception 'A State of Imminent Disaster needs impacts classified as severe. Choose city early action instead.'
        using errcode = '23514';
    end if;
    if v_lead < public.aa_rule('min_declaration_lead_hours') then
      raise exception 'Only % hours of lead time remain; a declaration needs at least %. Use city early action under the LGU''s own authority.',
        round(v_lead, 1), public.aa_rule('min_declaration_lead_hours') using errcode = '23514';
    end if;
    if coalesce(length(trim(new.decision_basis)), 0) = 0 then
      raise exception 'Record the basis for requesting a declaration' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger guard_pdra_decision before insert or update on public.pdra_sessions
  for each row execute function app.guard_pdra_decision();

-- ------------------------------------------------------ declarations --------
create table public.declarations (
  id                    uuid primary key default gen_random_uuid(),
  pdra_id               uuid references public.pdra_sessions(id),
  hazard_code           text not null references public.hazards(code),
  scope_barangays       text[] not null default '{}',
  expected_impact_at    timestamptz not null,
  origin                text not null default 'city_request'
                        check (origin in ('city_request','adopted_provincial','adopted_regional','adopted_national')),
  status                text not null default 'draft'
                        check (status in ('draft','requested','recommended','not_recommended','declared','lifted','withdrawn')),
  requested_at          timestamptz,
  rdrrmc_due_at         timestamptz,
  rdrrmc_responded_at   timestamptz,
  rdrrmc_reference      text,
  eo_number             text,
  declared_at           timestamptz,
  lifted_at             timestamptz,
  lifting_ground        text check (lifting_ground in ('hazard_occurred','impacts_not_met')),
  lifting_basis         text,
  report_due_at         timestamptz,
  report_submitted_at   timestamptz,
  report_reference      text,
  costs_minimized_note  text,               -- estimated economic and social costs minimized
  created_by            uuid default auth.uid() references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  version               integer not null default 1
);
create index declarations_status_idx on public.declarations(status);

create or replace function app.guard_declaration() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  old_status text := case when tg_op = 'UPDATE' then old.status else 'draft' end;
  allowed text[];
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    if old.status in ('lifted','withdrawn') and (new.report_submitted_at is not distinct from old.report_submitted_at)
       and (new.report_reference is not distinct from old.report_reference)
       and (new.costs_minimized_note is not distinct from old.costs_minimized_note) then
      raise exception 'A % declaration can only have its OCD report recorded', old.status using errcode = '42501';
    end if;
    return new;
  end if;

  if not app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]) then
    raise exception 'Only the CDRRMO Head or EOC Manager can record declaration steps' using errcode = '42501';
  end if;

  allowed := case old_status
    when 'draft' then array['draft','requested','declared','withdrawn']
    when 'requested' then array['recommended','not_recommended','withdrawn']
    when 'recommended' then array['declared','withdrawn']
    when 'not_recommended' then array['withdrawn']
    when 'declared' then array['lifted']
    else array[]::text[] end;
  if not new.status = any(allowed) then
    raise exception 'A % declaration cannot move to %', old_status, new.status using errcode = '22023';
  end if;

  case new.status
    when 'requested' then
      if new.origin <> 'city_request' then raise exception 'Adopted declarations are not requested from the RDRRMC' using errcode = '22023'; end if;
      new.requested_at := coalesce(new.requested_at, now());
      new.rdrrmc_due_at := new.requested_at + make_interval(hours => public.aa_rule('rdrrmc_reply_hours')::int);
    when 'recommended', 'not_recommended' then
      new.rdrrmc_responded_at := coalesce(new.rdrrmc_responded_at, now());
      if coalesce(length(trim(new.rdrrmc_reference)), 0) = 0 then
        raise exception 'Record the RDRRMC recommendation reference' using errcode = '23514';
      end if;
    when 'declared' then
      if new.origin = 'city_request' and old_status <> 'recommended' then
        raise exception 'The Mayor declares upon the RDRRMC recommendation (RA 12287 Sec. 5)' using errcode = '22023';
      end if;
      if new.origin = 'city_request' and coalesce(length(trim(new.eo_number)), 0) = 0 then
        raise exception 'Record the Executive Order number' using errcode = '23514';
      end if;
      new.declared_at := coalesce(new.declared_at, now());
    when 'lifted' then
      if new.lifting_ground is null then raise exception 'Record the ground for lifting' using errcode = '23514'; end if;
      new.lifted_at := coalesce(new.lifted_at, now());
      new.report_due_at := new.lifted_at + make_interval(days => public.aa_rule('report_days')::int);
    else null;
  end case;
  return new;
end $$;
create trigger guard_declaration before insert or update on public.declarations
  for each row execute function app.guard_declaration();

-- ------------------------------------------------------ AA checklist --------
create table public.aa_action_templates (
  id           uuid primary key default gen_random_uuid(),
  hazard_code  text references public.hazards(code),       -- null = all forecastable hazards
  sector       text not null,
  title        text not null,
  irr_ref      text not null,
  lead_office  text not null,
  timing       text not null check (timing in ('before_impact_beyond_3d','within_3d','on_declaration','after_lifting')),
  seq          smallint not null,
  is_active    boolean not null default true
);

create table public.aa_actions (
  id              uuid primary key default gen_random_uuid(),
  declaration_id  uuid references public.declarations(id) on delete cascade,
  pdra_id         uuid references public.pdra_sessions(id) on delete cascade,
  template_id     uuid references public.aa_action_templates(id),
  sector          text not null,
  title           text not null,
  lead_office     text,
  timing          text,
  status          text not null default 'pending' check (status in ('pending','in_progress','done','not_applicable')),
  note            text,
  done_by         uuid references public.profiles(id),
  done_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1,
  check (num_nonnulls(declaration_id, pdra_id) = 1),
  check (status <> 'not_applicable' or coalesce(length(trim(note)),0) > 0)
);
create index aa_actions_decl_idx on public.aa_actions(declaration_id);

create or replace function app.stamp_aa_action() returns trigger
language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.done_by := coalesce(new.done_by, auth.uid()); new.done_at := coalesce(new.done_at, now());
  elsif new.status <> 'done' then
    new.done_by := null; new.done_at := null;
  end if;
  return new;
end $$;
create trigger stamp_aa_action before insert or update on public.aa_actions
  for each row execute function app.stamp_aa_action();

-- Load the checklist for a declaration or an early-action PDRA (idempotent).
create or replace function public.load_aa_checklist(p_declaration uuid default null, p_pdra uuid default null)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_hazard text; v_n integer;
begin
  if not app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff','duty_officer']::public.app_role[]) then
    raise exception 'Your role cannot load AA checklists' using errcode = '42501';
  end if;
  if num_nonnulls(p_declaration, p_pdra) <> 1 then raise exception 'Give a declaration or a PDRA' using errcode = '22023'; end if;
  if p_declaration is not null then
    select hazard_code into v_hazard from public.declarations where id = p_declaration;
  else
    select hazard_code into v_hazard from public.pdra_sessions where id = p_pdra;
  end if;
  -- ids are UUIDv5(namespace = declaration or PDRA id, name = template id) so an
  -- offline client creates the same rows before this call reaches the server.
  insert into public.aa_actions (id, declaration_id, pdra_id, template_id, sector, title, lead_office, timing)
  select extensions.uuid_generate_v5(coalesce(p_declaration, p_pdra), t.id::text),
         p_declaration, p_pdra, t.id, t.sector, t.title, t.lead_office, t.timing
  from public.aa_action_templates t
  where t.is_active and (t.hazard_code is null or t.hazard_code = v_hazard)
  order by t.seq
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function public.load_aa_checklist(uuid, uuid) to authenticated;

-- ------------------------------------------------------ AA funds ------------
create table public.aa_fund_years (
  fiscal_year     smallint primary key,
  ldrrmf_total    numeric(14,2) not null check (ldrrmf_total >= 0),   -- the 5% LDRRMF for the year
  aa_allocation   numeric(14,2) not null check (aa_allocation >= 0),  -- set aside within the 70% fund
  appropriation_ref text,
  updated_at      timestamptz not null default now(),
  version         integer not null default 1
);

create or replace function app.guard_aa_fund_year() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cap numeric := round(new.ldrrmf_total * 0.70 * public.aa_rule('aa_share_of_ldrrmf_70'), 2);
begin
  if new.aa_allocation > v_cap then
    raise exception 'The AA allocation (₱%) is above the cap of ₱% (% of the 70%% LDRRMF).',
      to_char(new.aa_allocation, 'FM999,999,999,990.00'), to_char(v_cap, 'FM999,999,999,990.00'),
      (public.aa_rule('aa_share_of_ldrrmf_70') * 100)::int || '%' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger guard_aa_fund_year before insert or update on public.aa_fund_years
  for each row execute function app.guard_aa_fund_year();

create table public.aa_disbursements (
  id               uuid primary key default gen_random_uuid(),
  declaration_id   uuid not null references public.declarations(id),
  fiscal_year      smallint not null,
  source           text not null check (source in ('ldrrmf_aa','special_trust_fund','donation','oda','other_lgu','other')),
  amount           numeric(14,2) not null check (amount > 0),
  purpose          text not null,
  intervention_at  timestamptz not null,       -- when the funded intervention is carried out
  lead_hours       numeric,                    -- hours before expected impact (set by trigger)
  tranche          text check (tranche in ('beyond_threshold','within_threshold')),
  obligation_ref   text,                       -- OBR / DV number
  created_by       uuid default auth.uid() references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  version          integer not null default 1
);
create index aa_disb_year_idx on public.aa_disbursements(fiscal_year, source);

-- Graduated disbursement (IRR Rule V Sec. 2) for the LDRRMF AA allocation only.
-- Other sources are exempt from the graduation (RA 12287 Sec. 10).
create or replace function app.guard_aa_disbursement() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_decl public.declarations; v_year public.aa_fund_years;
  v_threshold numeric := public.aa_rule('lead_threshold_hours');
  v_used numeric; v_limit numeric;
begin
  select * into v_decl from public.declarations where id = new.declaration_id;
  if v_decl.status not in ('declared') and tg_op = 'INSERT' then
    raise exception 'Funds are released only while a State of Imminent Disaster is in force (status is %).', v_decl.status
      using errcode = '22023';
  end if;
  new.lead_hours := round(extract(epoch from (v_decl.expected_impact_at - new.intervention_at)) / 3600.0, 1);
  if new.lead_hours < 0 then
    raise exception 'The intervention date is after the expected impact; record it as response, not anticipatory action' using errcode = '23514';
  end if;
  new.tranche := case when new.lead_hours > v_threshold then 'beyond_threshold' else 'within_threshold' end;

  if new.source = 'ldrrmf_aa' then
    select * into v_year from public.aa_fund_years where fiscal_year = new.fiscal_year;
    if v_year.fiscal_year is null then
      raise exception 'Set the AA allocation for % before recording LDRRMF disbursements', new.fiscal_year using errcode = '23514';
    end if;
    select coalesce(sum(amount), 0) into v_used from public.aa_disbursements
     where fiscal_year = new.fiscal_year and source = 'ldrrmf_aa' and tranche = new.tranche and id <> new.id;
    v_limit := round(v_year.aa_allocation * public.aa_rule(case when new.tranche = 'beyond_threshold'
                     then 'tranche_beyond_max' else 'tranche_within_max' end), 2);
    if v_used + new.amount > v_limit then
      raise exception 'This would bring % disbursements to ₱%, above the ₱% limit for that tranche.',
        replace(new.tranche, '_', ' '), to_char(v_used + new.amount, 'FM999,999,999,990.00'),
        to_char(v_limit, 'FM999,999,999,990.00') using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger guard_aa_disbursement before insert or update on public.aa_disbursements
  for each row execute function app.guard_aa_disbursement();

select app.track('public.pdra_sessions');
select app.track('public.declarations');
select app.track('public.aa_actions');
select app.track('public.aa_fund_years');
select app.track('public.aa_disbursements');

create view public.v_aa_fund_status with (security_invoker = true) as
select y.fiscal_year, y.ldrrmf_total, y.aa_allocation,
  round(y.ldrrmf_total * 0.70 * public.aa_rule('aa_share_of_ldrrmf_70'), 2) as aa_cap,
  round(y.aa_allocation * public.aa_rule('tranche_beyond_max'), 2) as beyond_limit,
  round(y.aa_allocation * public.aa_rule('tranche_within_max'), 2) as within_limit,
  coalesce(sum(d.amount) filter (where d.source = 'ldrrmf_aa' and d.tranche = 'beyond_threshold'), 0) as beyond_used,
  coalesce(sum(d.amount) filter (where d.source = 'ldrrmf_aa' and d.tranche = 'within_threshold'), 0) as within_used,
  coalesce(sum(d.amount) filter (where d.source <> 'ldrrmf_aa'), 0) as other_sources_used
from public.aa_fund_years y left join public.aa_disbursements d on d.fiscal_year = y.fiscal_year
group by y.fiscal_year, y.ldrrmf_total, y.aa_allocation;

create view public.v_declaration_board with (security_invoker = true) as
select d.*, h.name as hazard_name,
  case when d.status = 'requested' and now() > d.rdrrmc_due_at then true else false end as rdrrmc_overdue,
  case when d.status in ('lifted') and d.report_submitted_at is null and now() > d.report_due_at then true else false end as report_overdue,
  round(extract(epoch from (d.expected_impact_at - now())) / 3600.0, 1) as hours_to_impact,
  (select count(*) from public.aa_actions a where a.declaration_id = d.id) as actions_total,
  (select count(*) from public.aa_actions a where a.declaration_id = d.id and a.status in ('done','not_applicable')) as actions_closed,
  (select coalesce(sum(amount),0) from public.aa_disbursements x where x.declaration_id = d.id) as funds_used
from public.declarations d join public.hazards h on h.code = d.hazard_code;

-- ----------------------------------------------------------- RLS ------------
alter table public.aa_rules enable row level security;
alter table public.pdra_sessions enable row level security;
alter table public.declarations enable row level security;
alter table public.aa_action_templates enable row level security;
alter table public.aa_actions enable row level security;
alter table public.aa_fund_years enable row level security;
alter table public.aa_disbursements enable row level security;

create policy aa_rules_read on public.aa_rules for select to authenticated using (app.is_active_user());
create policy aa_rules_admin on public.aa_rules for update to authenticated using (app.has_role('admin')) with check (app.has_role('admin'));

create policy aa_tpl_read on public.aa_action_templates for select to authenticated using (app.is_active_user());
create policy aa_tpl_write on public.aa_action_templates for all to authenticated
  using (app.has_any_role(array['cdrrmo_head','author']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','author']::public.app_role[]));

create policy pdra_read on public.pdra_sessions for select to authenticated using (app.is_active_user());
create policy pdra_write on public.pdra_sessions for all to authenticated
  using (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff']::public.app_role[]));

create policy decl_read on public.declarations for select to authenticated using (app.is_active_user());
create policy decl_write on public.declarations for all to authenticated
  using (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager']::public.app_role[]));

create policy aa_act_read on public.aa_actions for select to authenticated using (app.is_active_user());
create policy aa_act_update on public.aa_actions for update to authenticated
  using (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff','duty_officer']::public.app_role[]))
  with check (app.has_any_role(array['cdrrmo_head','eoc_manager','eoc_staff','duty_officer']::public.app_role[]));

-- Funds: Budget/Accounting entries are recorded by the CDRRMO Head (or admin).
create policy fund_read on public.aa_fund_years for select to authenticated using (app.is_active_user());
create policy fund_write on public.aa_fund_years for all to authenticated
  using (app.has_role('cdrrmo_head')) with check (app.has_role('cdrrmo_head'));
create policy disb_read on public.aa_disbursements for select to authenticated using (app.is_active_user());
create policy disb_write on public.aa_disbursements for all to authenticated
  using (app.has_role('cdrrmo_head')) with check (app.has_role('cdrrmo_head'));

grant select, update on public.aa_rules to authenticated;
grant select, insert, update on public.pdra_sessions, public.declarations, public.aa_fund_years, public.aa_disbursements to authenticated;
grant select, insert, update, delete on public.aa_action_templates to authenticated;
grant select, update on public.aa_actions to authenticated;
grant select on public.v_aa_fund_status, public.v_declaration_board to authenticated;
grant execute on function public.pdra_lead_hours(public.pdra_sessions) to authenticated;

alter publication supabase_realtime add table public.declarations, public.aa_actions;
