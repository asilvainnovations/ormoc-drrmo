-- =============================================================================
-- 1.10.0 (8 Nov 2026) - SOP registry on every protocol and workflow (ADR-019).
--
-- The Manual gives every SOP the same control block: the controlling SOP text, the process owner, the
-- policy references, the IAT indicators it serves and the form each step is closed on (forms: migration
-- 20261106001700). This adds the first four to protocol_templates so the DRRM module shows them the same way
-- for every protocol and workflow, plus "kind":
--   protocol  an incident procedure run at the point of action (warning, EOC, anticipatory action, reporting, recovery)
--   workflow  a management cycle across offices over days or weeks (governance, planning, continuity ...)
-- Chapter 3 v1.0 adds four workflow categories: risk_information, risk_planning, contingency_planning, continuity.
--
-- Rules: indicator IDs must exist in iat_indicators; an approved template's registry fields are fixed like its
-- text (the CDRRMO Head reopens it to revise). Process owners are offices or positions, never personal names.
--
-- Supports MR-01 (actionable MOO), MR-14 (traceability). Indicators B7.1, A1.4 (documented procedures).
-- Safe to run again.
-- =============================================================================

alter table public.protocol_templates add column if not exists kind text;
alter table public.protocol_templates add column if not exists sop_ref text;
alter table public.protocol_templates add column if not exists process_owner text;
alter table public.protocol_templates add column if not exists policy_refs text[] not null default '{}';
alter table public.protocol_templates add column if not exists indicator_ids text[] not null default '{}';

update public.protocol_templates
   set kind = case when category in ('daily_operations','warning','eoc','anticipatory_action','reporting','recovery')
                   then 'protocol' else 'workflow' end
 where kind is null;
alter table public.protocol_templates alter column kind set default 'protocol';
alter table public.protocol_templates alter column kind set not null;

do $$ begin
  alter table public.protocol_templates add constraint protocol_templates_kind_check check (kind in ('protocol','workflow'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.protocol_templates add constraint protocol_templates_owner_len_check
    check (process_owner is null or length(process_owner) <= 200);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.protocol_templates add constraint protocol_templates_sop_ref_len_check
    check (sop_ref is null or length(sop_ref) <= 120);
exception when duplicate_object then null; end $$;

-- Categories: replace the check, whatever its current name, with the 1.10 list.
do $$ declare c text; begin
  for c in select conname from pg_constraint
            where conrelid = 'public.protocol_templates'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%daily_operations%' loop
    execute format('alter table public.protocol_templates drop constraint %I', c);
  end loop;
end $$;
alter table public.protocol_templates add constraint protocol_templates_category_check check (category in (
  'daily_operations','warning','eoc','anticipatory_action','council','reporting','recovery',
  'governance','workforce','budget','response_clusters','geospatial',
  'risk_information','risk_planning','contingency_planning','continuity'));

comment on column public.protocol_templates.kind is 'protocol: incident procedure at the point of action; workflow: management cycle (ADR-019).';
comment on column public.protocol_templates.sop_ref is 'The controlling SOP text in the Manual, e.g. "SOP 3-1 (MOO Ch.3 v1.0)".';
comment on column public.protocol_templates.process_owner is 'Office or position accountable for the result. Never a personal name (RA 10173).';
comment on column public.protocol_templates.policy_refs is 'Legal and policy basis. The official text governs.';
comment on column public.protocol_templates.indicator_ids is 'IAT indicators this SOP serves (each must exist in iat_indicators).';

-- Guard: same authority rules as 1.7.0 (record_integrity_2), plus the registry fields and indicator check.
create or replace function app.guard_protocol_template() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare bad text;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  select string_agg(x, ', ') into bad
    from unnest(coalesce(new.indicator_ids, '{}')) x
   where not exists (select 1 from public.iat_indicators i where i.id = x);
  if bad is not null then
    raise exception 'Unknown IAT indicator(s): %', bad using errcode = '23503';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' and not app.has_role('cdrrmo_head') then
      raise exception 'A new protocol starts as a draft. Only the CDRRMO Head approves it.' using errcode = '42501';
    end if;
    new.template_rev := 1;
    return new;
  end if;
  new.template_rev := old.template_rev;        -- moved only by the step trigger
  if new.status is distinct from old.status and not app.has_role('cdrrmo_head') then
    raise exception 'Only the CDRRMO Head can approve, retire or reopen a protocol.' using errcode = '42501';
  end if;
  if old.status <> 'draft' and new.status = old.status
     and row(new.code, new.title, new.purpose, new.trigger_text, new.document_id, new.owner_role, new.category,
             new.kind, new.sop_ref, new.process_owner, new.policy_refs, new.indicator_ids)
         is distinct from row(old.code, old.title, old.purpose, old.trigger_text, old.document_id, old.owner_role, old.category,
             old.kind, old.sop_ref, old.process_owner, old.policy_refs, old.indicator_ids) then
    raise exception 'This protocol is %. Its text is fixed; the CDRRMO Head sets it back to draft to revise it.', old.status
      using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_protocol_template on public.protocol_templates;
create trigger guard_protocol_template before insert or update on public.protocol_templates
  for each row execute function app.guard_protocol_template();

-- Traceability: which SOPs serve each indicator (read by the Library and the IAT screens).
drop view if exists public.v_indicator_sops;
create view public.v_indicator_sops with (security_invoker = true) as
select x.indicator_id, t.id as template_id, t.code, t.title, t.kind, t.sop_ref, t.process_owner, t.status
  from public.protocol_templates t, unnest(t.indicator_ids) as x(indicator_id)
 where t.status <> 'retired';
grant select on public.v_indicator_sops to authenticated;
