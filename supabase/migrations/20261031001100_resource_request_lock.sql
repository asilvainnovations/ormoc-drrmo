-- =============================================================================
-- 1.5.1: Lock resource requests once they are decided.
--
-- Before this migration the only update guard was `before update of status`, and it
-- returned early when the status did not change. An approved request could therefore
-- be rewritten (10 sacks of rice became 5,000 generators and stayed approved), and the
-- lifecycle times (approved_at, mobilized_at, ...) could be set by any client.
--
-- After it:
--   * The request itself (party, item, quantity, unit, priority, needed by, links to
--     the activation and incident) can be corrected only while it is still
--     "requested". After approval or rejection it is fixed; a different need is a new
--     request.
--   * Fulfilment fields stay open while the request is being fulfilled: the assigned
--     resource until mobilisation, the decision note until delivery.
--   * Rejected and demobilised requests are closed: nothing changes.
--   * Who and when are the server's: created_by, created_at and requested_at never
--     move, and the lifecycle times are set only by the status change that owns them.
--   * A request time sent from a device is accepted only from the last 24 hours (an
--     entry made offline and sent later), as for declarations.
--   * Requests are never deleted.
--
-- Supports MR-08 (resources, logistics) and MR-07 (reporting). Safe to run again.
-- =============================================================================

create or replace function app.lock_resource_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  facts_changed boolean;
begin
  -- Who and when never move.
  new.created_by   := old.created_by;
  new.created_at   := old.created_at;
  new.requested_at := old.requested_at;

  -- Lifecycle times belong to the status change that sets them
  -- (app.guard_resource_request stamps the one for the new status).
  if new.status is distinct from old.status then
    if new.status <> 'approved'    then new.approved_at    := old.approved_at;    end if;
    if new.status <> 'mobilized'   then new.mobilized_at   := old.mobilized_at;   end if;
    if new.status <> 'delivered'   then new.delivered_at   := old.delivered_at;   end if;
    if new.status <> 'demobilized' then new.demobilized_at := old.demobilized_at; end if;
  else
    new.approved_at    := old.approved_at;
    new.mobilized_at   := old.mobilized_at;
    new.delivered_at   := old.delivered_at;
    new.demobilized_at := old.demobilized_at;
  end if;

  -- Closed requests.
  if old.status in ('rejected', 'demobilized') then
    if row(new.activation_id, new.incident_id, new.requesting_party, new.item, new.quantity, new.unit,
           new.priority, new.needed_by, new.status, new.resource_id, new.decision_note)
       is distinct from
       row(old.activation_id, old.incident_id, old.requesting_party, old.item, old.quantity, old.unit,
           old.priority, old.needed_by, old.status, old.resource_id, old.decision_note) then
      raise exception 'This request is % and closed. Record a new request instead.',
        case old.status when 'rejected' then 'rejected' else 'demobilised' end using errcode = '42501';
    end if;
    return new;
  end if;

  -- The request itself is fixed once it has been decided.
  facts_changed :=
    row(new.activation_id, new.incident_id, new.requesting_party, new.item, new.quantity, new.unit,
        new.priority, new.needed_by)
    is distinct from
    row(old.activation_id, old.incident_id, old.requesting_party, old.item, old.quantity, old.unit,
        old.priority, old.needed_by);
  if facts_changed and old.status <> 'requested' then
    raise exception 'An approved request cannot be changed. Record a new request for a different item or quantity.'
      using errcode = '42501';
  end if;

  -- Fulfilment fields.
  if new.resource_id is distinct from old.resource_id and old.status not in ('requested', 'approved') then
    raise exception 'The assigned resource is fixed once the request is mobilised.' using errcode = '42501';
  end if;
  if new.decision_note is distinct from old.decision_note and old.status = 'delivered' then
    raise exception 'The note is fixed once the request is delivered.' using errcode = '42501';
  end if;

  return new;
end $$;

-- Fires on every update, whatever columns the client sends. Trigger names sort after
-- guard_resource_request, so the lifecycle time it stamps is already set here.
drop trigger if exists lock_resource_request on public.resource_requests;
create trigger lock_resource_request before update on public.resource_requests
  for each row execute function app.lock_resource_request();

-- A request time from a device is accepted only from the last 24 hours, and never
-- from the future (more than 5 minutes ahead); otherwise the server's time is used.
-- Same rule as the declaration clocks (migration 0009 section 6).
create or replace function app.guard_resource_request_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.approved_at := null; new.mobilized_at := null; new.delivered_at := null; new.demobilized_at := null;
  if new.requested_at is null
     or new.requested_at < now() - interval '24 hours'
     or new.requested_at > now() + interval '5 minutes' then
    new.requested_at := now();
  end if;
  if new.status <> 'requested' then
    if auth.uid() is not null and not (new.status in ('approved','rejected')
        and app.has_any_role(array['eoc_manager','cdrrmo_head']::public.app_role[])) then
      raise exception 'A new request starts as requested. The EOC Manager approves it.' using errcode = '42501';
    end if;
    if new.status = 'approved' then new.approved_at := now(); end if;
  end if;
  return new;
end $$;

-- Never deleted. RLS already has no delete policy; this also removes the default
-- table grant a Supabase project gives the API roles.
revoke delete on public.resource_requests from anon, authenticated;
