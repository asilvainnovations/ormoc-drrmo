-- 1.13.0: RA 12287 and IRR alignment (IRR signed 14 Sep 2026; certified true copy read page by page, 11 Nov 2026).
--
--  1. Lead time is stated in days, as the law and the IRR state it: "an allowable or sufficient lead time of three
--     (3) days, which may be extended to five (5) days" (RA 12287 Sec. 6(b)); the declaration "shall not go below
--     the minimum limitations set forth under Section 6, par. (b)" (IRR Rule II Sec. 3).
--  2. The minimum lead time is checked again when the Mayor declares on a City request, not only when the request
--     is sent: the RDRRMC has up to 24 hours to recommend (IRR Rule III Sec. 2), which can take a request below the
--     minimum. Adopted provincial, regional or national declarations are not re-checked: LGUs within a declared
--     Province or Region "shall adopt such declaration" (IRR Rule III Sec. 3).
--  3. Graduated disbursement applies only to hydrometeorological and geological hazards: beyond a lead time of three
--     (3) days at most 30% of the allocation for anticipatory action; up to 70% within a maximum lead time of three
--     (3) days. Slow-onset hazards such as drought follow the NDRRMC operational guidelines (still pending), and the
--     graduation does not apply to other lawful sources: agency budgets, external grants or donations, or other
--     sources authorized by law (IRR Rule V Sec. 2). Ungraduated LDRRMF disbursements still cannot exceed the
--     year's AA allocation (IRR Rule V Sec. 1(b): no more than 10% of the 70% LDRRMF).
--  4. Lifting. "The State of Imminent Disaster shall automatically be lifted upon the occurrence of the hazard"
--     (RA 12287 Sec. 7; IRR Rule II Sec. 6(a): evidenced by advisories from mandated science agencies, incident
--     report, situational report or damage assessment). The lifting time is the occurrence time, so the 45-day
--     report to OCD counts from it (IRR Rule VI Sec. 1). When projected impacts are not met, the Mayor lifts upon the
--     RDRRMC recommendation (RA 12287 Sec. 7; IRR Rule II Sec. 6(b), Rule III Sec. 4(b)); the recommendation and the
--     lifting issuance are recorded. The statute governs where the IRR says "may be lifted".
-- Safe to run again.

-- ---------------------------------------------------------------- hazards --
alter table public.hazards add column if not exists aa_family text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hazards_aa_family_values') then
    alter table public.hazards add constraint hazards_aa_family_values
      check (aa_family is null or aa_family in ('hydromet', 'geological', 'climatic', 'other'));
  end if;
end $$;
comment on column public.hazards.aa_family is
  'IRR Rule II Sec. 2: hydromet and geological hazards (graduated AA disbursement, Rule V Sec. 2); climatic hazards such as drought (timelines per NDRRMC operational guidelines); other.';
update public.hazards h set aa_family = v.fam
from (values ('tropical_cyclone', 'hydromet'), ('storm_surge', 'hydromet'), ('flood', 'hydromet'), ('flash_flood', 'hydromet'),
             ('rain_landslide', 'hydromet'), ('extreme_heat', 'hydromet'), ('drought', 'climatic'),
             ('earthquake', 'geological'), ('tsunami', 'geological'), ('industrial', 'other')) as v(code, fam)
where h.code = v.code and h.aa_family is distinct from v.fam;

-- ---------------------------------------------------------------- rules ----
insert into public.aa_rules (key, value, label, source_ref) values
  ('lead_threshold_days', 3, 'Graduated disbursement: beyond or within a lead time of three (3) days', 'IRR Rule V Sec. 2'),
  ('min_declaration_lead_days', 3, 'Minimum lead time for a declaration: three (3) days', 'RA 12287 Sec. 6(b); IRR Rule II Sec. 3'),
  ('extended_declaration_lead_days', 5, 'The three-day lead time may be extended to five (5) days', 'RA 12287 Sec. 6(b)')
