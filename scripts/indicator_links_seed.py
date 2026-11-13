#!/usr/bin/env python3
"""Generate supabase/seed/parts/39_indicator_links.sql — "Where this is done in MODE" (1.21.0, ADR-036).

The mapping comes from the assessor's review of the EOC module against IAT v1-7 Part B_EOC
(14 Nov 2026, prepared for the 1-4 December validation workshop): for each B indicator, the
screen, Tool, protocol or workflow where the Recommended Action is done. It is embedded here
like the RACI mapping in raci_seed.py — links are navigation and evidence only and never change
a score, a threshold or an approval. The workshop flags are the workbook's own flags to settle
at the workshop (B2.6/B3.1 score-vs-evidence check; B1.2/B2.1-B2.4 documents in the Vault).

Ids are deterministic uuid5 against the same namespace as generate_seed.py / raci_seed.py.
Everything is insert-only: a re-run neither duplicates rows nor resets CDRRMO edits.

Usage: python3 scripts/indicator_links_seed.py
"""
from __future__ import annotations
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'supabase' / 'seed' / 'parts' / '39_indicator_links.sql'
NS = uuid.UUID('6f1c1d1e-0a0b-4c4d-9e8f-0123456789ab')   # same namespace as generate_seed.py

# (indicator, kind, target, label). kind: screen|tool (target is a route) or protocol|workflow
# (target is a protocol_templates code). Sorted output keeps the file deterministic.
LINKS: list[tuple[str, str, str, str]] = [
    # B1 Command and coordination
    ('B1.1', 'screen', '/library', 'Library — Annex 1-B, the proposed EO establishing the City EOC'),
    ('B1.1', 'screen', '/vault', 'Vault — file the signed Executive Order'),
    ('B1.2', 'screen', '/eoc', 'EOC Board — activation level (White/Blue/Red), set by the EOC Manager or Head'),
    ('B1.2', 'protocol', 'PR-EOC-ACTIVATE', 'PR-EOC-ACTIVATE — raising the EOC'),
    ('B1.2', 'protocol', 'PR-PDRA', 'PR-PDRA — Pre-Disaster Risk Assessment'),
    ('B1.3', 'protocol', 'PR-EOC-ACTIVATE', 'PR-EOC-ACTIVATE — escalation steps and authority'),
    ('B1.3', 'protocol', 'PR-EOC-DEACTIVATE', 'PR-EOC-DEACTIVATE — de-escalation and deactivation (SOP 4-09)'),
    ('B1.4', 'protocol', 'PR-ICS-INTERFACE', 'PR-ICS-INTERFACE — the five Memo 131 functions around the ICS'),
    ('B1.4', 'workflow', 'WF-CP-ACTIVATION', 'WF-CP-ACTIVATION — contingency-plan activation'),
    ('B1.4', 'screen', '/eoc/roster', 'EOC Roster — the five functions and their positions'),
    ('B1.5', 'protocol', 'PR-SITREP-CYCLE', 'PR-SITREP-CYCLE — the reporting cycle'),
    ('B1.5', 'screen', '/eoc/sitreps', 'SitReps — times by alert level, DILG VIII template and Excel export'),
    # B2 Site and facilities
    ('B2.1', 'screen', '/assess/hazard-maps', 'Hazard maps — overlay the primary and alternate EOC'),
    ('B2.1', 'screen', '/eoc/map', 'Geo-COP — the EOC location reference point'),
    ('B2.1', 'tool', '/tools/pscp', 'PSCP workbench — site screening entries'),
    ('B2.2', 'screen', '/vault', 'Vault — structural / seismic assessment and occupancy certificate'),
    ('B2.3', 'screen', '/eoc/resources', 'Resource inventory — generator / UPS and fuel stocks'),
    ('B2.3', 'screen', '/eoc-assessment', 'Capability checklist — equipment and test-log items'),
    ('B2.4', 'screen', '/vault', 'Vault — the floor plan against the Room Design sheet'),
    ('B2.4', 'screen', '/eoc-assessment', 'Capability checklist — Room Design section'),
    ('B2.5', 'screen', '/eoc/resources', 'Resource inventory — 72-hour water, food, hygiene and medical stock'),
    ('B2.6', 'screen', '/vault', 'Vault — access rules, IDs, visitor log and CCTV evidence'),
    ('B2.7', 'screen', '/eoc/map', 'Geo-COP — the alternate EOC reference point'),
    ('B2.7', 'screen', '/assess/hazard-maps', 'Hazard maps — screen the candidate alternate site'),
    ('B2.7', 'tool', '/tools/pscp', 'PSCP workbench — the "Alternate EOC (to be designated)" entry'),
    ('B2.7', 'tool', '/tools/ics', 'ICS Tool — the relocation drill scenario'),
    # B3 Communications and information
    ('B3.1', 'screen', '/eoc/log', 'Logbook — the weekly radio-check log category'),
    ('B3.1', 'screen', '/eoc-assessment', 'Capability checklist — communications items'),
    ('B3.2', 'screen', '/eoc/liaison', 'Barangay liaison — reporting and silent barangays (radio roll-call)'),
    ('B3.4', 'screen', '/library', 'Library — the dated directory annex (offices and positions)'),
    ('B3.4', 'screen', '/raci', 'RACI board — positions and offices, never personal names'),
    ('B3.5', 'screen', '/settings', 'Settings — named accounts, ten roles, audit log'),
    ('B3.6', 'screen', '/eoc/map', 'Geo-COP — the common operating picture for the display wall'),
    ('B3.6', 'screen', '/tools/echo/dashboard', 'ECHO dashboard — camp and evacuation feeds'),
    # B4 Organization and staffing
    ('B4.1', 'screen', '/eoc/roster', 'EOC Roster — the organogram in Manual Ch.5'),
    ('B4.1', 'screen', '/raci', 'RACI board — who is Responsible, Accountable, Consulted, Informed'),
    ('B4.2', 'screen', '/eoc/roster', 'EOC Roster — primary and two alternates per key position'),
    ('B4.2', 'workflow', 'WF-EOC-DESIGNATION', 'WF-EOC-DESIGNATION — designation and quarterly review'),
    ('B4.3', 'protocol', 'PR-DUTY-HANDOVER', 'PR-DUTY-HANDOVER — the shift handover form'),
    ('B4.3', 'protocol', 'PR-WARNING-RECEIPT', 'PR-WARNING-RECEIPT — receipt of warnings'),
    ('B4.4', 'screen', '/eoc/liaison', 'Barangay liaison — the barangay desks in this activation'),
    ('B4.4', 'screen', '/eoc/plans', 'Plans and clusters — agency desks per activated response cluster'),
    ('B4.5', 'screen', '/raci', 'RACI board — the position behind every job action sheet'),
    ('B4.6', 'screen', '/eoc/roster', 'EOC Roster — shift length and rest flags'),
    # B5 Information management
    ('B5.1', 'screen', '/eoc/sitreps', 'SitReps — DILG VIII harmonized template, numbered and locked'),
    ('B5.1', 'protocol', 'PR-SITREP-CYCLE', 'PR-SITREP-CYCLE — template and file naming'),
    ('B5.2', 'screen', '/eoc/barangays', 'Barangay status — reports with the cut-off and late flag'),
    ('B5.2', 'screen', '/eoc/liaison', 'Barangay liaison — who is silent, ranked by DDRiVE priority'),
    ('B5.3', 'screen', '/eoc/map', 'Geo-COP — incidents, evacuees and resources on the COP'),
    ('B5.3', 'workflow', 'WF-GEO-COP', 'WF-GEO-COP — maintaining the common operating picture'),
    ('B5.3', 'screen', '/tools/echo/dashboard', 'ECHO dashboard — evacuation and camp picture'),
    ('B5.4', 'screen', '/tools/echo/camps', 'ECHO camps — DAFAC-free aggregate counts per centre'),
    ('B5.5', 'screen', '/eoc/log', 'Logbook — the append-only significant-events log'),
    ('B5.6', 'protocol', 'PR-WARNING-RECEIPT', 'PR-WARNING-RECEIPT — time received'),
    ('B5.6', 'protocol', 'PR-WARNING-DISSEM', 'PR-WARNING-DISSEM — time disseminated'),
    ('B5.7', 'screen', '/eoc/log', 'Logbook — "public report — verified / unverified" category'),
    # B6 Logistics and resources
    ('B6.1', 'protocol', 'PR-ICS-INTERFACE', 'PR-ICS-INTERFACE — the ICS–EOC interface'),
    ('B6.1', 'tool', '/tools/ics', 'ICS Tool — exercise scenario on the interface'),
    ('B6.2', 'screen', '/eoc/requests', 'Requests — resource requests mapped to ICS 213 RR'),
    ('B6.2', 'protocol', 'PR-RESOURCE-REQUEST', 'PR-RESOURCE-REQUEST — request and tracking forms'),
    ('B6.3', 'screen', '/eoc/resources', 'Resource inventory — barangays, partners and suppliers'),
    ('B6.3', 'workflow', 'WF-SOP6-06', 'WF-SOP6-06 — resource management'),
    ('B6.3', 'workflow', 'WF-SOP6-12', 'WF-SOP6-12 — inventory and agreements'),
    ('B6.4', 'workflow', 'WF-SOP6-08', 'WF-SOP6-08 — donations and spontaneous volunteers'),
    ('B6.5', 'screen', '/eoc/sitreps', 'SitReps — briefing note from the latest SitRep'),
    ('B6.5', 'screen', '/eoc/log', 'Logbook — briefing times logged by alert level'),
    ('B6.6', 'screen', '/eoc/resources', 'Resource inventory — items, quantities and contacts'),
    ('B6.6', 'workflow', 'WF-SOP6-06', 'WF-SOP6-06 — signed agreement template'),
    ('B6.6', 'workflow', 'WF-SOP8-01', 'WF-SOP8-01 — mutual-aid agreement template'),
    # B7 Continuous improvement
    ('B7.1', 'screen', '/library', 'Library — the EOC Manual, approved by the CDRRMO Head'),
    ('B7.2', 'tool', '/tools/ics', 'ICS Tool — EOC Management and ICS courses; file the run as evidence'),
    ('B7.2', 'tool', '/tools/echo', 'ECHO simulator — camp-management training; file the run as evidence'),
    ('B7.3', 'tool', '/tools/ics', 'ICS Tool — the annual EOC functional exercise'),
    ('B7.3', 'tool', '/tools/echo', 'ECHO simulator — the annual evacuation exercise'),
    ('B7.3', 'protocol', 'PR-AAR', 'PR-AAR — the after-action review'),
    ('B7.4', 'protocol', 'PR-AAR', 'PR-AAR — actions for the improvement plan'),
    ('B7.4', 'workflow', 'WF-SOP7-05', 'WF-SOP7-05 — corrective action (CAPA) template'),
    ('B7.5', 'screen', '/vault', 'Vault — the LDRRMFIP with the EOC line'),
    ('B7.5', 'workflow', 'WF-BUDGET-CYCLE', 'WF-BUDGET-CYCLE — the budget cycle'),
    ('B7.6', 'screen', '/eoc-assessment', 'EOC capability assessment — the annual readiness self-check'),
    ('B7.6', 'tool', '/tools/pscp', 'PSCP workbench — preventive-maintenance mentions'),
]

