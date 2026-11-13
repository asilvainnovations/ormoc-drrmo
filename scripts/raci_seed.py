#!/usr/bin/env python3
"""Generate supabase/seed/parts/37_raci.sql — the RACI board seed (1.19.0, ADR-033).

Transcribes MOO Annex 1-F (Integrated RACI Accountability Framework, matrices 6.1-6.5)
verbatim — including cell qualifiers and footnote caveats — plus the DOC matrix for the
manual document review cycle, which mirrors the platform's enforced review/approve guards.

Ids are deterministic uuid5 against the same namespace as generate_seed.py. A re-run updates
matrix titles only; activities are insert-only, and assignments are seeded only for activities
that have none, so the CDRRMO Head's edits and removals are never reset.
Template links point at protocol/workflow ids as uuid5(NS, 'protocol/<CODE>').
"""
import re
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'supabase' / 'seed' / 'parts' / '37_raci.sql'
NS = uuid.UUID('6f1c1d1e-0a0b-4c4d-9e8f-0123456789ab')   # same namespace as generate_seed.py


def uid(*parts: str) -> str:
    return str(uuid.uuid5(NS, '/'.join(parts)))


def sql(s: str | None) -> str:
    return 'null' if s is None else "'" + s.replace("'", "''") + "'"


# Cell grammar: "A", "R", "C", "I", "A/R", "R/C", "R (documentation)", "A, where legally authorized",
# "A*", "R**", "A/R within mandate", "As prescribed by law" (skipped — moved to the activity note),
# "" (no assignment).
DUTY_HEAD = re.compile(r'^([RACI](?:/[RACI])*)\b')


def parse_cell(cell: str) -> tuple[list[str], str | None, bool]:
    """Return (duties, qualifier, legal_caveat)."""
    cell = cell.strip().rstrip('*').strip()
    if not cell or cell.lower().startswith('as prescribed'):
        return [], None, True
    qualifier = None
    if '(' in cell:
        cell, rest = cell.split('(', 1)
        qualifier = rest.rstrip(')').strip()
        cell = cell.strip()
    if ',' in cell:  # "A, where legally authorized"
        cell, q2 = cell.split(',', 1)
        qualifier = (qualifier + '; ' if qualifier else '') + q2.strip()
        cell = cell.strip()
    duties: list[str] = []
    m = DUTY_HEAD.match(cell)
    if m:
        duties = m.group(1).split('/')
        rest = cell[m.end():].strip(' /')  # trailing words: "within mandate", "for executive transmittal"
        if rest:
            qualifier = (qualifier + '; ' if qualifier else '') + rest
    return duties, qualifier, False


