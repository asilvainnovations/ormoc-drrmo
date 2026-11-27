-- 1.33.0 (28 Nov 2026): EOC modules activated by contingency scenario (MOO Consolidated Draft 1.0, Figure 1.7),
-- family unity in evacuation centres, and contingency plan templates.
--
-- 1. contingency_plans.hazard_codes: the hazards a plan covers, so the EOC can suggest the plan for the hazard given
--    when the level was raised. A typhoon plan covers tropical cyclone, storm surge and flood (Figure 1.7 row 1);
--    the earthquake plan covers tsunami (local source). Extreme heat and disease are left without a mapping on purpose:
--    no plan covers extreme heat and the hazard list has no biological hazard.
-- 2. Flash flood (CP-FLASHFLOOD): Search, Rescue and Retrieval and Camp Coordination and Camp Management lead, Health
--    and Food and Non-Food Items on standby (decision 28 Nov 2026, for confirmation at the 1-4 Dec 2026 workshop).
--    CCCM is anchored on the six CSWD districts (District Camp Coordinators) and the City evacuation centres; SRR on
--    the CDRRMO rescue team deployed by district. Only rows still at the 1.9.0 seed value change; edits stay.
-- 3. Red -> Blue: modules and clusters that a plan seats only from Red go back to standby (Table 1.12: at Blue only
--    the EOC Manager, Planning, the PDRA and AA desk and the Logistics lead are seated). Before, they stayed "on".
-- 4. Activating an expired plan says so in the logbook (it said "not yet adopted"). The activation records whose
--    authority it acts on: under the NDRP the Responsible Official (the Mayor, as CDRRMC Chair) activates the City's
--    cluster counterparts, and NDRRMC Memorandum No. 131, s. 2018 sec. 9.2 has the Responsible Official approve EOC
--    activation. The EOC Manager or Head records it; the screen asks for the authority, the database logs it.
-- 5. Family unity (RA 10821 Sec. 4(d) and 6; JMC No. 02 s. 2021; CPMS 2019 Standard 13; IASC Disability Guidelines
--    2019): camp reports count separated and unaccompanied children, persons with disability or older persons apart
--    from their carer, and families not housed together. Counts only, never names (RA 10173).
-- Safe to run again.

-- --------------------------------------------------------------------------- 1. hazards a plan covers
alter table public.contingency_plans add column if not exists hazard_codes text[] not null default '{}';
comment on column public.contingency_plans.hazard_codes is
  'Hazards this plan covers (hazards.code). Used to suggest a plan when the EOC is raised for a hazard. 1.33.0.';

create or replace function app.guard_plan_hazard_codes() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare bad text;
begin
  select string_agg(h, ', ') into bad from unnest(new.hazard_codes) h where not exists (select 1 from public.hazards z where z.code = h);
  if bad is not null then
    raise exception 'Unknown hazard code(s) for this plan: %.', bad using errcode = '23503';
  end if;
  if new.hazard_code is not null and not (new.hazard_code = any (new.hazard_codes)) then
    new.hazard_codes := array_prepend(new.hazard_code, new.hazard_codes);
  end if;
  return new;
end $$;
drop trigger if exists guard_plan_hazard_codes on public.contingency_plans;
create trigger guard_plan_hazard_codes before insert or update on public.contingency_plans
  for each row execute function app.guard_plan_hazard_codes();

update public.contingency_plans p set hazard_codes = v.codes
  from (values ('CP-FLOOD-LUNOP', array['tropical_cyclone','storm_surge','flood']),
               ('CP-EARTHQUAKE',  array['earthquake','tsunami']),
               ('CP-FLASHFLOOD',  array['flash_flood']),
               ('CP-LANDSLIDE',   array['rain_landslide']),
               ('CP-DROUGHT',     array['drought']),
               ('CP-INDUSTRIAL',  array['industrial']),
               ('CP-DISEASE',     array[]::text[])) as v(code, codes)
 where p.code = v.code and p.hazard_codes <@ coalesce(array[p.hazard_code], '{}');