# The workbook's own flags to settle at the workshop (spec 70-73). Content only; no score logic.
FLAGS: list[tuple[str, str]] = [
    ('B2.6', 'CHECK — score 3 vs evidence; settle at workshop'),
    ('B3.1', 'CHECK — score 3 vs evidence; settle at workshop'),
    ('B1.2', 'Score 3 holds only if the named documents are filed in the Vault'),
    ('B2.1', 'Score 3 holds only if the named documents are filed in the Vault'),
    ('B2.2', 'Score 3 holds only if the named documents are filed in the Vault'),
    ('B2.3', 'Score 3 holds only if the named documents are filed in the Vault'),
    ('B2.4', 'Score 3 holds only if the named documents are filed in the Vault'),
]


def uid(*parts: str) -> str:
    return str(uuid.uuid5(NS, '/'.join(parts)))


def sql(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main() -> None:
    rows = sorted(LINKS, key=lambda r: (r[0], r[1], r[2]))
    assert len({(i, k, t) for i, k, t, _ in rows}) == len(rows), 'duplicate link'
    assert all(i.startswith('B') for i, *_ in rows), 'links here cover Part B_EOC indicators'
    link_values = ','.join(
        f"({sql(uid('iat-link', i, k, t))}::uuid,{sql(i)},{sql(k)},{sql(t)},{sql(label)},{n})"
        for n, (i, k, t, label) in enumerate(rows, 1))
    flag_values = ','.join(f"({sql(i)},{sql(f)})" for i, f in sorted(FLAGS))

    out = f"""-- GENERATED by scripts/indicator_links_seed.py from the 14 Nov 2026 EOC-module assessment — do not edit by hand.
-- "Where this is done in MODE" links and the workshop flags (1.21.0, ADR-036). Navigation and evidence
-- only: a link or a flag never changes a score, a threshold or an approval. Insert-only, so a re-run
-- neither duplicates rows nor resets CDRRMO edits. Run after parts 01-38. Safe to run again.
begin;

insert into public.iat_indicator_links (id,indicator_id,target_kind,target,label,sort) values
{link_values}
on conflict do nothing;

insert into public.iat_workshop_flags (indicator_id,flag) values
{flag_values}
on conflict (indicator_id) do nothing;

commit;
"""
    OUT.write_text(out, encoding='utf-8')
    covered = sorted({i for i, *_ in rows})
    print(f'wrote {OUT} ({len(rows)} links over {len(covered)} indicators, {len(FLAGS)} workshop flags)')


if __name__ == '__main__':
    main()