on conflict (key) do update set value = excluded.value, label = excluded.label, source_ref = excluded.source_ref;
update public.aa_rules set label = 'At most 30% of the AA allocation for interventions beyond a lead time of three (3) days (hydromet and geological hazards)',
  source_ref = 'IRR Rule V Sec. 2' where key = 'tranche_beyond_max';
update public.aa_rules set label = 'Up to 70% of the AA allocation for interventions within a maximum lead time of three (3) days (hydromet and geological hazards)',
  source_ref = 'IRR Rule V Sec. 2' where key = 'tranche_within_max';
update public.aa_rules set label = 'Report to OCD within forty-five (45) days from the lifting',
  source_ref = 'RA 12287 Sec. 8; IRR Rule VI Sec. 1' where key = 'report_days';
-- Replaced by the day-based keys above (every function that read them is replaced below).
delete from public.aa_rules where key in ('lead_threshold_hours', 'min_declaration_lead_hours');

create or replace function public.aa_days_text(p numeric) returns text
language sql immutable as $$
  select case when p = 3 then 'three (3) days' when p = 5 then 'five (5) days' else trim(to_char(p, 'FM990.##')) || ' days' end
$$;

-- -------------------------------------------------------------- PDRA -------
create or replace function app.guard_pdra_decision() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_lead numeric := extract(epoch from (new.expected_impact_at - new.conducted_at)) / 86400.0;
  v_min numeric := public.aa_rule('min_declaration_lead_days');
begin
  if new.decision = 'request_declaration' then
    if new.impact_class <> 'severe' then
      raise exception 'A State of Imminent Disaster needs impacts classified as severe. Choose city early action instead.'
        using errcode = '23514';
    end if;
    if v_min is null then raise exception 'The minimum lead time rule is missing (aa_rules).' using errcode = '23514'; end if;
    if v_lead < v_min then
      raise exception 'Only % days of lead time remain at the PDRA; a declaration needs a lead time of at least % (RA 12287 Sec. 6(b)). Use city early action under the LGU''s own authority.',
        floor(v_lead * 10) / 10, public.aa_days_text(v_min) using errcode = '23514';
    end if;
    if coalesce(length(trim(new.decision_basis)), 0) = 0 then
      raise exception 'Record the basis for requesting a declaration' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- ----------------------------------------------------- declaration request --
create or replace function app.guard_declaration_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pdra public.pdra_sessions; v_lead numeric; v_min numeric := public.aa_rule('min_declaration_lead_days');
begin
  if new.status = 'requested' and (tg_op = 'INSERT' or old.status <> 'requested') then
    select * into v_pdra from public.pdra_sessions where id = new.pdra_id;
    if v_pdra.id is null or v_pdra.decision <> 'request_declaration' or v_pdra.impact_class <> 'severe' then
      raise exception 'A City request needs a PDRA that found severe impacts and decided to request a declaration' using errcode = '23514';
    end if;
    if v_min is null then raise exception 'The minimum lead time rule is missing (aa_rules).' using errcode = '23514'; end if;
    v_lead := extract(epoch from (new.expected_impact_at - now())) / 86400.0;
    if v_lead < v_min then
      raise exception 'Only % days of lead time remain; a declaration needs a lead time of at least % (RA 12287 Sec. 6(b)). Use city early action under the LGU''s own authority.',
        floor(v_lead * 10) / 10, public.aa_days_text(v_min) using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- ------------------------------------------------------------ declarations --
alter table public.declarations add column if not exists hazard_occurred_at timestamptz;
alter table public.declarations add column if not exists lifting_reference text;
comment on column public.declarations.hazard_occurred_at is
  'When the forecast hazard occurred (RA 12287 Sec. 7: automatic lifting). Evidence in lifting_basis.';
comment on column public.declarations.lifting_reference is
  'Impacts not met: the RDRRMC recommendation and the lifting issuance (RA 12287 Sec. 7; IRR Rule III Sec. 4).';

