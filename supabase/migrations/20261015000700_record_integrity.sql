-- =============================================================================
-- 0007 RECORD INTEGRITY
-- Operators may close protocol steps and AA checklist items, but the text they
-- were given (the snapshot from the template) is part of the record and cannot
-- be rewritten by a client.
-- =============================================================================
create or replace function app.lock_run_step_snapshot() returns trigger
language plpgsql as $$
begin
  if new.run_id is distinct from old.run_id or new.step_id is distinct from old.step_id or new.seq is distinct from old.seq
     or new.instruction is distinct from old.instruction or new.is_critical is distinct from old.is_critical
     or new.requires_note is distinct from old.requires_note or new.due_at is distinct from old.due_at then
    raise exception 'Protocol steps keep the wording they had when the run started' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger lock_run_step_snapshot before update on public.protocol_run_steps
  for each row execute function app.lock_run_step_snapshot();

create or replace function app.lock_run_header() returns trigger
language plpgsql as $$
begin
  if new.template_id is distinct from old.template_id or new.template_rev is distinct from old.template_rev
     or new.started_at is distinct from old.started_at or new.started_by is distinct from old.started_by then
    raise exception 'The protocol and start time of a run cannot be changed' using errcode = '42501';
  end if;
  if old.status in ('completed', 'aborted') then
    raise exception 'This run is closed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger lock_run_header before update on public.protocol_runs
  for each row execute function app.lock_run_header();

create or replace function app.lock_aa_action_snapshot() returns trigger
language plpgsql as $$
begin
  if new.declaration_id is distinct from old.declaration_id or new.pdra_id is distinct from old.pdra_id
     or new.template_id is distinct from old.template_id or new.title is distinct from old.title
     or new.sector is distinct from old.sector or new.lead_office is distinct from old.lead_office
     or new.timing is distinct from old.timing then
    raise exception 'Checklist items keep the wording of the IRR template' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger lock_aa_action_snapshot before update on public.aa_actions
  for each row execute function app.lock_aa_action_snapshot();

-- Evidence keeps its link to the response it supports.
create or replace function app.lock_evidence_parent() returns trigger
language plpgsql as $$
begin
  if new.response_id is distinct from old.response_id then
    raise exception 'Evidence cannot be moved to another indicator. Record it again there.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger lock_evidence_parent before update on public.evidence
  for each row execute function app.lock_evidence_parent();
