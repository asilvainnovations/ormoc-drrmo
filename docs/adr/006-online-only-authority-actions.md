# ADR-006: Actions that carry legal authority require a live connection

Status: Accepted, 15 Oct 2026

## Context
Some actions have legal or operational effect the moment they happen: changing the EOC alert level, approving an SOP version, recording a declaration step or a fund disbursement, managing user roles. If such an action were queued offline and replayed hours later, the record would misstate when authority was exercised, or collide with a decision made meanwhile.

## Decision
- These actions call the server directly (`callOnline`) and fail fast with "Needs a connection" when offline. They are never put in the outbox.
- Operational capture (logbook, protocol steps, barangay figures, SitRep drafts, assessment answers) stays offline-capable.
- Server timestamps (`now()` in Manila time display) are the record of when the action happened.

## Consequences
- The EOC needs at least one connected device (SMART/Globe, or the City's VSAT/fibre) to change level. Protocol PR-EOC-ACTIVATE says to log the order in the paper logbook and enter it when connected if all links are down.