-- --------------------------------------------------------------------------- 2. flash flood lead clusters
update public.cp_activation_items i set state = 'lead',
       note = case i.item_code
         when 'CCCM' then 'Lead. Anchored on the six CSWD districts: each District Camp Coordinator runs the centres in that district. Current City centres: Dolores (District 1), Curva and Margen (District 2), Danhug (District 4). Families move and stay together.'
         else 'Lead. CDRRMO rescue team with BFP and partners, deployed by CSWD district so rescue, transport and centre intake match. Families are moved together.' end
  from public.contingency_plans p
 where p.id = i.plan_id and p.code = 'CP-FLASHFLOOD' and i.item_kind = 'cluster' and i.item_code in ('SRR','CCCM') and i.state = 'on';

-- --------------------------------------------------------------------------- 3. level change carries the plan; Blue re-applies min_level
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
      -- Up to Red: what the plan seats from Red switches on. Down to Blue: what the plan seats only from Red goes to
      -- standby (1.33.0). Anything the EOC Manager stood down stays stood down.
      insert into public.activation_clusters (activation_id, item_kind, item_code, state, changed_by)
      select v_new, c.item_kind, c.item_code,
             case when c.state = 'standby' and p_level = 'red' and i.state in ('on','lead') then i.state
                  when c.state in ('on','lead') and p_level = 'blue' and i.min_level = 'red' then 'standby'
                  else c.state end,
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

-- --------------------------------------------------------------------------- 4. plan activation wording
drop function if exists public.activate_contingency_plan(uuid);
create or replace function public.activate_contingency_plan(p_plan uuid, p_authority text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_a public.eoc_activations; v_p public.contingency_plans; v_state text;
        v_auth text := nullif(trim(coalesce(p_authority, '')), '');
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
  v_state := case v_p.status
    when 'adopted' then ''
    when 'expired' then format('. The plan expired%s; its activation set is used until a renewed plan is adopted',
                               coalesce(' on ' || to_char(v_p.valid_until, 'DD Mon YYYY'), ''))
    else '. The plan is not yet adopted; its activation set is a proposal' end
    || coalesce('. Authority: ' || left(v_auth, 200), '. Authority not recorded');
  insert into public.logbook_entries (activation_id, category, entry, author)
  values (v_a.id, 'decision', format('Contingency plan activated: %s (%s). %s cluster(s) and %s EOC module(s) set from the plan%s.',
          v_p.title, v_p.code,
          (select count(*) from public.cp_activation_items where plan_id = v_p.id and item_kind = 'cluster'),
          (select count(*) from public.cp_activation_items where plan_id = v_p.id and item_kind = 'module'),
          v_state),
          auth.uid());
  return v_a.id;
end $$;
grant execute on function public.activate_contingency_plan(uuid, text) to authenticated;
revoke execute on function public.activate_contingency_plan(uuid, text) from public, anon;

-- --------------------------------------------------------------------------- 5. family unity counts in camp reports
alter table public.camp_reports
  add column if not exists separated_children integer,
  add column if not exists unaccompanied_children integer,
  add column if not exists carer_separations integer,
  add column if not exists families_apart integer;

comment on column public.camp_reports.separated_children is
  'Children apart from their parents or usual caregiver but with another adult relative (CPMS 2019). Count only. 1.33.0.';
comment on column public.camp_reports.unaccompanied_children is
  'Children with no parent, caregiver or adult relative (RA 10821 Sec. 6; CPMS 2019). Count only; refer to the CSWDO. 1.33.0.';
comment on column public.camp_reports.carer_separations is
  'Persons with disability or older persons housed apart from the family member or carer who supports them. Count only. 1.33.0.';
comment on column public.camp_reports.families_apart is
  'Families whose members are not housed together in one space or centre. Count only. 1.33.0.';

alter table public.camp_reports drop constraint if exists camp_reports_family_unity_check;
alter table public.camp_reports add constraint camp_reports_family_unity_check check (
  coalesce(separated_children, 0) >= 0 and coalesce(unaccompanied_children, 0) >= 0
  and coalesce(carer_separations, 0) >= 0 and coalesce(families_apart, 0) >= 0
  and (children is null or coalesce(separated_children, 0) + coalesce(unaccompanied_children, 0) <= children)
  and (pwd is null and older is null or coalesce(carer_separations, 0) <= coalesce(pwd, 0) + coalesce(older, 0))
  and (families is null or coalesce(families_apart, 0) <= families));
