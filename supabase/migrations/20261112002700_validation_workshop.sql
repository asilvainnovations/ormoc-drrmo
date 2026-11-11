-- 1.15.0 (12 Nov 2026): validation workshop (1-4 Dec 2026). Methodology v1.1 section 6.
--
-- 1. Who last set the score is recorded (responses.scored_by, stamped by the server).
-- 2. The person who last scored an indicator cannot validate it: assessor and validator are different people.
--    Responses loaded by the baseline seed have no recorded scorer, so any validator may validate them.
-- 3. Each validation records its decision: "confirmed" (score kept) or "revised" (validator changed the score or
--    the NA call in the same step). A revision needs a written reason (validation_note). The score sent for
--    validation is kept (score_before_validation), so assessor-validator agreement can be reported.
-- 4. v_validation_progress: per cycle and domain, how many indicators are draft, submitted, validated, confirmed,
--    revised, and how many have their evidence verified. Read-only; follows the reader's RLS.
-- Safe to run again.

alter table public.responses add column if not exists scored_by uuid references public.profiles(id);
alter table public.responses add column if not exists validation_decision text;
alter table public.responses add column if not exists validation_note text;
alter table public.responses add column if not exists score_before_validation smallint;
do $$ begin
  alter table public.responses add constraint responses_validation_decision_check
    check (validation_decision is null or validation_decision in ('confirmed', 'revised'));
exception when duplicate_object then null; end $$;

create or replace function app.guard_response_workflow() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_validating boolean := new.status = 'validated' and (tg_op = 'INSERT' or old.status <> 'validated');
  v_changed boolean := tg_op = 'UPDATE' and (new.score is distinct from old.score or new.is_na is distinct from old.is_na);
begin
  -- Server stamps the device cannot set: keep the stored values unless this step changes them.
  if tg_op = 'INSERT' then
    new.scored_by := case when auth.uid() is not null and (new.score is not null or new.is_na) then auth.uid()
                          when auth.uid() is null then new.scored_by else null end;
    if auth.uid() is not null then
      new.validation_decision := null; new.score_before_validation := null;
    end if;
  else
    new.scored_by := case when v_changed and auth.uid() is not null then auth.uid() else old.scored_by end;
    if auth.uid() is not null then
      new.validation_decision := old.validation_decision;
      new.score_before_validation := old.score_before_validation;
      if not v_validating then new.validation_note := old.validation_note; end if;
    end if;
  end if;

  if v_validating then
    if not app.has_any_role(array['validator','cdrrmo_head']::public.app_role[]) then
      raise exception 'Only a validator can validate a score' using errcode = '42501';
    end if;
    if new.score is null and not new.is_na then
      raise exception 'Score the indicator or mark it not applicable before validating' using errcode = '23514';
    end if;
    if tg_op = 'INSERT' then
      raise exception 'Submit the score for validation first: the person who scores an indicator cannot also validate it.'
        using errcode = '42501';
    end if;
    if old.scored_by is not null and old.scored_by = auth.uid() then
      raise exception 'You scored this indicator, so another validator must validate it (Methodology v1.1: assessor and validator are different people).'
        using errcode = '42501';
    end if;
    new.score_before_validation := old.score;
    new.validation_decision := case when v_changed then 'revised' else 'confirmed' end;
    new.validation_note := nullif(trim(coalesce(new.validation_note, '')), '');
    if v_changed and new.validation_note is null then
      raise exception 'Give the reason for changing the score when you validate it.' using errcode = '23514';
    end if;
    new.validated_by := auth.uid();
    new.validated_at := now();
  end if;
  if tg_op = 'UPDATE' and old.status = 'validated'
     and not app.has_any_role(array['validator','cdrrmo_head']::public.app_role[]) then
    raise exception 'This score is validated. Ask a validator to reopen it.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.status = 'validated' and new.status <> 'validated' then
    new.validated_by := null; new.validated_at := null;
    new.validation_decision := null; new.validation_note := null; new.score_before_validation := null;
  end if;
  return new;
end $$;

create or replace view public.v_validation_progress with (security_invoker = true) as
select c.id as cycle_id, d.part, i.domain,
       count(*)                                                          as indicators,
       count(*) filter (where r.id is null or r.status = 'draft')        as draft,
       count(*) filter (where r.status = 'provisional')                  as submitted,
       count(*) filter (where r.status = 'validated')                    as validated,
       count(*) filter (where r.validation_decision = 'confirmed')       as confirmed,
       count(*) filter (where r.validation_decision = 'revised')         as revised,
       count(*) filter (where r.evidence_check = 'verified')             as evidence_verified,
       count(*) filter (where r.id is null or r.evidence_check = 'pending') as evidence_pending
from public.assessment_cycles c
cross join public.iat_indicators i
join public.iat_domains d on d.code = i.domain
left join public.responses r on r.cycle_id = c.id and r.indicator_id = i.id
where i.is_active
group by c.id, d.part, i.domain;

revoke all on public.v_validation_progress from anon, public;
grant select on public.v_validation_progress to authenticated;
