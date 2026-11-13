#!/usr/bin/env python3
"""Generate supabase/seed/parts/37_raci.sql — the RACI board seed (1.19.0, ADR-033).

Transcribes every RACI matrix of the consolidated Manual verbatim — including cell qualifiers
and footnote caveats: Annex 1-F (Integrated RACI Accountability Framework, matrices 6.1-6.5),
the chapter-level matrices of Chapters 1-8 (Ch.1 §8.3/§8.4, Ch.2 §2.16 and Table 2.5, Ch.3 §18,
Ch.4 Table 4.34 and Annex 4-B, Ch.5 Table 5.33 and Annex 5-B, Ch.6 Table 6.36, Ch.7 Table 7.34,
Ch.8 Table 8.28, Ch.9 Table 9.25, Ch.10 Table 10.20), plus the DOC matrix for the manual document
review cycle, which mirrors the platform's enforced review/approve guards. Chapter versions follow
the consolidated Manual Draft 1.0 (12 Nov 2026) chapter register.

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
    # "I / A where approval required" is a duty chain with spaces; join it so the second duty is not
    # mistaken for qualifier text.
    cell = re.sub(r'\b([RACI]) / ([RACI])\b', r'\1/\2', cell)
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
    {
        'code': 'CH1-GOV', 'title': 'Chapter 1 §8.3 — Master RACI Matrix: Institutional Governance', 'sort': 10,
        'source': 'MOO Chapter 1 v1.3 §8.3',
        'actors': ['City Mayor', 'Sangguniang Panlungsod', 'CDRRMC', 'CDRRMO', 'CDRRMO Secretariat', 'City Legal Office', 'HRMO / Finance', 'OCD / RDRRMC VIII'],
        'rows': [
            ('Establish CDRRMO through ordinance', ['I', 'A', 'C', 'R', 'I', 'C', 'C', 'I'], None, None),
            ('Prepare CDRRMC composition EO', ['A', 'I', 'C', 'R', 'R', 'C', 'I', 'I'], None, None),
            ('Maintain CDRRMC membership register', ['I', 'I', 'C', 'A', 'R', 'C', 'I', 'I'], None, None),
            ('Prepare CDRRMC agenda and meetings', ['I', 'I', 'A', 'C', 'R', 'I', 'I', 'I'], None, 'PR-CDRRMC-MEETING'),
            ('Document Council resolutions', ['I', 'I', 'A', 'C', 'R', 'C', 'I', 'I'], None, 'PR-CDRRMC-MEETING'),
            ('Monitor Council decisions', ['I', 'I', 'A', 'R', 'R', 'I', 'C', 'I'], None, None),
            ('Develop local DRRM policy', ['A', 'C', 'C', 'R', 'C', 'C', 'C', 'I'], None, None),
            ('Review proposed DRRM ordinances', ['C', 'I', 'C', 'R', 'I', 'A', 'C', 'C'], None, None),
            ('Prepare State of Calamity technical assessment', ['I', 'I', 'C', 'A', 'R', 'C', 'C', 'I'], None, None),
            ('Recommend State of Calamity', ['I', 'I', 'A', 'R', 'R', 'C', 'I', 'I'], None, 'PR-SOC-DECLARE'),
            ('Issue local State of Calamity declaration', ['I', 'A', 'R', 'C', 'I', 'C', 'I', 'I'], None, None),
            ('Prepare State of Imminent Disaster PDRA', ['I', 'I', 'C', 'A', 'I', 'C', 'C', 'C'], None, 'PR-PDRA'),
            ('Submit request to RDRRMC VIII', ['I', 'I', 'A', 'R', 'C', 'C', 'I', 'C'], None, 'PR-SOID-REQUEST'),
            ('Recommend regional State of Imminent Disaster Declaration', ['I', 'I', 'C', 'C', 'I', 'I', 'I', 'A/R*'], 'The RACI assignment for OCD/RDRRMC VIII reflects the regional recommendation function described in RA 12287. The exact responsible regional body and administrative sequence shall be finalized against the certified IRR and applicable regional procedures. The RACI matrix does not replace the statutory decision authority of the NDRRMC, regional councils, Mayor or Sanggunian.', None),
            ('Issue local State of Imminent Disaster EO', ['A', 'I', 'C', 'R', 'I', 'C', 'C', 'C'], None, 'PR-SOID-REQUEST'),
            ('Coordinate anticipatory action', ['A', 'I', 'C', 'R', 'I', 'C', 'R', 'C'], None, None),
            ('Prepare 45-day post-lifting report', ['I', 'I', 'C', 'A/R', 'C', 'C', 'R', 'I'], None, 'PR-LIFT-REPORT'),
            ('Maintain legal and policy register', ['I', 'I', 'I', 'A', 'R', 'C', 'I', 'I'], None, None),
            ('Conduct annual governance review', ['I', 'I', 'A', 'R', 'R', 'C', 'C', 'C'], None, None),
        ],
    },
    {
        'code': 'CH1-IF', 'title': 'Chapter 1 §8.4 — RACI Matrix: Institutional Interfaces', 'sort': 11,
        'source': 'MOO Chapter 1 v1.3 §8.4',
        'mode': 'stacked', 'col_duty': ['A', 'R', None],
        'note_suffix': 'This matrix ensures that the CDRRMO coordinates the overall resilience system without appropriating the mandates of other City offices (assessment Part C interface arrangements).',
        'actors': ['Accountable owner', 'Responsible actors', 'CDRRMO'],
        'rows': [
            ('CDRA and CLUP integration', ['CPDO', 'CPDO technical team', 'C / technical input'], None, None),
            ('DRR/CCA project screening', ['CPDO', 'CPDO, City Budget Office', 'C / risk validation'], None, None),
            ('Critical facility structural assessment', ['City Engineer / Building Official', 'Engineering and inspection teams', 'C / risk prioritization'], None, None),
            ('Utility continuity agreements', ['Relevant utility / designated City authority', 'Utility providers and City offices', 'R (for coordination, subject to approved mandate)'], None, None),
            ('Watershed and ecosystem monitoring', ['CENRO', 'CENRO, DENR and partners', 'C / DRRM integration'], None, None),
            ('Health anticipatory action', ['City Health Officer', 'CHO, hospitals and health partners', 'C / coordination'], None, None),
            ('Education anticipatory action', ['DepEd Schools Division', 'School DRRM coordinators', 'C / coordination'], None, None),
            ('Agriculture and fisheries early action', ['City Agriculture / Veterinary Office', 'CAO, CVO and relevant agencies', 'C / coordination'], None, None),
            ('Price monitoring', ['DTI / City Market Office', 'Market monitoring personnel', 'C / EOC information integration'], None, None),
            ('Business continuity outreach', ['CDRRMO Head', 'CDRRMO and Chamber of Commerce', 'A / R for DRRM outreach'], None, None),
        ],
    },
    {
        'code': 'CH2-ORG', 'title': 'Chapter 2 §16 — CDRRMO Organisation and Staffing RACI', 'sort': 12,
        'source': 'MOO Chapter 2 v1.3 §16',
        'mode': 'stacked', 'col_duty': ['A', 'R', 'C'],
        'actors': ['Accountable (A)', 'Responsible (R)', 'Consulted / Informed'],
        'rows': [
            ('Annual CDRRMO workforce plan', ['CDRRMO Head', 'Division chiefs; Administration and Training', 'HRMO; Budget; Mayor'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
            ('Review of organizational structure', ['City Mayor / authorized approving authority', 'CDRRMO Head; HRMO', 'CLO; Budget; DBM/CSC as applicable'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
            ('Position description preparation', ['CDRRMO Head', 'Immediate supervisor / division chief', 'HRMO; CLO where needed'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
            ('Qualification standards and recruitment administration', ['HRMO / authorized appointing authority', 'HRMO', 'CDRRMO Head; Budget; concerned division'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
            ('Annual training needs assessment', ['CDRRMO Head', 'Division chiefs; Administration and Training', 'HRMO; OCD; training providers; Budget'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
            ('Annual training plan and budget', ['CDRRMO Head', 'Administration and Training', 'HRMO; Budget; division chiefs'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
            ('Duty roster and internal handover', ['CDRRMO Head', 'Operations and Warning / designated supervisor', 'HRMO; division chiefs'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
            ('EOC primary and alternate nominations', ['Head of each participating office for its personnel', 'Office focal persons', 'CDRRMO; HRMO; EOC Manager'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
            ('EOC roster consolidation', ['CDRRMO Head', 'Designated EOC readiness focal person', 'Participating offices; HRMO; OCD'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
            ('Personnel safety and welfare system', ['City authority designated under City OSH / HR policy', 'HRMO; CHO; occupational safety focal persons; supervisors', 'CDRRMO; Budget; partner agencies'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
            ('Performance monitoring', ['CDRRMO Head', 'Division chiefs / immediate supervisors', 'HRMO; City performance management office'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
            ('Workforce records and privacy controls', ['HRMO for official personnel files; CDRRMO for operational records', 'Authorized records custodians', 'DPO; ICT; CLO'], 'The source column combines Consulted and Informed (Chapter 2 §2.16): each listed office is consulted or informed, and the CDRRMO Head confirms which duty applies at the validation workshop.', None),
        ],
    },
    {
        'code': 'CH2-BUDGET', 'title': 'Chapter 2 Table 2.5 — Budget-Cycle RACI for the LDRRMF Investment Plan (draft for validation)', 'sort': 13,
        'source': 'MOO Chapter 2 v1.3 §16.2',
        'mode': 'stacked', 'col_duty': ['R', 'A', 'C', 'I'],
        'actors': ['Responsible', 'Accountable', 'Consulted', 'Informed'],
        'rows': [
            ("Step 1 — Baseline: CDRA, LDRRMP results, last year's utilization", ['Research and Planning', 'CDRRMO Head', 'Operations and Warning; CPDO', 'CDRRMC'], 'Draft for validation at the 1–4 December 2026 workshop. The RACI gives Research and Planning the lead in formulation and keeps execution and audit controls with Administration and the City finance offices (closes IAT gaps A4.4 and A10.4).', 'WF-BUDGET-CYCLE'),
            ('Step 2 — Division needs and proposals', ['Each division', 'CDRRMO Head', 'Research and Planning', '—'], 'Draft for validation at the 1–4 December 2026 workshop. The RACI gives Research and Planning the lead in formulation and keeps execution and audit controls with Administration and the City finance offices (closes IAT gaps A4.4 and A10.4).', 'WF-BUDGET-CYCLE'),
            ('Step 3 — Draft LDRRMFIP: prioritized; tagged to LDRRMP/CDP PPA and thematic area; 70/30; AA line', ['Research and Planning', 'CDRRMO Head', 'Administration (costing); Budget Office', '—'], 'Draft for validation at the 1–4 December 2026 workshop. The RACI gives Research and Planning the lead in formulation and keeps execution and audit controls with Administration and the City finance offices (closes IAT gaps A4.4 and A10.4).', 'WF-BUDGET-CYCLE'),
            ('Step 4 — Costing, PPMP/APP and procurement plan', ['Administration', 'CDRRMO Head', 'Research and Planning', 'BAC'], 'Draft for validation at the 1–4 December 2026 workshop. The RACI gives Research and Planning the lead in formulation and keeps execution and audit controls with Administration and the City finance offices (closes IAT gaps A4.4 and A10.4).', 'WF-BUDGET-CYCLE'),
            ('Step 5 — CDRRMC approval, then SP adoption', ['Secretariat', 'CDRRMC; SP', 'Budget Office', 'DILG; OCD VIII'], 'Draft for validation at the 1–4 December 2026 workshop. The RACI gives Research and Planning the lead in formulation and keeps execution and audit controls with Administration and the City finance offices (closes IAT gaps A4.4 and A10.4).', 'WF-BUDGET-CYCLE'),
            ('Step 6 — Execution: obligation, procurement, disbursement', ['Administration', 'CDRRMO Head', 'Budget Office; Accountant; BAC', 'Research and Planning'], 'Draft for validation at the 1–4 December 2026 workshop. The RACI gives Research and Planning the lead in formulation and keeps execution and audit controls with Administration and the City finance offices (closes IAT gaps A4.4 and A10.4).', 'WF-BUDGET-CYCLE'),
            ('Step 7 — Quarterly report: results and finances', ['Research and Planning with Administration', 'CDRRMO Head', '—', 'CDRRMC'], 'Draft for validation at the 1–4 December 2026 workshop. The RACI gives Research and Planning the lead in formulation and keeps execution and audit controls with Administration and the City finance offices (closes IAT gaps A4.4 and A10.4).', 'WF-BUDGET-CYCLE'),
            ('Step 8 — Realignment or reallocation', ['Research and Planning', 'CDRRMC; SP concurrence', 'Administration; Accountant', 'Budget Office'], 'Draft for validation at the 1–4 December 2026 workshop. The RACI gives Research and Planning the lead in formulation and keeps execution and audit controls with Administration and the City finance offices (closes IAT gaps A4.4 and A10.4).', 'WF-BUDGET-CYCLE'),
        ],
    },
    {
        'code': 'CH2-MASTER', 'title': 'Chapter 2 §22.1 — Chapter 2 Master RACI', 'sort': 14,
        'source': 'MOO Chapter 2 v1.3 §22.1',
        'actors': ['CDRRMO Head', 'Division lead / supervisor', 'HRMO', 'Budget / Accounting', 'City Legal Office', 'Mayor / SP / appointing authority', 'DPO / OSH / Health'],
        'rows': [
            ('Annual workforce plan', ['A', 'R', 'R/C', 'C', 'C', 'I / A where approval required', 'C'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', None),
            ('Organizational / plantilla proposal', ['R', 'C', 'A/R', 'C', 'C', 'A where legally required', 'I'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', None),
            ('Position description / competency profile', ['A', 'R', 'R/C', 'I', 'C', 'I', 'C'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', None),
            ('Recruitment / selection administration', ['C', 'C', 'A/R', 'I', 'C', 'A for appointment', 'I'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', None),
            ('Onboarding and role induction', ['A', 'R', 'R', 'I', 'I', 'I', 'C'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', None),
            ('Training needs analysis / L&D plan', ['A', 'R', 'C', 'C', 'I', 'I / A for resources', 'C'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', None),
            ('Duty roster and handover', ['A', 'R', 'I', 'I', 'I', 'I', 'C'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', 'PR-DUTY-HANDOVER'),
            ('EOC personnel designation register', ['A', 'R', 'C', 'I', 'C', 'A if designation requires Mayor authority', 'C'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', 'WF-EOC-DESIGNATION'),
            ('Personnel safety / welfare response', ['A', 'R', 'R/C', 'C', 'C', 'I', 'R/C'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', None),
            ('Performance management', ['A', 'R', 'R/C', 'I', 'I', 'I', 'C'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', None),
            ('Personnel record access / sharing', ['A', 'R', 'A/R for HR records', 'I', 'C', 'I', 'A/R for privacy controls'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', None),
            ('CAPA and annual review', ['A', 'R', 'C', 'C', 'C', 'I / A for policy changes', 'C'], 'RACI interpretation (Chapter 2 §22.1): one Accountable (A) role is assigned per activity, except where a collective statutory or formal approval authority must be named explicitly; the matrix then distinguishes process accountability from the legal approving authority. HRMO remains the custodian and authority for official personnel administration; the CDRRMO owns operational requirements and role performance. The RACI matrix does not transfer appointing, disciplinary, budgetary or statutory powers.', None),
        ],
    },
    {
        'code': 'CH3-RISK', 'title': 'Chapter 3 §18 — Risk Intelligence and Planning RACI (proposed)', 'sort': 15,
        'source': 'MOO Chapter 3 v1.2 §18',
        'actors': ['CDRRMO', 'CPDO / LDC', 'Engineering / OBO / Zoning', 'Sector offices / utilities', 'Barangays', 'CLO / Mayor / CDRRMC'],
        'rows': [
            ('Maintain risk information register', ['A/R', 'C', 'C', 'R/C', 'C', 'I'], 'Proposed operational assignment; it must be validated by office heads and the City Legal Office. RACI clarifies work allocation; it does not transfer statutory or regulatory authority.', None),
            ('Acquire and validate hazard source data', ['R', 'C', 'C', 'A/R for own technical data', 'C', 'I'], 'Proposed operational assignment; it must be validated by office heads and the City Legal Office. RACI clarifies work allocation; it does not transfer statutory or regulatory authority.', None),
            ('Prepare CDRA', ['R/C', 'A', 'C', 'R', 'C', 'I'], 'Proposed operational assignment; it must be validated by office heads and the City Legal Office. RACI clarifies work allocation; it does not transfer statutory or regulatory authority.', None),
            ('Approve/use CDRA in CLUP/CDP', ['C', 'A/R', 'C', 'C', 'C', ''], 'Approval / oversight: Statutory approval route. Proposed operational assignment; it must be validated by office heads and the City Legal Office. RACI clarifies work allocation; it does not transfer statutory or regulatory authority.', None),
            ('Apply risk screening to investment proposals', ['C', 'A/R through planning process', 'R/C technical review', 'R proposal owner', 'C', ''], 'Approval / oversight: Budget/LFC/approving body. Proposed operational assignment; it must be validated by office heads and the City Legal Office. RACI clarifies work allocation; it does not transfer statutory or regulatory authority.', None),
            ('Prepare contingency plans', ['A/R', 'C', 'R/C', 'R hazard/sector lead', 'R local plan/action', ''], 'Approval / oversight: Approval per local issuance. Proposed operational assignment; it must be validated by office heads and the City Legal Office. RACI clarifies work allocation; it does not transfer statutory or regulatory authority.', 'WF-SOP3-06'),
            ('Prepare PSCP', ['R/C', 'C', 'C', 'A/R by department for own services', 'I/C where service interface', ''], 'Approval / oversight: Mayor/City Administrator approval. Proposed operational assignment; it must be validated by office heads and the City Legal Office. RACI clarifies work allocation; it does not transfer statutory or regulatory authority.', None),
            ('Prepare and approve BDRRMP', ['C/support', 'I/C', 'I', 'C', 'A/R under applicable law', ''], 'Approval / oversight: DILG technical guidance. Proposed operational assignment; it must be validated by office heads and the City Legal Office. RACI clarifies work allocation; it does not transfer statutory or regulatory authority.', None),
            ('Monitor ecosystem assets', ['C', 'C', 'I', 'A/R CENRO/DENR', 'C', 'I'], 'Proposed operational assignment; it must be validated by office heads and the City Legal Office. RACI clarifies work allocation; it does not transfer statutory or regulatory authority.', None),
            ('Review plan performance and corrective action', ['R/consolidates', 'R for planning integration', 'R for regulatory actions', 'R for own actions', 'R for own plans', ''], 'Approval / oversight: CDRRMC oversight. Proposed operational assignment; it must be validated by office heads and the City Legal Office. RACI clarifies work allocation; it does not transfer statutory or regulatory authority.', None),
        ],
    },
    {
        'code': 'CH4-EOC', 'title': 'Chapter 4 Table 4.34 — Proposed EOC and Incident Coordination RACI', 'sort': 16,
        'source': 'MOO Chapter 4 v1.2 §15',
        'actors': ['Mayor / CDRRMC', 'CDRRMO Head', 'Operations and Warning', 'EOC Manager / sections', 'IC / IMT', 'Sector offices / utilities', 'Barangays'],
        'rows': [
            ('Routine monitoring and warning receipt', ['I', 'A', 'R', 'I', 'I', 'C', 'C'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', 'PR-WARNING-RECEIPT'),
            ('Technical warning interpretation', ['I', 'A', 'R/C', 'C', 'C', 'R/C source owners', 'C'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', None),
            ('Warning-action recommendation', ['A where executive decision required', 'A/R technical process', 'R', 'C', 'C', 'C', 'C'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', None),
            ('Approval of evacuation / public protective action', ['A per law/issuance', 'R/C recommendation', 'C', 'C', 'C', 'C', 'R implementation'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', 'PR-EVACUATION'),
            ('EOC activation authorisation', ['A / designated authority', 'R recommendation', 'C', 'R implementation', 'I', 'I', 'I'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', 'PR-EOC-ACTIVATE'),
            ('EOC coordination and reporting', ['I / policy decisions', 'A (institutional oversight)', 'R support', 'R', 'C', 'R/C', 'R/C'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', None),
            ('Field incident command', ['I as appropriate', 'I / support', 'C', 'C/support', 'A/R', 'R within agency command', 'R within local mandate'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', 'PR-ICS-INTERFACE'),
            ('Sector response services', ['I', 'C', 'C', 'C/coordination', 'A/R where appointed', 'A/R by statutory sector lead', 'R local support'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', None),
            ('Resource request coordination', ['I / approval as required', 'A', 'C', 'R', 'R requests', 'R asset owner', 'R requests/status'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', 'PR-RESOURCE-REQUEST'),
            ('SitRep preparation and submission', ['I / review', 'A oversight', 'C', 'R', 'R inputs', 'R inputs', 'R inputs'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', 'PR-SITREP-CYCLE'),
            ('Deactivation / transition', ['A / designated authority', 'R recommendation', 'C', 'R coordination', 'C', 'R sector handover', 'R local handover'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', 'PR-EOC-DEACTIVATE'),
            ('AAR and corrective action', ['I / oversight', 'A', 'R', 'R', 'C', 'R for own actions', 'R for own actions'], 'Proposed operational assignment for validation. The RACI must be reconciled with the actual EOC EO, ICS EO, cluster membership, approved organisational appointments and current contingency plans. For evacuation and other statutory decisions, the legally competent authority is the "A" regardless of the operational RACI notation.', 'PR-AAR'),
        ],
    },
    {
        'code': 'CH4-LEGAL', 'title': 'Chapter 4 Annex 4-B — EOC and Incident Coordination: Legal Decision Authority and Operational Accountability', 'sort': 17,
        'source': 'MOO Chapter 4 v1.2 Annex 4-B',
        'mode': 'stacked', 'col_duty': ['NOTE', 'A', 'R'],
        'note_prefix': 'Legal or formal decision authority: ',
        'note_suffix': 'Operational accountability (A) and legal decision authority are different things; the legal authority column of Annex 4-B names who decides in law or under a City issuance.',
        'actors': ['Legal or formal decision authority', 'Process-accountable (A)', 'Responsible (R)'],
        'rows': [
            ('Warning receipt and verification', ['None (no decision)', 'CDRRMO Head', 'Operations and Warning (OpCen)'], None, None),
            ('Warning-action recommendation', ['Official or body named in the approved CP or EOC EO', 'CDRRMO Head (technical process)', 'Operations and Warning'], None, None),
            ('Evacuation and public protective action', ['Official or body named by law and City issuance', 'Competent authority', 'Barangays (implementation); CDRRMO (recommendation)'], None, None),
            ('Raising or lowering the EOC alert status', ['Official designated in the EOC EO; LGU by EO on LDRRMC recommendation (DILG VIII s. IV.3)', 'Designated authority', 'EOC Manager (implementation); CDRRMO Head (recommendation)'], None, None),
            ('EOC coordination and reporting', ['Mayor/CDRRMC for policy decisions', 'CDRRMO Head (institutional oversight)', 'EOC Manager and sections'], None, None),
            ('Field incident command', ['Incident Commander under the ICS EO', 'Incident Commander / IMT', 'Agencies within their command'], None, None),
            ('Resource requests with expenditure', ['Authorised officials under Chapter 5', 'CDRRMO Head', 'EOC sections; asset owners'], None, None),
            ('SitRep submission', ['Approving official in the reporting route', 'CDRRMO Head (oversight)', 'EOC Planning / situation unit'], None, None),
            ('Deactivation and transition', ['Official designated in the EOC EO, on the IC recommendation', 'Designated authority', 'EOC Manager; sector offices'], None, None),
            ('State of Imminent Disaster', ['Mayor by EO after the RA 12287 route (SOP GOV-05)', 'CDRRMO Head as CDRRMC secretariat', 'See Chapter 1'], None, None),
        ],
    },
    {
        'code': 'CH5-REC', 'title': 'Chapter 5 Table 5.33 — Proposed Recovery RACI', 'sort': 18,
        'source': 'MOO Chapter 5 v1.0 §15',
        'actors': ['City Mayor / SP', 'CDRRMC', 'CDRRMO', 'CPDO', 'Sector offices', 'City Budget Office / BAC', 'Barangays'],
        'rows': [
            ('Pre-disaster recovery framework', ['I', 'A (adopt)', 'R', 'R', 'C', 'C', 'C'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', 'WF-REC-FRAMEWORK'),
            ('Recovery baseline and scenarios', ['I', 'I', 'A/R', 'R', 'C', 'I', 'C'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', None),
            ('PDNA decision and approval', ['I', 'A', 'R', 'C', 'C', 'I', 'I'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', 'PR-PDNA'),
            ('PDNA conduct', ['I', 'I', 'A/R', 'R', 'R', 'I', 'C'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', 'PR-PDNA'),
            ('Response-to-recovery transition', ['I', 'I', 'A', 'C', 'R', 'I', 'R'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', None),
            ('Program formulation', ['I', 'A (endorse)', 'R', 'R (technical lead)', 'R', 'R', 'C'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', None),
            ('Program approval and appropriation', ['A (SP)', 'R', 'C', 'C', 'I', 'C', 'I'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', None),
            ('BBB screening', ['I', 'I', 'C', 'R', 'A/R (proponent)', 'I', 'C'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', None),
            ('Service delivery and referrals', ['I', 'I', 'C', 'I', 'A/R', 'I', 'R'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', None),
            ('Financing and procurement', ['A (approvals)', 'C', 'C', 'C', 'R', 'R', 'I'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', None),
            ('Monitoring to completion', ['I', 'I', 'A/R', 'R', 'R', 'R', 'C'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', None),
            ('Communication and grievances', ['A (spokesperson)', 'C', 'R', 'C', 'R', 'I', 'R'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', None),
            ('Outcome evaluation and lessons', ['I', 'A', 'R', 'R', 'R', 'C', 'C'], '"Sector offices" are the lead offices of the sub-committees in Table 5.10. Proposed operational assignment for validation; it does not transfer statutory powers.', None),
        ],
    },
    {
        'code': 'CH5-LEGAL', 'title': 'Chapter 5 Annex 5-B — Recovery Decisions: Legal Authority and Operational Accountability', 'sort': 19,
        'source': 'MOO Chapter 5 v1.0 Annex 5-B',
        'mode': 'stacked', 'col_duty': ['NOTE', 'A'],
        'note_prefix': 'Legal or approving authority: ',
        'note_suffix': 'Authorities follow the NEDA (2020) guide and the general legal framework; the City Legal Office shall confirm each row before adoption.',
        'actors': ['Legal or approving authority', 'Operational accountable owner'],
        'rows': [
            ('Adoption of the pre-disaster recovery framework', ['CDRRMC', 'CDRRMO Head'], None, None),
            ('Conduct of a City PDNA', ['CDRRMC', 'CDRRMO Head'], None, None),
            ('Approval of the PDNA', ['CDRRMC (RDRRMC VIII review when NDRRMF funding is sought)', 'PDNA coordinator'], None, None),
            ('Approval of the rehabilitation and recovery program', ['Sangguniang Panlungsod, on CDRRMC endorsement', 'CPDO (technical lead)'], None, None),
            ('Appropriations and supplemental budgets', ['Sangguniang Panlungsod', 'City Budget Officer'], None, None),
            ('Building permits and structural acceptance', ['Building Official', 'Proponent office'], None, None),
            ('Land use and zoning changes', ['Sangguniang Panlungsod (ordinance)', 'CPDO / Zoning Administrator'], None, None),
            ('Relocation and resettlement', ['Authorities under RA 7279 and DHSUD rules', 'Housing office with CSWDO'], None, None),
            ('Eligibility for social services', ['Each service office under its rules', 'CSWDO, CHO, PESO, City Agriculture as relevant'], None, None),
            ('Procurement awards', ['Head of procuring entity on BAC recommendation', 'BAC secretariat (Chapter 6)'], None, None),
        ],
    },
    {
        'code': 'CH6-FIN', 'title': 'Chapter 6 Table 6.36 — RACI for DRRM Financing and Resource Management', 'sort': 20,
        'source': 'MOO Chapter 6 v1.1 §17',
        'actors': ['City Mayor (HoPE for awards)', 'Sangguniang Panlungsod', 'CDRRMC', 'CDRRMO Head', 'CDRRMO Research and Planning Division', 'CDRRMO Administration and Training Division', 'City Budget Office', 'City Accountant', 'City Treasurer', 'BAC', 'CGSO', 'CSWDO'],
        'rows': [
            ('LDRRMF computation', ['I', 'I', 'I', 'C', 'C', 'I', 'A/R', 'C', 'C', None, None, None], None, None),
            ('LDRRMFIP drafting', ['I', 'I', 'C', 'A', 'R', 'R', 'C', 'C', None, 'C', 'C', 'C'], None, 'WF-BUDGET-CYCLE'),
            ('LDRRMFIP approval / adoption', ['I', 'A', 'A', 'R', 'R', 'I', 'C', 'C', None, None, None, None], 'Two Accountable entries: the CDRRMC approves and the SP adopts.', None),
            ('Utilisation tracking and report', ['I', 'I', 'I', 'A', 'R', 'R', 'C', 'R', 'C', 'I', 'I', 'I'], None, None),
            ('STF ageing and programming', ['I', 'A', 'A', 'C', 'R', 'I', 'C', 'R', 'C', None, None, None], 'Two Accountable entries: the CDRRMC approves and the SP concurs.', None),
            ('QRF use', ['A', 'A', 'C', 'R', 'C', 'R', 'R', 'R', 'R', 'R', 'R', 'R'], 'Two Accountable entries: the SP declares a State of Calamity and the Mayor approves QRF spending.', 'PR-QRF-USE'),
            ('AA fund release', ['A', 'I', 'C', 'R', 'C', 'R', 'R', 'R', 'R', 'R', 'R', 'R'], None, 'PR-AA-FUNDS'),
            ('Pre-arranged supply', ['A', None, 'I', 'C', 'I', 'R', 'C', None, None, 'R', 'R', 'C'], None, None),
            ('Emergency procurement', ['A', 'I', 'I', 'C', None, 'R', 'R', 'R', 'R', 'R', 'R', 'C'], None, 'PR-EMERGENCY-PROCURE'),
            ('Donations', ['A', 'I', 'I', 'C', None, 'R', None, 'R', 'R', None, 'R', 'R'], None, None),
            ('Adequacy test and insurance', ['I', 'A', 'C', 'A', 'R', 'C', 'C', None, None, None, 'R', None], 'Two Accountable entries: the CDRRMO Head runs the adequacy test and the SP appropriates premiums.', None),
            ('Audit response', ['A', 'I', 'I', 'R', 'C', 'R', None, 'R', 'C', 'C', 'R', 'C'], None, None),
            ('Prepositioned stocks', ['I', None, 'I', 'A', 'C', 'R', 'C', 'I', None, 'C', 'R', 'A'], 'Two Accountable entries: the CDRRMO Head approves the stock plan and the CSWDO holds custody of relief goods.', None),
            ('Resource inventory', ['I', None, 'I', 'A', 'C', 'R', None, None, None, None, 'R', 'C'], None, None),
        ],
    },
    {
        'code': 'CH7-MEL', 'title': 'Chapter 7 Table 7.34 — RACI for Monitoring, Evaluation and Learning', 'sort': 21,
        'source': 'MOO Chapter 7 v1.0 §15',
        'actors': ['CDRRMC', 'City Mayor', 'CDRRMO Head', 'M&E unit (CDRRMO Research and Planning)', 'CDRRMP Technical Working Group focal offices', 'EOC Manager and staff', 'Assessors', 'Validators', 'City Data Protection Officer', 'City Accountant'],
        'rows': [
            ('LDRRMP indicator set and annual report', ['A', 'I', 'R', 'R', 'R', 'I', None, None, 'C', 'C'], None, None),
            ('IAT fieldwork and scoring', ['I', None, 'A', 'R', 'C', 'C', 'R', None, 'C', None], None, None),
            ('IAT validation and release', ['I', None, 'A', 'R', 'C', 'C', 'C', 'R', None, None], None, None),
            ('After-action review', ['I', 'I', 'A', 'R', 'C', 'R', None, None, None, None], None, 'PR-AAR'),
            ('CAPA register', ['C', 'I', 'A', 'R', 'R', 'R', None, None, None, 'C'], None, None),
            ('45-day post-declaration report', ['I', 'A', 'R', 'R', 'C', 'R', None, None, None, 'R'], None, 'PR-LIFT-REPORT'),
            ('Event and loss database', ['I', None, 'A', 'R', 'C', 'C', None, None, 'C', None], None, None),
            ('Lessons and Manual revision', ['C', 'I', 'A', 'R', 'C', 'C', None, None, None, None], None, None),
            ('Data protection and breach response', ['I', 'A', 'R', 'C', 'I', 'C', None, None, 'R', None], 'For data protection, the Mayor is accountable as head of the personal information controller, acting through the DPO.', None),
        ],
    },
    {
        'code': 'CH8-PARTNER', 'title': 'Chapter 8 Table 8.28 — RACI for Stakeholder Engagement and Partnerships', 'sort': 22,
        'source': 'MOO Chapter 8 v1.0 §15',
        'actors': ['City Mayor', 'Sangguniang Panlungsod', 'CDRRMC', 'CDRRMO Head', 'CDRRMO Administration and Training', 'CDRRMO Research and Planning', 'EOC Manager and staff', 'City Legal Office', 'Part C lead offices', 'Partner organisation or LGU', 'City Administrator'],
        'rows': [
            ('Partner register and agreements', ['A', 'A', 'C', 'R', 'R', 'I', 'I', 'R', 'C', 'R', 'I'], 'Two Accountable entries: the SP authorises and the Mayor signs.', None),
            ('Inter-LGU mutual aid agreement', ['A', 'A', 'C', 'R', 'R', 'C', 'C', 'R', None, 'R', 'I'], 'Two Accountable entries: the SP authorises and the Mayor signs.', 'PR-MUTUAL-AID'),
            ('Mutual aid activation', ['A', 'I', 'I', 'R', 'C', None, 'R', None, None, 'R', 'I'], None, 'PR-MUTUAL-AID'),
            ('Augmentation request and incoming teams', ['A', 'I', 'I', 'R', 'C', 'C', 'R', None, 'C', 'R', 'I'], None, 'PR-AUGMENT-REQUEST'),
            ('Part C interface agreements and review', ['I', None, 'I', 'R', 'C', 'R', None, 'C', 'A', None, 'A'], 'Two Accountable entries: each lead office is accountable for its own indicators and the City Administrator approves interface agreements.', None),
            ('Utility restoration arrangements', ['A', 'A', 'I', 'R', 'C', 'C', 'R', 'C', 'C', 'R', 'I'], 'Two Accountable entries: the SP authorises and the Mayor signs.', None),
            ('CDRRMC partner seats', ['A', 'A', 'C', 'R', 'R', None, None, 'R', None, 'C', 'I'], 'Two Accountable entries: the SP accredits CSOs and the Mayor issues the EO.', None),
            ('Annual partner forum', ['I', 'I', 'A', 'R', 'R', 'C', 'C', None, 'C', 'C', 'I'], None, None),
            ('Assistance to other LGUs', ['A', 'A', 'C', 'R', 'R', None, None, 'C', 'C', None, 'I'], 'Two Accountable entries: the SP authorises and the Mayor signs.', None),
        ],
    },
    {
        'code': 'CH9-AWARE', 'title': 'Chapter 9 Table 9.25 — RACI for Awareness, Community Resilience and Capacity Development', 'sort': 23,
        'source': 'MOO Chapter 9 v1.0 §14',
        'actors': ['City Mayor', 'CDRRMC', 'CDRRMO Head', 'CDRRMO Administration and Training', 'CDRRMO Research and Planning', 'EOC Manager and staff', 'City HRMO', 'CSWDO', 'DILG City Office', 'Barangays and BDRRMCs', 'Sector organisations (through the IPGDO, PDAO and OSCA)'],
        'rows': [
            ('TNA, skills inventory and training plan', ['I', 'C', 'A', 'R', 'C', 'C', 'R', 'C', 'C', 'R', 'C'], None, None),
            ('Training delivery and refreshers', ['–', 'I', 'A', 'R', 'C', 'C', 'R', 'C', 'I', 'R', 'C'], None, None),
            ('Annual exercise program', ['I', 'A', 'R', 'R', 'C', 'R', '–', 'C', 'C', 'R', 'C'], None, None),
            ('IEC program', ['I', 'I', 'A', 'R', 'C', '–', '–', 'C', 'C', 'R', 'R'], None, None),
            ('Risk communication plan and PIO', ['A', 'I', 'R', 'C', '–', 'C', '–', '–', '–', '–', 'C'], None, None),
            ('BDRRMC functionality and support', ['I', 'C', 'A', 'R', 'R', '–', '–', 'C', 'R', 'R', 'C'], None, None),
            ('Volunteer program', ['I', 'A', 'R', 'R', '–', 'R', 'C', 'C', '–', 'C', '–'], 'For the volunteer program, the CDRRMC accredits.', None),
            ('Evacuation centre audit and improvement', ['I', 'A', 'R', 'C', 'R', '–', '–', 'R', '–', 'R', 'C'], 'For evacuation centres, the CDRRMC sets priorities and the Building Official decides structural safety.', None),
            ('Sector consultation on inclusion', ['I', 'I', 'A', 'R', 'C', '–', '–', 'C', '–', 'C', 'R'], None, None),
        ],
    },
    {
        'code': 'CH10-SUSTAIN', 'title': 'Chapter 10 Table 10.20 — RACI for Sustainability, Recognition and Deep Resilience', 'sort': 24,
        'source': 'MOO Chapter 10 v1.0 §12',
        'actors': ['City Mayor', 'Sangguniang Panlungsod', 'CDRRMC', 'CDRRMO Head', 'CDRRMO Research and Planning', 'CDRRMO Administration and Training', 'City Administrator', 'City HRMO', 'City ICT office', 'City Data Protection Officer', 'City Legal Office'],
        'rows': [
            ('Annual sustainability review and roadmap', ['I', 'I', 'A', 'R', 'R', 'C', 'C', 'C', 'C', '–', '–'], None, None),
            ('Legal permanence instruments', ['A', 'A', 'C', 'R', 'R', 'C', 'C', 'C', '–', '–', 'R'], 'Two Accountable entries: for legal permanence the SP enacts ordinances and the Mayor issues executive orders.', None),
            ('Leadership transition and succession', ['A', 'I', 'I', 'R', 'C', 'R', 'R', 'R', 'C', '–', 'C'], None, None),
            ('Digital continuity and security', ['A', '–', 'I', 'C', '–', 'C', 'C', '–', 'R', 'R', 'C'], None, None),
            ('Annual continuity check', ['I', '–', 'I', 'A', 'C', 'R', 'C', 'C', 'R', '–', '–'], None, None),
            ('Gawad KALASAG and SGLG', ['A', 'I', 'C', 'R', 'R', 'C', 'I', '–', '–', '–', '–'], None, None),
            ('Innovation pipeline', ['I', '–', 'C', 'A', 'R', 'C', '–', '–', 'C', 'C', '–'], None, None),
            ('Stewardship and handover', ['A', '–', 'I', 'R', 'C', 'C', 'C', '–', 'R', 'C', 'C'], None, None),
        ],
    },

]


def split_actors(cell: str) -> list[tuple[str, str | None]]:
    """Stacked matrices list one or more offices in a cell: split on ';' and lift a
    trailing "(…)" into the qualifier. Dashes and blanks carry no assignment."""
    out: list[tuple[str, str | None]] = []
    for part in cell.split(';'):
        part = part.strip()
        if not part or part in ('\u2013', '\u2014', '-'):
            continue
        qualifier = None
        m = re.search(r'\s*\(([^()]*)\)\s*$', part)
        if m:
            qualifier = m.group(1).strip()
            part = part[:m.start()].strip()
        if part:
            out.append((part, qualifier))
    return out


def main() -> None:
    mats, acts, rows = [], [], []
    for m in MATRICES:
        mid = uid('raci/matrix', m['code'])
        source = m.get('source', 'MOO Annex 1-F')
        mats.append(f"({sql(uid('raci/matrix', m['code']))}::uuid,{sql(m['code'])},{sql(m['title'])},{sql(source)},{m['sort']})")
        col_duty: list[str | None] = m.get('col_duty', [])
        for i, (activity, cells, note, tmpl) in enumerate(m['rows'], start=1):
            aid = uid('raci/activity', m['code'], activity)
            tid = f"{sql(uid('protocol', tmpl))}::uuid" if tmpl else 'null'
            assignments: list[tuple[str, str, str | None]] = []  # (actor, duty, qualifier)
            note_parts = [note] if note else []
            for idx, (actor, cell) in enumerate(zip(m['actors'], cells)):
                if cell is None:
                    continue
                duty = col_duty[idx] if idx < len(col_duty) else None
                if duty == 'NOTE':  # authority column: kept verbatim in the activity note
                    if cell.strip() and cell.strip() not in ('\u2013', '\u2014', '-'):
                        note_parts.append(m.get('note_prefix', '') + cell.strip())
                    continue
                if duty is not None:  # stacked column: the cell names the office(s)
                    for a, q in split_actors(cell):
                        assignments.append((a, duty, q))
                    continue
                duties, qualifier, _ = parse_cell(cell)
                # Matrix 6.5 and Chapter 1 §8.4 name the lead and the supporting offices inside
                # the cell: the actor is that office text, not the column header.
                if actor in ('Accountable lead', 'Supporting offices / partners', 'Accountable owner', 'Responsible actors') and qualifier:
                    actor, qualifier = qualifier, None
                for d in duties:
                    assignments.append((actor, d, qualifier))
            if m.get('note_suffix'):
                note_parts.append(m['note_suffix'])
            full_note = ' '.join(note_parts) if note_parts else None
            acts.append(f"({sql(aid)}::uuid,{sql(mid)}::uuid,{sql(activity)},{sql(full_note)},{tid},null,{i})")
            seen: set[tuple[str, str]] = set()
            for actor, d, qualifier in assignments:
                if (actor, d) in seen:
                    continue
                seen.add((actor, d))
                rows.append(
                    f"({sql(uid('raci/assignment', m['code'], activity, actor, d))}::uuid,"
                    f"{sql(aid)}::uuid,{sql(actor)},{sql(d)},{sql(qualifier)})")
    out = f"""-- GENERATED by scripts/raci_seed.py from the consolidated Manual Draft 1.0 (Annex 1-F and the Chapter 1-10 RACI sections) — do not edit by hand.
-- RACI board seed (1.19.0, ADR-033). Reference data only; actors are positions and bodies, never
-- personal names (RA 10173). Draft reference content for CDRRMO validation, like the Manual itself.
-- Run after parts 01-36. Safe to run again.
begin;

insert into public.raci_matrices (id,code,title,source_ref,sort) values
{','.join(mats)}
on conflict (id) do update set code = excluded.code, title = excluded.title, source_ref = excluded.source_ref, sort = excluded.sort;

-- Activities: insert-only. A re-run adds activities new to the Manual and leaves existing rows,
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