create or replace function app.guard_declaration() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  old_status text := case when tg_op = 'UPDATE' then old.status else 'draft' end;
  allowed text[];
  v_min numeric := public.aa_rule('min_declaration_lead_days');
  v_lead numeric;
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    if old.status in ('lifted', 'withdrawn') then
      -- After lifting only the OCD report may be recorded; the lifting facts stay as recorded.
      if (new.report_submitted_at is not distinct from old.report_submitted_at)
         and (new.report_reference is not distinct from old.report_reference)
         and (new.costs_minimized_note is not distinct from old.costs_minimized_note) then
        raise exception 'A % declaration can only have its OCD report recorded', old.status using errcode = '42501';
      end if;
      new.lifting_ground := old.lifting_ground; new.lifting_basis := old.lifting_basis;
      new.lifting_reference := old.lifting_reference; new.hazard_occurred_at := old.hazard_occurred_at;
    end if;
    return new;
  end if;

  if not app.has_any_role(array['cdrrmo_head', 'eoc_manager']::public.app_role[]) then
    raise exception 'Only the CDRRMO Head or EOC Manager can record declaration steps' using errcode = '42501';
  end if;

  allowed := case old_status
    when 'draft' then array['draft', 'requested', 'declared', 'withdrawn']
    when 'requested' then array['recommended', 'not_recommended', 'withdrawn']
    when 'recommended' then array['declared', 'withdrawn']
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
      if new.origin = 'city_request' then
        if v_min is null then raise exception 'The minimum lead time rule is missing (aa_rules).' using errcode = '23514'; end if;
        v_lead := extract(epoch from (new.expected_impact_at - now())) / 86400.0;
        if v_lead < v_min then
          raise exception 'Only % days remain before the expected impact; the declaration shall not go below a lead time of % (RA 12287 Sec. 6(b); IRR Rule II Sec. 3). Use city early action under the LGU''s own authority.',
            floor(v_lead * 10) / 10, public.aa_days_text(v_min) using errcode = '23514';
        end if;
      end if;
      new.declared_at := coalesce(new.declared_at, now());
    when 'lifted' then
      if new.lifting_ground is null then raise exception 'Record the ground for lifting' using errcode = '23514'; end if;
      if new.lifting_ground = 'hazard_occurred' then
        if new.hazard_occurred_at is null then
          raise exception 'Record when the hazard occurred: the declaration is lifted automatically at that time (RA 12287 Sec. 7)' using errcode = '23514';
        end if;
        if new.hazard_occurred_at < coalesce(old.declared_at, new.declared_at) or new.hazard_occurred_at > now() + interval '5 minutes' then
          raise exception 'The hazard occurrence time must fall between the declaration and now' using errcode = '23514';
        end if;
        if coalesce(length(trim(new.lifting_basis)), 0) = 0 then
          raise exception 'Record the evidence of occurrence: advisory, incident report, situational report or damage assessment (IRR Rule II Sec. 6(a))' using errcode = '23514';
        end if;
        new.lifted_at := new.hazard_occurred_at;                                   -- automatic lifting at occurrence
      else
        if coalesce(length(trim(new.lifting_reference)), 0) = 0 then
          raise exception 'Record the RDRRMC recommendation and the lifting issuance (RA 12287 Sec. 7; IRR Rule III Sec. 4)' using errcode = '23514';
        end if;
        new.hazard_occurred_at := null;
        new.lifted_at := coalesce(new.lifted_at, now());
      end if;
      new.report_due_at := new.lifted_at + make_interval(days => public.aa_rule('report_days')::int);
    else null;
  end case;
  return new;
end $$;

-- ------------------------------------------------------------ disbursements --
create or replace function app.guard_aa_disbursement() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_decl public.declarations; v_year public.aa_fund_years; v_family text;
  v_threshold numeric := public.aa_rule('lead_threshold_days');
  v_used numeric; v_limit numeric; v_total numeric;
