# ADR-036: "Where this is done in MODE" — the indicator-to-MODE links map, workshop flags, and the Barangay liaison desk (v1.21.0)

Status: Proposed, 14 Nov 2026, by the lead assessor (Alvin M. Silva). For the CDRRMO Head.

## Context

The assessor's review of the EOC module against IAT v1-7 Part B_EOC (14 Nov 2026, for the 1–4 December validation workshop) found that only 21 of the 43 B indicators link to a protocol or workflow, and that the Liaison desk's name did not say what it is for (B4.4). The workbook itself also carries flags to settle at the workshop: B2.6 and B3.1 ("CHECK — score 3 vs evidence"), and B1.2, B2.1–B2.4 ("score 3 holds only if the named documents are filed in the Vault").

## Decision

1. **`iat_indicator_links`** (migration `20261114003100`): a versioned map from each indicator to the screen, Tool, protocol or workflow where its Recommended Action is done — screen/tool targets are routes, protocol/workflow targets are `protocol_templates` codes. Reads are reference data for every active user; the CDRRMO Head and the administrator maintain it online (RLS). Seeded insert-only from the assessment table (seed part 39, 81 links over 42 indicators — B3.3 has none because the platform itself, working offline, is the evidence). A link is navigation and evidence only: it never changes a score, a threshold or an approval.
2. **Rendered in three places**: a "Where this is done in MODE" section on each Assess indicator page, the same links in the capability-board item drawer via each item's `iat_links`, and the workshop flags as amber chips on the indicator page, the capability board rows and the drawer. The flags live in `iat_workshop_flags` — seeded content only, no score logic anywhere.
3. **The Liaison desk is renamed "Barangay liaison"** (tab label; the page was already the Barangay Liaison Desk), and Plans and clusters now lists the **agency desks** — the lead agency of every activated response cluster — under "This activation" (WF-CP-ACTIVATION, B4.4).

## Consequences

- The registry-style database checks hold every link honest: every indicator id exists, every protocol/workflow target is a real template, every screen/tool target is a route.
- The workshop sees the workbook's own flags exactly where the evidence lives; nothing is decided for it.