MATRICES: list[dict] = [
    {
        'code': '6.1', 'title': 'CDRRMC Governance RACI', 'sort': 1,
        'actors': ['City Mayor', 'CDRRMC', 'CDRRMO Secretariat', 'City offices', 'CSO / private sector'],
        'rows': [
            ('Convene regular CDRRMC meeting', ['A', 'C', 'R', 'I', 'I'], None, 'PR-CDRRMC-MEETING'),
            ('Prepare agenda and technical briefs', ['I', 'C', 'A/R', 'C', 'C'], None, None),
            ('Review Local DRRM Plan', ['I', 'A', 'R', 'R', 'C'], None, None),
            ('Integrate DRRM into local plans and investment programming', ['I', 'C', 'R', 'A/R', 'C'],
             'Each office remains accountable for its own statutory planning and technical functions. CPDO retains its role in local development and land use planning; CDRRMO provides DRRM risk information and technical integration support.', None),
            ('Adopt CDRRMC resolutions', ['I', 'A/R', 'R (documentation)', 'C', 'C'], None, None),
            ('Monitor Council decisions', ['I', 'A', 'R', 'R', 'I'], None, None),
            ('Update membership and focal persons', ['A', 'C', 'R', 'C', 'C'], None, None),
            ('Conduct annual governance review', ['A', 'R', 'R', 'R', 'C'], None, None),
            ('Recommend State of Calamity', ['I', 'A/R', 'R (technical consolidation)', 'C', 'I'], None, 'PR-SOC-DECLARE'),
            ('Recommend State of Imminent Disaster through the legally required channel', ['A', 'R/C', 'R (technical support)', 'C', 'I'],
             'The exact SID recommendation route must be aligned with Republic Act No. 12287 and its IRR. The matrix must be revised if the certified legal text assigns the recommendation to a regional or other competent authority. The City Mayor\u2019s declaration authority is not a substitute for that prerequisite.', 'PR-SOID-REQUEST'),
        ],
    },
    {
        'code': '6.2', 'title': 'CDRRMO\u2013EOC Operational RACI', 'sort': 2,
        'actors': ['City Mayor', 'CDRRMO', 'EOC Manager / team', 'Barangays', 'Technical offices / response agencies'],
        'rows': [
            ('Routine risk monitoring', ['I', 'A', 'R', 'R', 'C'], None, None),
            ('EOC duty roster', ['I', 'A', 'R', 'I', 'C'], None, 'WF-EOC-DESIGNATION'),
            ('Recommend EOC activation', ['I', 'A/R', 'R', 'C', 'C'], None, 'PR-EOC-ACTIVATE'),
            ('Approve EOC activation under protocol', ['A', 'R', 'I', 'I', 'I'], None, 'PR-EOC-ACTIVATE'),
            ('Maintain common operating picture', ['I', 'A', 'R', 'R', 'R'], None, 'WF-GEO-COP'),
            ('Validate sectoral technical information', ['I', 'C', 'R (consolidation)', 'C', 'A/R within mandate'], None, None),
            ('Issue authorized public warnings', ['A', 'R', 'R (dissemination)', 'R (local relay)', 'C'],
             'The authorized technical agency or designated official retains responsibility for the content and issuance of warnings according to the relevant warning system. The City coordinates local dissemination and protective instructions.', 'PR-WARNING-DISSEM'),
            ('Resource request consolidation', ['I', 'A', 'R', 'R', 'R'], None, 'PR-RESOURCE-REQUEST'),
            ('Approve expenditure / procurement', ['A', 'C', 'I', 'I', 'R'],
             'Approval and execution depend on the specific budget, procurement, accounting, property and delegated-authority rules. The City Mayor is not automatically the approving authority for every transaction.', 'PR-EMERGENCY-PROCURE'),
            ('Field incident command', ['I', 'C', 'I/C', 'C', 'A/R (Incident Commander)'], None, 'PR-ICS-INTERFACE'),
            ('Situation reporting', ['I', 'A', 'R', 'R', 'R'], None, 'PR-SITREP-CYCLE'),
            ('EOC deactivation recommendation', ['I', 'A/R', 'R', 'C', 'C'], None, 'PR-EOC-DEACTIVATE'),
            ('EOC records closure', ['I', 'A', 'R', 'C', 'C'], None, None),
        ],
    },
    {
        'code': '6.3', 'title': 'State of Calamity RACI', 'sort': 3,
        'actors': ['CDRRMC', 'CDRRMO', 'EOC', 'Technical offices', 'Mayor', 'SP'],
        'rows': [
            ('Initial incident reporting', ['I', 'C', 'R', 'R', 'I', 'I'], None, None),
            ('Activate assessment coordination', ['I', 'A/R', 'C', 'R', 'I', 'I'], None, 'PR-PDNA'),
            ('Conduct sectoral assessments', ['I', 'C', 'C', 'A/R within mandate', 'I', 'I'], None, 'PR-PDNA'),
            ('Consolidate damage and needs assessment', ['C', 'A/R', 'R', 'R', 'I', 'I'], None, 'PR-PDNA'),
            ('Deliberate on recommendation', ['A/R', 'R (technical support)', 'C', 'C', 'I', 'I'], None, None),
            ('Transmit recommendation', ['C', 'R', 'I', 'I', 'A/R for executive transmittal', 'I'], None, None),
            ('Declare State of Calamity', ['R (recommendation)', 'C', 'I', 'C', 'I', 'A'], None, 'PR-SOC-DECLARE'),
            ('Implement authorized measures', ['C', 'R (coordination)', 'R (tracking)', 'A/R within mandate', 'A (executive coordination)', 'I'], None, None),
            ('Monitor and report', ['C', 'A', 'R', 'R', 'I', 'I'], None, 'PR-SITREP-CYCLE'),
            ('Recommend lifting', ['A/R', 'R', 'C', 'C', 'I', 'I'], None, None),
            ('Lift State of Calamity', ['R (recommendation)', 'C', 'I', 'C', 'I', 'A'], None, None),
        ],
    },
    {
        'code': '6.4', 'title': 'State of Imminent Disaster RACI', 'sort': 4,
        'actors': ['Recommending authority', 'Mayor', 'CDRRMC', 'CDRRMO', 'EOC', 'Technical offices / barangays'],
        'rows': [
            ('Monitor official forecasts', ['I', 'I', 'I', 'A', 'R', 'R'], None, None),
            ('Initial threat screening', ['I', 'I', 'C', 'A', 'R', 'C'], None, None),
            ('Convene PDRA', ['I', 'I', 'C', 'A/R', 'R', 'R'], None, 'PR-PDRA'),
            ('Conduct sectoral impact assessment', ['I', 'I', 'C', 'C', 'C', 'A/R within mandate'], None, None),
            ('Develop Anticipatory Action Matrix', ['C', 'I', 'C', 'A/R', 'R', 'R'], None, None),
            ('Review local recommendation', ['As prescribed by law', 'I', 'R/C', 'R', 'C', 'C'],
             'The recommending authority acts as prescribed by law.', None),
            ('Make statutory recommendation', ['A/R, if prescribed by law', 'I', 'C', 'R (technical support)', 'I', 'C'], None, None),
            ('Declare State of Imminent Disaster by Executive Order', ['C', 'A', 'I', 'C', 'I', 'I'], None, 'PR-SOID-REQUEST'),
            ('Implement assigned anticipatory actions', ['I', 'A (executive coordination)', 'C', 'R (coordination)', 'R (tracking)', 'A/R within mandate'], None, None),
            ('Track actions and resources', ['I', 'I', 'C', 'A', 'R', 'R'], None, 'PR-AA-FUNDS'),
            ('Recommend lifting / termination', ['As prescribed by law', 'I', 'C', 'R', 'C', 'C'],
             'The recommending authority acts as prescribed by law.', None),
            ('Issue lifting instrument', ['C', 'A, where legally authorized', 'I', 'R (technical support)', 'I', 'I'], None, None),
            ('Prepare post-lifting report', ['As prescribed by law', 'I', 'C', 'A/R', 'R', 'R'],
             'The recommending authority acts as prescribed by law.', 'PR-LIFT-REPORT'),
        ],
    },
    {
        'code': '6.5', 'title': 'Cross-office institutional interface RACI', 'sort': 5,
        # Matrix 6.5 names the accountable lead, the CDRRMO role and supporting offices;
        # duties are read as A (lead), R (CDRRMO coordination), C (supporting offices).
        'actors': ['Accountable lead', 'CDRRMO', 'Supporting offices / partners'],
        'rows': [
            ('CLUP and CDP risk integration', ['A (CPDO / authorized planning authority)', 'R (provides risk data and technical review)', 'C (City offices, barangays, CDRRMC)'], None, None),
            ('Hazard, exposure and vulnerability information', ['A (competent technical data owners, coordinated through CDRRMO)', 'R (coordinates consolidation and use in DRRM planning)', 'C (MGB, PAGASA, PHIVOLCS, CPDO, barangays, other agencies)'], None, None),
            ('Critical facility safety assessment', ['A (relevant engineering / building authority)', 'R (coordinates prioritization based on risk)', 'C (City Engineering, OBO, facility owners)'], None, None),
            ('Watershed and ecosystem management', ['A (CENRO / competent environmental authority)', 'R (integrates ecosystem risk into DRRM plans)', 'C (DENR, barangays, community organizations)'], None, None),
            ('Public health emergency preparedness', ['A (CHO / competent health authority)', 'R (coordinates EOC and multi-sector support)', 'C (hospitals, DOH, health facilities)'], None, None),
            ('School safety and continuity', ['A (DepEd / competent education authority)', 'R (coordinates risk information and emergency interface)', 'C (school heads, barangays, CHO)'], None, None),
            ('Agriculture and fisheries risk management', ['A (City Agriculture / Veterinary Office)', 'R (integrates sectoral risk and response information)', 'C (BFAR, DA, farmers\u2019 and fishers\u2019 organizations)'], None, None),
            ('Business continuity', ['A (relevant business owners / competent economic office)', 'R (facilitates coordination and continuity planning)', 'C (Chamber of Commerce, DTI, utilities)'], None, None),
            ('Lifeline continuity', ['A (respective utility or service provider)', 'R (coordinates status reporting and resource support)', 'C (water, power, telecom and transport providers)'], None, None),
            ('Social protection and evacuation assistance', ['A (CSWDO / competent social welfare authority)', 'R (coordinates risk information and EOC tracking)', 'C (barangays, health offices, DSWD, CSOs)'], None, None),
            ('Local infrastructure recovery', ['A (relevant implementing office)', 'R (coordinates risk-informed recovery monitoring)', 'C (CPDO, City Engineering, utilities, national agencies)'], None, None),
        ],
    },
    {
        'code': 'DOC', 'title': 'Manual document review and approval', 'sort': 6,
        'source': 'MODE platform governance (migrations 0003, 0014; ADR-004)',
        'actors': ['Author', 'Lead office focal', 'Validator', 'CDRRMO Head', 'Manual users'],
        'rows': [
            ('Draft or revise a manual document version', ['R', 'C', 'I', 'A', 'I'], None, None),
            ('Submit a draft for review', ['R', 'I', 'I', 'A', 'I'], None, None),
            ('Review and validate the draft against the Manual and IAT evidence', ['C', 'C', 'R', 'A', 'I'], None, None),
            ('Approve and publish (locks the version)', ['I', 'I', 'I', 'A/R', 'I'],
             'Approved versions are locked; the CDRRMO Head reopens a new draft to revise. Only the CDRRMO Head approves.', None),
            ('Return a draft to the author for changes', ['I', 'I', 'C', 'A/R', 'I'], None, None),
        ],
    },
]