begin
  select * into v_decl from public.declarations where id = new.declaration_id;
  if v_decl.status not in ('declared') and tg_op = 'INSERT' then
    raise exception 'Funds are released only while a State of Imminent Disaster is in force (status is %).', v_decl.status
      using errcode = '22023';
  end if;
  if v_threshold is null then raise exception 'The lead time rule is missing (aa_rules).' using errcode = '23514'; end if;
  select aa_family into v_family from public.hazards where code = v_decl.hazard_code;
  new.lead_hours := round(extract(epoch from (v_decl.expected_impact_at - new.intervention_at)) / 3600.0, 1);
  if new.lead_hours < 0 then
    raise exception 'The intervention date is after the expected impact; record it as response, not anticipatory action' using errcode = '23514';
  end if;
  -- Tranches exist only for hydromet and geological hazards (IRR Rule V Sec. 2).
  new.tranche := case when coalesce(v_family, 'hydromet') in ('hydromet', 'geological')   -- unknown family: graduate (stricter)
                      then case when new.lead_hours > v_threshold * 24 then 'beyond_threshold' else 'within_threshold' end end;

  if new.source = 'ldrrmf_aa' then
    select * into v_year from public.aa_fund_years where fiscal_year = new.fiscal_year;
    if v_year.fiscal_year is null then
      raise exception 'Set the AA allocation for % before recording LDRRMF disbursements', new.fiscal_year using errcode = '23514';
    end if;
    if new.tranche is not null then
      select coalesce(sum(amount), 0) into v_used from public.aa_disbursements
       where fiscal_year = new.fiscal_year and source = 'ldrrmf_aa' and tranche = new.tranche and id <> new.id;
      v_limit := round(v_year.aa_allocation * public.aa_rule(case when new.tranche = 'beyond_threshold'
                       then 'tranche_beyond_max' else 'tranche_within_max' end), 2);
      if v_used + new.amount > v_limit then
        raise exception 'This would bring disbursements % a lead time of three (3) days to ₱%, above the ₱% limit (IRR Rule V Sec. 2).',
          case when new.tranche = 'beyond_threshold' then 'beyond' else 'within' end,
          to_char(v_used + new.amount, 'FM999,999,999,990.00'), to_char(v_limit, 'FM999,999,999,990.00') using errcode = '23514';
      end if;
    end if;
    select coalesce(sum(amount), 0) into v_total from public.aa_disbursements
     where fiscal_year = new.fiscal_year and source = 'ldrrmf_aa' and id <> new.id;
    if v_total + new.amount > v_year.aa_allocation then
      raise exception 'This would bring LDRRMF anticipatory action disbursements to ₱%, above the year''s allocation of ₱% (IRR Rule V Sec. 1(b)).',
        to_char(v_total + new.amount, 'FM999,999,999,990.00'), to_char(v_year.aa_allocation, 'FM999,999,999,990.00') using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create or replace function app.guard_aa_fund_year_used() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_beyond numeric; v_within numeric; v_total numeric;
begin
  select coalesce(sum(amount) filter (where tranche = 'beyond_threshold'), 0),
         coalesce(sum(amount) filter (where tranche = 'within_threshold'), 0),
         coalesce(sum(amount), 0)
    into v_beyond, v_within, v_total
  from public.aa_disbursements where fiscal_year = new.fiscal_year and source = 'ldrrmf_aa';
  if round(new.aa_allocation * public.aa_rule('tranche_beyond_max'), 2) < v_beyond
     or round(new.aa_allocation * public.aa_rule('tranche_within_max'), 2) < v_within
     or new.aa_allocation < v_total then
    raise exception 'The AA allocation cannot be lowered below what has been disbursed (₱% in all; ₱% beyond and ₱% within three (3) days).',
      to_char(v_total, 'FM999,999,999,990.00'), to_char(v_beyond, 'FM999,999,999,990.00'), to_char(v_within, 'FM999,999,999,990.00') using errcode = '23514';
  end if;
  return new;
end $$;
