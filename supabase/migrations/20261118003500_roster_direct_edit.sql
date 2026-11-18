-- 1.25.0: The EOC roster is the EOC's own contact list, so those who staff the EOC keep it directly.
-- Before: a designation started as a proposal, only the CDRRMO Head could approve it, an approved one was fixed, and it had to name
-- an office or an account. After: the CDRRMO Head, EOC Manager and EOC staff add, edit and withdraw designations themselves; the
-- designee can be just a name and position (and a contact in the note). The server still stamps who approved and when, keeps the
-- position and rank fixed, and keeps a withdrawn designation as a record. Work contacts only (RA 10173 data minimisation).
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.eoc_designations'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%person_id IS NOT NULL%office_id IS NOT NULL%'
  loop
    execute format('alter table public.eoc_designations drop constraint %I', c);
  end loop;
end $$;

create or replace function app.guard_eoc_designation() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin  -- roster edits are direct (1.25.0)
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    new.proposed_by := auth.uid();
    if new.status = 'approved' then new.approved_by := auth.uid(); new.approved_at := now();
    else new.approved_by := null; new.approved_at := null; end if;
    return new;
  end if;
  new.position_id := old.position_id; new.rank := old.rank; new.proposed_by := old.proposed_by;
  if old.status = 'withdrawn' then
    raise exception 'A withdrawn designation is kept as a record; add a new one' using errcode = '42501';
  end if;
  if new.status = 'approved' and old.status <> 'approved' then
    new.approved_by := auth.uid(); new.approved_at := now();
  elsif old.status = 'approved' then
    new.approved_by := old.approved_by; new.approved_at := old.approved_at;
  else
    new.approved_by := null; new.approved_at := null;
  end if;
  return new;
end $$;