def main() -> None:
    mats, acts, rows = [], [], []
    for m in MATRICES:
        mid = uid('raci/matrix', m['code'])
        source = m.get('source', 'MOO Annex 1-F')
        mats.append(f"({sql(uid('raci/matrix', m['code']))}::uuid,{sql(m['code'])},{sql(m['title'])},{sql(source)},{m['sort']})")
        for i, (activity, cells, note, tmpl) in enumerate(m['rows'], start=1):
            aid = uid('raci/activity', m['code'], activity)
            tid = f"{sql(uid('protocol', tmpl))}::uuid" if tmpl else 'null'
            acts.append(f"({sql(aid)}::uuid,{sql(mid)}::uuid,{sql(activity)},{sql(note)},{tid},null,{i})")
            for actor, cell in zip(m['actors'], cells):
                duties, qualifier, _ = parse_cell(cell)
                # Matrix 6.5 names the lead and the supporting offices inside the cell:
                # the actor is that office text, not the column header.
                if m['code'] == '6.5' and actor in ('Accountable lead', 'Supporting offices / partners') and qualifier:
                    actor, qualifier = qualifier, None
                for d in duties:
                    rows.append(
                        f"({sql(uid('raci/assignment', m['code'], activity, actor, d))}::uuid,"
                        f"{sql(aid)}::uuid,{sql(actor)},{sql(d)},{sql(qualifier)})")
    out = f"""-- GENERATED by scripts/raci_seed.py from reference/moo/Annex_1-F.md — do not edit by hand.
-- RACI board seed (1.19.0, ADR-033). Reference data only; actors are positions and bodies, never
-- personal names (RA 10173). Draft reference content for CDRRMO validation, like the Manual itself.
-- Run after parts 01-36. Safe to run again.
begin;

insert into public.raci_matrices (id,code,title,source_ref,sort) values
{','.join(mats)}
on conflict (id) do update set code = excluded.code, title = excluded.title, source_ref = excluded.source_ref, sort = excluded.sort;

-- Activities: insert-only. A re-run adds activities new to Annex 1-F and leaves existing rows,
-- including any the CDRRMO Head has edited, as they are.
insert into public.raci_activities (id,matrix_id,activity,note,template_id,sop_ref,sort) values
{','.join(acts)}
on conflict do nothing;

-- Assignments: seeded only for an activity that has none yet (a new activity, or a fresh board).
-- Once an activity has assignments the CDRRMO Head owns them: a re-run neither resets an edited
-- assignment nor brings back one the Head removed.
insert into public.raci_assignments (id,activity_id,actor,duty,qualifier)
select v.id, v.activity_id, v.actor, v.duty, v.qualifier
  from (values
{','.join(rows)}
  ) as v (id, activity_id, actor, duty, qualifier)
 where not exists (select 1 from public.raci_assignments x where x.activity_id = v.activity_id)
on conflict do nothing;

commit;
"""
    OUT.write_text(out, encoding='utf-8')
    print(f'wrote {OUT} ({len(mats)} matrices, {len(acts)} activities, {len(rows)} assignments)')


if __name__ == '__main__':
    main()
