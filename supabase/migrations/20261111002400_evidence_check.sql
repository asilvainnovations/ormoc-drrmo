-- 1.13.0: Evidence validation status per indicator (IAT workbook v1-6, column V; audit 11 Nov 2026).
--
-- The workbook adds a validation control: after checking the cited document, record, observation
-- or test, the assessor marks the evidence Verified, Partially verified, Unverified or Missing
-- evidence. Every indicator starts "Pending validation". "Verified" means the evidence was
-- checked and supports the indicator; it does not by itself change the score (workbook Dashboard
-- note), so nothing here touches the score, the evidence gate or the response status.
--
-- Rules:
--   * Only the assessment team (assessor, validator, CDRRMO Head) records the check. A lead-office
--     focal can score its own Part C items but cannot verify its own evidence.
--   * Who and when are stamped by the server; values sent by a device are ignored.
--   * A validated response stays locked to validators (guard_response_workflow), and closed
--     cycles stay read-only (guard_closed_cycle), for this field as for every other.
-- Safe to run again.

alter table public.responses add column if not exists evidence_check text not null default 'pending';
alter table public.responses add column if not exists evidence_checked_by uuid references public.profiles(id);
alter table public.responses add column if not exists evidence_checked_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'responses_evidence_check_values') then
    alter table public.responses add constraint responses_evidence_check_values
      check (evidence_check in ('pending', 'verified', 'partially_verified', 'unverified', 'missing'));
  end if;
end $$;

comment on column public.responses.evidence_check is
  'IAT v1-6 Evidence Validation Status: pending | verified | partially_verified | unverified | missing. Does not change the score.';

create or replace function app.stamp_evidence_check() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Unchanged: keep the server's stamps, whatever the device sent.
  if tg_op = 'UPDATE' and new.evidence_check is not distinct from old.evidence_check then
    new.evidence_checked_by := old.evidence_checked_by;
    new.evidence_checked_at := old.evidence_checked_at;
    return new;
  end if;
  if tg_op = 'INSERT' and new.evidence_check = 'pending' then
    new.evidence_checked_by := null;
    new.evidence_checked_at := null;
    return new;
  end if;
  -- The check is being recorded or changed. SQL editor runs (no signed-in user) are allowed.
  if auth.uid() is not null
     and not app.has_any_role(array['assessor', 'validator', 'cdrrmo_head']::public.app_role[]) then
    raise exception 'Only the assessment team records whether the evidence was checked.' using errcode = '42501';
  end if;
  if new.evidence_check = 'pending' then
    new.evidence_checked_by := null;
    new.evidence_checked_at := null;
  else
    new.evidence_checked_by := auth.uid();
    new.evidence_checked_at := now();
  end if;
  return new;
end $$;

drop trigger if exists stamp_evidence_check on public.responses;
create trigger stamp_evidence_check before insert or update on public.responses
  for each row execute function app.stamp_evidence_check();
