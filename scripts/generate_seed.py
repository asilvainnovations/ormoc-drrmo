#!/usr/bin/env python3
"""Generate reference data for the platform from the City's source-of-truth workbooks.

Inputs  (reference/):
  Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v*.xlsx            -> parts, domains, 140 indicators, crosswalk
  Ormoc_CDRRMO_EOC_Master_Requirements_Traceability_and_140_...xlsx -> 18 master requirements, indicator->MR map,
                                                                       functional areas and platform modules
Outputs:
  supabase/seed/seed.sql   idempotent upserts for a Supabase project
  src/data/reference.json  the same records, bundled so the PWA works offline and in demo mode

Operational content that is not in the workbooks (hazards, protocol templates, AA checklist items,
offices) is defined below. Drafted manual text (reference/moo/*.md) is loaded as draft versions. It is DRAFT content for CDRRMO validation and is marked as such.

Usage: python3 scripts/generate_seed.py
"""
from __future__ import annotations
import json, re, sys, uuid
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
def _one(pattern: str) -> Path:
    found = sorted((ROOT / 'reference').glob(pattern))
    if len(found) != 1:
        raise SystemExit(f'Expected exactly one reference/{pattern}, found {[f.name for f in found]}')
    return found[0]


# The IAT workbook is renamed as it is revised (v1.1 -> v1-3), so match any version suffix.
IAT = _one('Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v*.xlsx')
MRT = ROOT / 'reference' / 'Ormoc_CDRRMO_EOC_Master_Requirements_Traceability_and_140_Indicator_Data_Dictionary_v1.2.xlsx'
sys.path.insert(0, str(Path(__file__).resolve().parent))
NS = uuid.UUID('6f1c1d1e-0a0b-4c4d-9e8f-0123456789ab')   # namespace for deterministic ids


def uid(*parts: str) -> str:
    return str(uuid.uuid5(NS, '/'.join(parts)))


# ----------------------------------------------------------------- workbooks --
def read_iat():
    wb = openpyxl.load_workbook(IAT)
    domains, indicators = [], []
    for sheet, part in (('A_CDRRMO', 'A'), ('B_EOC', 'B'), ('C_Interface', 'C')):
        ws = wb[sheet]
        for r in range(5, ws.max_row + 1):
            a, b = ws.cell(r, 1).value, ws.cell(r, 2).value
            if a and not b:
                code, rest = a.split('  ', 1)
                name, _, scope = rest.partition('  -  ')
                domains.append(dict(code=code, part=part, scope=scope.strip()))
            elif a:
                indicators.append(dict(
                    id=a, domain=b, statement=ws.cell(r, 3).value, reference=ws.cell(r, 4).value,
                    type='GP' if part == 'C' else ws.cell(r, 5).value, weight=int(ws.cell(r, 8).value),
                    means_of_verification=ws.cell(r, 6).value, methods=ws.cell(r, 7).value,
                    moo_chapter=ws.cell(r, 16).value,
                    lead_office=ws.cell(r, 5).value if part == 'C' else None))
    xw = wb['Crosswalk']
    crosswalk, framework = [], None
    for r in range(1, xw.max_row + 1):
        a = xw.cell(r, 1).value
        if not a:
            continue
        if str(a).startswith('A. UNDRR'):
            framework = 'UNDRR DRSC'; continue
        if str(a).startswith('B. RA 12287'):
            framework = 'RA 12287 IRR'; continue
        if framework and a not in ('DRSC ref', 'IRR provision'):
            crosswalk.append(dict(framework=framework, ref=str(a), subject=xw.cell(r, 2).value,
                                  treatment=xw.cell(r, 3).value, indicators=xw.cell(r, 4).value,
                                  note=xw.cell(r, 5).value))
    return domains, indicators, crosswalk


def read_mrt():
    wb = openpyxl.load_workbook(MRT)
    ws = wb['Master_Requirements']
    h = [c.value for c in ws[1]]
    mrs = [dict(zip(h, r)) for r in ws.iter_rows(min_row=2, values_only=True) if r[0]]
    ws = wb['Domain_Traceability']
    h = [c.value for c in ws[1]]
    doms = {r[0]: dict(zip(h, r)) for r in ws.iter_rows(min_row=2, values_only=True) if r[0] and r[0] != 'TOTAL'}
    ws = wb['Indicator_Data_Dictionary']
    h = [c.value for c in ws[1]]
    dd = {r[0]: dict(zip(h, r)) for r in ws.iter_rows(min_row=2, values_only=True) if r[0]}
    return mrs, doms, dd


# --------------------------------------------------------- manual sections ----
MOO_TITLES = {
    'MOO Ch.0': 'Introduction',
    'MOO Ch.1': 'Legal and Institutional Framework', 'MOO Ch.2': 'Office Organization',
    'MOO Ch.3': 'DRRM and Contingency Planning', 'MOO Ch.4': 'Operations, Warning and Response',
    'MOO Ch.5': 'Recovery, Rehabilitation and Build Back Better', 'MOO Ch.6': 'DRRM Financing, Resource Management and Accountability',
    'MOO Ch.7': 'Monitoring, Evaluation, Knowledge Management and Continuous Improvement',
    'MOO Ch.8': 'Stakeholder Engagement and Institutional Partnerships',
    'EOC Ch.1': 'Legal Basis', 'EOC Ch.2': 'Concept of Operations and Activation', 'EOC Ch.3': 'Facility, Site and Continuity',
    'EOC Ch.4': 'Communications and Sector Coordination', 'EOC Ch.5': 'Organization, Staffing and Public Information',
    'EOC Ch.6': 'Information Management and Reporting', 'EOC Ch.7': 'Coordination and Resource Management',
    'EOC Ch.8': 'Training and Exercises', 'EOC Ch.9': 'Sustainability',
}
ANNEX_JD = 'MOO Annex JDs'

# Drafted manual text, loaded as DRAFT versions for review and approval in the Library.
# Seeding never overwrites a version once loaded (the Library workflow owns it after that); a new label is a new version.
# Chapter 0 (1.17, ADR-031): Introduction with the manual's cover; states purpose, organization and the
# assessment method once. reference/moo/MOO_Ch0_Introduction_v1.0.md; cover at public/moo-cover.webp.
_CH0 = 'v1.0 introduction'
# Chapter 1 v1.0: revised working draft (Drive, 2 Nov 2026) with its eight annexes 1-A to 1-H, which are now
# separate Google Docs. reference/moo/MOO_Ch1_v1.0.md and Annex_1-*.md were exported from them.
_CH1 = 'v1.0 revised working draft'
LIBRARY_DRAFTS = [  # code, manual, kind, title, file, label, indicators
    ('MOO Ch.0', 'MOO', 'chapter', None, 'MOO_Ch0_Introduction_v1.0.md', _CH0, None),
    # 1.18 (ADR-032 addendum): the drafting team's official Introduction v1.1 (00_Introduction_v1.1.docx,
    # 12 Nov 2026) replaces the interim v1.1: purpose, city context, legal basis, structure, assessment-informed
    # method and systems diagnosis (§5, the baseline Chapters 6-7 cite), design principles, systems
    # thinking/TQM (§7), invariants, conventions and abbreviations. Approval/validation machinery stripped
    # per the City: the Introduction reads as seamless front matter, not a controlled chapter draft.
    ('MOO Ch.0', 'MOO', 'chapter', None, 'MOO_Ch0_Introduction_v1.1.md',
     'v1.1 official working draft (assessment-informed method and systems diagnosis)', None),
    ('MOO Ch.1', 'MOO', 'chapter', None, 'MOO_Ch1_v1.0.md', _CH1, None),
    ('MOO Annex 1-A', 'MOO', 'annex', 'Proposed ordinance institutionalizing the CDRRMO', 'Annex_1-A.md',
     _CH1, ['A1.1', 'A2.1', 'A2.2', 'A2.3', 'A2.5']),
    ('MOO Annex 1-B', 'MOO', 'annex', 'Proposed Executive Order reconstituting the CDRRMC', 'Annex_1-B.md',
     _CH1, ['A1.2', 'A1.3', 'A1.4']),
    ('MOO Annex 1-C', 'MOO', 'annex', 'Proposed Executive Order establishing the City EOC', 'Annex_1-C.md',
     _CH1, ['B1.1', 'B1.2', 'B1.3', 'B4.1', 'B6.1']),
    ('SOP GOV-04', 'MOO', 'sop', 'State of Calamity: declaration, implementation and lifting', 'Annex_1-D.md',
     _CH1, ['A1.6']),
    ('SOP GOV-05', 'MOO', 'sop', 'State of Imminent Disaster: declaration, anticipatory action, lifting and reporting',
     'Annex_1-E.md', _CH1, ['A1.8', 'A2.9', 'A10.8']),
    ('MOO Annex 1-F', 'MOO', 'annex', 'Integrated RACI accountability framework', 'Annex_1-F.md',
     _CH1, ['A1.4', 'B6.1']),
    ('MOO Annex 1-G', 'MOO', 'form', 'Governance forms, templates and registers (GOV-F01 to GOV-F16)', 'Annex_1-G.md',
     _CH1, ['A1.3', 'A1.4']),
    ('MOO Annex 1-H', 'MOO', 'annex', 'Implementation and institutionalization roadmap', 'Annex_1-H.md', _CH1, []),
]

# Chapter 2: Organizational Structure, Staffing and Workforce (draft, 31 Oct 2026). Sources made with
# scripts/split_manual_docx.py; its 20 figures are in public/library/chp2/ (the sources point there).
_CH2 = 'v0.1 assessment-informed draft'
LIBRARY_DRAFTS += [
    ('MOO Ch.2', 'MOO', 'chapter', None, 'MOO_Ch2_v0.9.md', _CH2, None),
] + [
    (code, 'MOO', kind, title, f'MOO_Ch2_Annex_{aid}.md', _CH2, inds)
    for aid, code, kind, title, inds in [
        ('2-A', 'MOO Annex 2-A', 'annex', 'Position description template', ['A2.4', 'B4.5']),
        ('2-B', 'MOO Annex 2-B', 'annex', 'Workforce and plantilla gap matrix', ['A2.1', 'A2.3']),
        ('2-C', 'MOO Annex 2-C', 'annex', 'Competency and training matrix', ['A2.6']),
        ('2-D', 'MOO Annex 2-D', 'annex', 'EOC personnel designation register', ['B4.1', 'B4.2']),
        ('2-E', 'MOO Annex 2-E', 'annex', 'Duty handover checklist', ['A2.5', 'B4.3']),
        ('2-F', 'MOO Annex 2-F', 'annex', 'Legal and technical validation register', []),
        ('2-G', 'SOP HR-01', 'sop', 'Annual workforce planning and plantilla review', ['A2.1', 'A2.3']),
        ('2-H', 'SOP HR-02', 'sop', 'Position description and competency profile control', ['A2.4', 'B4.5']),
        ('2-I', 'SOP HR-03', 'sop', 'Recruitment, appointment interface and onboarding', ['A2.2', 'A2.3']),
        ('2-J', 'SOP HR-04', 'sop', 'Competency assessment and learning and development', ['A2.6']),
        ('2-K', 'SOP HR-05', 'sop', 'Duty roster, shift handover and personnel availability', ['A2.5', 'B4.3']),
        ('2-L', 'SOP HR-06', 'sop', 'EOC personnel designation and surge augmentation', ['B4.1', 'B4.2', 'B4.4']),
        ('2-M', 'SOP HR-07', 'sop', 'Personnel safety, welfare, injury and psychosocial referral', ['A2.7', 'B4.6']),
        ('2-N', 'SOP HR-08', 'sop', 'Performance management, records and corrective action', []),
        ('2-O', 'FORM HR-F01', 'form', 'Workforce and plantilla review form', ['A2.1', 'A2.3']),
        ('2-P', 'FORM HR-F02', 'form', 'Position description and competency profile', ['A2.4']),
        ('2-Q', 'FORM HR-F03', 'form', 'Training needs and competency assessment', ['A2.6']),
        ('2-R', 'FORM HR-F04', 'form', 'Duty roster and handover form', ['A2.5', 'B4.3']),
        ('2-S', 'FORM HR-F05', 'form', 'EOC personnel designation register', ['B4.2']),
        ('2-T', 'FORM HR-F06', 'form', 'Personnel safety, injury and welfare report', ['A2.7', 'B4.6']),
        ('2-U', 'FORM HR-F07', 'form', 'Chapter 2 CAPA and quality review register', []),
        ('2-V', 'FORM HR-F08', 'form', 'Chapter 2 records and controlled document register', []),
        ('2-W', 'MOO Annex 2-W', 'annex', 'Chapter 2 SOP and form cross-reference register', []),
    ]
]


# 1.9.0: Chapters 1 and 2, Draft 1.2 (6 Nov 2026): updated to IAT v1.5, October 2026 fieldwork (FGD, KIIs, site
# visits incl. Brgy. Liloan), 2021-2024 City issuances, the structure assessment, staff perspectives, the scenario-based
# EOC and the cluster-coordinator proposal. Made with split_manual_docx.py --slug ch1v12 / ch2v12 --version v1.2;
# figures in public/library/ch1v12 and ch2v12. New labels, so they load as new draft versions of the same chapters.
LIBRARY_DRAFTS += [
    ('MOO Ch.1', 'MOO', 'chapter', None, 'MOO_Ch1_v1.2.md', 'v1.2 working draft (IAT v1.5)', None),
    ('MOO Ch.2', 'MOO', 'chapter', None, 'MOO_Ch2_v1.2.md', 'v1.2 working draft (IAT v1.5)', None),
]

# Chapter 3: Risk Intelligence, DRRM and Contingency Planning, and Institutional Preparedness (v0.9, 31 Oct 2026,
# Drive). Made with: split_manual_docx.py Chapter3.docx --slug ch3 --prefix MOO_Ch3. One figure, in public/library/ch3/.
# Annex 3-A is the indicator-to-process traceability matrix; its 15 IAT IDs link to the chapter, and each form
# links to the indicators of the process it records (Annex 3-A, column 'Chapter process').
_CH3 = 'v0.9 working draft'
_CH3_INDS = ['A3.1', 'A3.2', 'A3.3', 'A3.4', 'A3.7', 'A5.1', 'A5.2', 'A5.3', 'A5.8', 'A7.6', 'C1.1', 'C1.2', 'C1.3', 'C1.4', 'C3.1']
_CH3V1 = 'v1.0 working draft (IAT v1.6)'
LIBRARY_DRAFTS += [('MOO Ch.3', 'MOO', 'chapter', None, 'MOO_Ch3_v0.9.md', _CH3, None)] + [
    (f'Annex {aid}', 'MOO', kind, title, f'MOO_Ch3_Annex_{aid}.md', _CH3, inds)
    for aid, kind, title, inds in [
        ('3-A', 'annex', 'Indicator-to-process traceability matrix', _CH3_INDS),
        ('3-B', 'form', 'Form 3-01: Risk information and map request', ['A5.1', 'C1.4']),
        ('3-C', 'form', 'Form 3-02: Dataset metadata and quality checklist', ['A5.1']),
        ('3-D', 'form', 'Form 3-03: CDRA hazard-impact scoping matrix', ['A5.2', 'C1.3']),
        ('3-E', 'form', 'Form 3-04: CDRA Major Decision Area register', ['A5.2', 'C1.1']),
        ('3-F', 'form', 'Form 3-05: Critical facilities and dependency register', ['A5.8']),
        ('3-G', 'form', 'Form 3-06: Contingency plan quality and exercise record', ['A3.3']),
        ('3-H', 'form', 'Form 3-07: Essential functions inventory and BIA', ['A3.4']),
        ('3-I', 'form', 'Form 3-08: Barangay DRRM plan review status', ['A3.7']),
        ('3-J', 'form', 'Form 3-09: DRR/CCA project screening', ['A3.2', 'C1.2']),
        ('3-K', 'form', 'Form 3-10: Consultation and inclusion validation record', ['A5.3', 'A7.6', 'C3.1']),
        ('3-L', 'form', 'Form 3-11: Corrective action and document revision register', []),
        ('3-M', 'annex', 'Source and methodology register', []),
    ]
]

# Chapter 3 v1.0 (8 Nov 2026, ADR-019): house style of Chapters 1-2 v1.2, verified CDRA/CLUP/LDRRMP findings, an SOP
# control block per SOP, Annex 3-N glossary. Made with: split_manual_docx.py Chapter3_..._v1.0.docx --slug ch3v10
# --prefix MOO_Ch3v1 --version v1.0 (separate files so the v0.9 sources stay intact). Figures in public/library/ch3v10/.
_CH3V1_ANNEX = {aid: (kind, title, inds) for aid, kind, title, inds in [
    ('3-A', 'annex', 'Indicator-to-process traceability matrix', _CH3_INDS),
    ('3-B', 'form', 'Form 3-01: Risk information and map request', ['A5.1', 'C1.4']),
    ('3-C', 'form', 'Form 3-02: Dataset metadata and quality checklist', ['A5.1', 'A5.7']),
    ('3-D', 'form', 'Form 3-03: CDRA hazard-impact scoping matrix', ['A5.2', 'C1.3']),
    ('3-E', 'form', 'Form 3-04: CDRA Major Decision Area register', ['A5.2', 'C1.1']),
    ('3-F', 'form', 'Form 3-05: Critical facilities and dependency register', ['A5.8']),
    ('3-G', 'form', 'Form 3-06: Contingency plan quality and exercise record', ['A3.3']),
    ('3-H', 'form', 'Form 3-07: Essential functions inventory and BIA', ['A3.4']),
    ('3-I', 'form', 'Form 3-08: Barangay DRRM plan review status', ['A3.7']),
    ('3-J', 'form', 'Form 3-09: DRR/CCA project screening', ['A3.2', 'C1.2']),
    ('3-K', 'form', 'Form 3-10: Consultation and inclusion validation record', ['A5.3', 'A7.6', 'C3.1']),
    ('3-L', 'form', 'Form 3-11: Corrective action and document revision register', []),
    ('3-M', 'annex', 'Source and methodology register', []),
    ('3-N', 'annex', 'Glossary of terms', []),
]}
LIBRARY_DRAFTS += [('MOO Ch.3', 'MOO', 'chapter', None, 'MOO_Ch3v1_v1.0.md', _CH3V1, None)] + [
    (f'Annex {aid}', 'MOO', kind, title, f'MOO_Ch3v1_Annex_{aid}.md', _CH3V1, inds)
    for aid, (kind, title, inds) in _CH3V1_ANNEX.items()
]
# Chapter 3 v1.1 (8 Nov 2026): the NDRRMC-OCD Contingency Planning Guidebook (Feb 2020) applied to SOP 3-6; the barangay
# denominator kept at 85 (PSA PSGC) as a working figure until the City master list is reconciled. Same figures (ch3v10).
_CH3V11 = 'v1.1 working draft (CP Guidebook 2020)'
LIBRARY_DRAFTS += [('MOO Ch.3', 'MOO', 'chapter', None, 'MOO_Ch3v11_v1.1.md', _CH3V11, None)] + [
    (f'Annex {aid}', 'MOO', kind, title, f'MOO_Ch3v11_Annex_{aid}.md', _CH3V11, inds)
    for aid, (kind, title, inds) in _CH3V1_ANNEX.items()
]

# Chapter 4 v1.1 (8 Nov 2026, ADR-022): Early Warning, Activation, Incident Management and Emergency Response.
# Made with: split_manual_docx.py Chapter4_..._v1.1.docx --slug ch4v11 --prefix MOO_Ch4v1 --version v1.1.
# Figures in public/library/ch4v11/. Its SOPs 4-01 to 4-09 run as protocols (sop_registry.py).
_CH4V1 = 'v1.1 working draft (IAT v1.7)'
_CH4_INDS = ['A6.1', 'A6.2', 'A6.3', 'A6.4', 'A6.5', 'A6.6', 'A6.7', 'A7.1', 'A7.2', 'A7.3', 'A7.4', 'A7.5', 'A7.6', 'A7.7', 'A7.8', 'A7.9', 'A8.1', 'A8.2', 'A8.3', 'A8.4', 'A8.5', 'A8.6', 'A8.7', 'A8.8', 'A8.9', 'B1.2', 'B1.3', 'B1.4', 'B1.5']
LIBRARY_DRAFTS += [('MOO Ch.4', 'MOO', 'chapter', None, 'MOO_Ch4v1_v1.1.md', _CH4V1, None)] + [
    (f'Annex {aid}', 'MOO', kind, title, f'MOO_Ch4v1_Annex_{aid}.md', _CH4V1, inds)
    for aid, kind, title, inds in [
        ('4-A', 'annex', 'IAT and master requirements traceability register', _CH4_INDS),
        ('4-B', 'annex', 'EOC and incident coordination RACI with legal decision authority', ['B1.2', 'B1.3', 'B1.4']),
        ('4-C', 'annex', 'Hazard-specific warning and activation matrix register', ['A6.1', 'A6.2', 'B1.2', 'B1.3']),
        ('4-D', 'annex', 'Gawad KALASAG CY 2026 evidence crosswalk', []),
    ]
]

# 1.18.0 (ADR-032): Chapters 5-8 published 12 Nov 2026. The financing draft seeded in 1.15 as 'MOO Ch.5'
# v1.0 is renumbered to 'MOO Ch.6' v1.1 (content unchanged; its source files MOO_Ch5v1_* now hold the
# Recovery chapter v1.0 — see DEPLOY.md 1.18.0). Its SOPs are 6-01 to 6-12 (sop_registry.py, CH6_*).
_CH6V1 = 'v1.1 working draft (IAT v1.7); renumbered from Chapter 5 Draft 1.0'
_CH6_INDS = ['A10.5', 'A10.8', 'A3.5', 'A4.1', 'A4.2', 'A4.3', 'A4.4', 'A4.5', 'A4.6', 'A4.7', 'A4.8', 'A4.9',
             'A7.5', 'A8.3', 'B6.3', 'B6.4', 'B6.6', 'B7.5', 'C1.2']  # from Annex 6-A traceability register
LIBRARY_DRAFTS += [('MOO Ch.6', 'MOO', 'chapter', None, 'MOO_Ch6v1_v1.1.md', _CH6V1, None)] + [
    (f'Annex {aid}', 'MOO', kind, title, f'MOO_Ch6v1_Annex_{aid}.md', _CH6V1, inds)
    for aid, kind, title, inds in [
        ('6-A', 'annex', 'IAT and master requirements traceability for DRRM financing, resources and accountability', _CH6_INDS),
        ('6-B', 'form', 'Pre-audit checklist for DRRM transactions', ['A4.8', 'A4.4', 'A10.5']),
        ('6-C', 'annex', 'Anticipatory action funding pathway and tranche worksheet', ['A4.6', 'A10.8']),
        ('6-D', 'annex', 'Prepositioned stock planning worksheet', ['A7.5']),
    ]
]

# Chapter 5 v1.0 (12 Nov 2026): Recovery, Rehabilitation and Build Back Better (uploaded as
# Ch5_..._BBB_v1.1.docx; its document control states Draft 1.0, which governs the seeded version).
# SOPs 5-01/5-02 proposed templates in sop_registry.py (CH5REC_PROCEDURES).
_CH5REC = 'v1.0 working draft (IAT v1.7)'
_CH5REC_INDS = ['A10.6', 'A3.4', 'A5.4', 'A8.7', 'A9.1', 'A9.2', 'A9.3', 'A9.4', 'A9.5',
                'C1.3', 'C1.4', 'C2.1', 'C2.2', 'C2.3', 'C3.3']  # from Annex 5-A traceability register
LIBRARY_DRAFTS += [('MOO Ch.5', 'MOO', 'chapter', None, 'MOO_Ch5v1_v1.0.md', _CH5REC, None)] + [
    (f'Annex {aid}', 'MOO', kind, title, f'MOO_Ch5v1_Annex_{aid}.md', _CH5REC, inds)
    for aid, kind, title, inds in [
        ('5-A', 'annex', 'IAT and master requirements traceability for recovery, rehabilitation and build back better', _CH5REC_INDS),
        ('5-B', 'annex', 'Recovery RACI with legal decision authority', []),
        ('5-C', 'annex', 'Pre-disaster recovery framework outline', []),
        ('5-D', 'form', 'Recovery monitoring matrix fields (REC-F06)', ['A10.6']),
        ('5-E', 'annex', 'Minimum data for the recovery baseline', []),
    ]
]

# Chapter 7 v1.0 (12 Nov 2026): Monitoring, Evaluation, Knowledge Management and Continuous Improvement.
# SOPs 7-01/7-04/7-05/7-07/7-08/7-09 proposed templates in sop_registry.py (CH7_PROCEDURES); 7-02/7-03 run
# on the MODE Assess module; 7-06 runs on PR-LIFT-REPORT.
_CH7V1 = 'v1.0 working draft (IAT v1.7)'
_CH7_INDS = ['A10.3', 'A10.4', 'A10.6', 'A10.8', 'A10.9', 'A5.4', 'A5.5', 'B7.3', 'B7.4']  # Annex 7-A register
LIBRARY_DRAFTS += [('MOO Ch.7', 'MOO', 'chapter', None, 'MOO_Ch7v1_v1.0.md', _CH7V1, None)] + [
    (f'Annex {aid}', 'MOO', kind, title, f'MOO_Ch7v1_Annex_{aid}.md', _CH7V1, inds)
    for aid, kind, title, inds in [
        ('7-A', 'annex', 'IAT and master requirements traceability for monitoring, evaluation and knowledge management', _CH7_INDS),
        ('7-B', 'form', 'LDRRMP M&E matrix template', ['A10.4']),
        ('7-C', 'form', 'After-action review report outline', ['A10.6', 'B7.4']),
        ('7-D', 'form', 'Post-declaration (45-day) report outline', ['A10.8']),
        ('7-E', 'annex', 'Disaster event and loss database fields', ['A5.4']),
    ]
]

# Chapter 8 v1.0 (12 Nov 2026): Stakeholder Engagement and Institutional Partnerships. SOPs 8-01 to 8-08
# proposed templates in sop_registry.py (CH8_PROCEDURES).
_CH8V1 = 'v1.0 working draft (IAT v1.7)'
_CH8_INDS = ['A1.2', 'A10.1', 'A10.2', 'A8.5', 'B6.6', 'C1.1', 'C1.2', 'C1.3', 'C1.4',
             'C2.1', 'C2.2', 'C2.3', 'C3.1', 'C3.2', 'C3.3', 'C4.1', 'C4.2', 'C4.3', 'C4.4', 'C5.1']  # Annex 8-A
LIBRARY_DRAFTS += [('MOO Ch.8', 'MOO', 'chapter', None, 'MOO_Ch8v1_v1.0.md', _CH8V1, None)] + [
    (f'Annex {aid}', 'MOO', kind, title, f'MOO_Ch8v1_Annex_{aid}.md', _CH8V1, inds)
    for aid, kind, title, inds in [
        ('8-A', 'annex', 'IAT and master requirements traceability for stakeholder engagement and institutional partnerships', _CH8_INDS),
        ('8-B', 'annex', 'Model outline of a technical mutual aid agreement', ['B6.6']),
        ('8-C', 'annex', 'Model outline of a Part C interface agreement', ['C1.1']),
        ('8-D', 'annex', 'Agenda of the annual partner forum', ['A10.1']),
    ]
]

AREA_ONLY_DRAFTS = {'SOP 6-GIS-01': 6}  # code -> functional area (Area 6: situational awareness, IM and GIS)
# 1.11: the proposed SOP 6-GIS-01 (EOC Module note, 6 Nov 2026) as a Library draft, so WF-GEO-COP points to a text that
# exists. Chapter 6 (EOC operations and information management) adopts it when drafted.
LIBRARY_DRAFTS += [('SOP 6-GIS-01', 'EOC', 'sop', 'Establishment, updating and operational use of the EOC Geospatial Common Operating Picture',
                    'SOP_6-GIS-01_proposed.md', 'v0.1 proposed (EOC Module note, 6 Nov 2026)', ['A5.6', 'A5.7', 'B5.3'])]


# 1.18 (ADR-032): the IAT workbook's "Feeds Manual Chapter" column still uses the pre-compilation numbering
# (a full 140-row renumber sweep belongs to a workbook revision). Until then, workbook chapter tags are
# remapped here: financing rows (old Ch.5) -> drafted Ch.6; capacity rows (old Ch.6) -> Ch.3; recovery rows
# (old Ch.8) -> drafted Ch.5; partnership rows (old Ch.9) -> drafted Ch.8. M&E rows (Ch.7) keep their code.
CHAPTER_RENUMBER = {'MOO Ch.5': 'MOO Ch.6', 'MOO Ch.6': 'MOO Ch.3', 'MOO Ch.8': 'MOO Ch.5', 'MOO Ch.9': 'MOO Ch.8'}


def chapters_of(tag: str) -> list[str]:
    """'MOO Ch.2 / Ch.4' -> ['MOO Ch.2','MOO Ch.4']; 'EOC Manual (whole)' -> all EOC chapters."""
    if 'EOC Manual (whole)' in tag:
        return [k for k in MOO_TITLES if k.startswith('EOC')]
    out, prefix = [], None
    for part in [p.strip() for p in tag.split('/')]:
        m = re.match(r'^(MOO|EOC)\s+Ch\.(\d+)', part)
        if m:
            prefix = m.group(1); out.append(f'{prefix} Ch.{m.group(2)}'); continue
        m = re.match(r'^Ch\.(\d+)', part)
        if m and prefix:
            out.append(f'{prefix} Ch.{m.group(1)}'); continue
        if part.startswith('Annex JDs'):
            out.append(ANNEX_JD)
    return list(dict.fromkeys(CHAPTER_RENUMBER.get(c, c) for c in out))


# ------------------------------------------------------- one manual (v1.6) ---
# Inception Report sec. 3.4 and Annex A: ten functional areas bound into five Parts. The same rows are
# inserted by migration 20261102001200_single_manual.sql; the seed repeats them so a fresh load is complete.
MANUAL_PARTS = [  # no, title, summary
    (1, 'Legal mandate and governance', 'Mandate, structure, authorities and accountability of the CDRRMO, the CDRRMC and the EOC.'),
    (2, 'SOPs by alert level', 'Preparedness, EOC activation, logistics and responder safety. The core of EOC operations and the largest Part.'),
    (3, 'Information management and public communication', 'Risk intelligence, early warning and public information, situational awareness and GIS.'),
    (4, 'Continuity and infrastructure safeguards', 'Digital continuity, cybersecurity and systems resilience.'),
    (5, 'Recovery and continuous improvement', 'Recovery, learning, performance and manual revision.'),
]
MANUAL_AREAS = [  # no, part, title, scope, MCR2030 primary, supporting  (sorted within the manual by Part)
    (1, 1, 'Governance, Organization & Institutional Arrangements',
     'CDRRMO/EOC mandate; organizational structure; LDRRMC relationships; authorities; delegation; duty officers; ICS roles; inter-agency coordination; public-private partnerships; accountability',
     'Essential 1 – Organize for Disaster Resilience', 'Essentials 6, 7, 9'),
    (3, 2, 'Preparedness, Planning & Capacity Development',
     'Emergency plans; contingency plans; SOPs; preparedness standards; training; drills; simulations; competency requirements; EOC readiness; BDRRMC capacity; mutual-aid arrangements',
     'Essential 6 – Strengthen Institutional Capacity for Resilience', 'Essentials 1, 7, 9'),
    (4, 2, 'EOC Activation, Incident Management & Coordination',
     'Alert levels; activation/deactivation; ICS integration; incident objectives; command and coordination; operational periods; EOC staffing; escalation; transition from response to recovery',
     'Essential 9 – Ensure Effective Disaster Response', 'Essentials 1, 6, 10'),
    (7, 2, 'Resource, Logistics & Emergency Support Management',
     'Resource inventory; resource requests; procurement; stockpiling; staging; transport; warehousing; fuel; relief supplies; mutual aid; supplier networks; emergency support services',
     'Essential 9 – Ensure Effective Disaster Response', 'Essentials 3, 8, 6'),
    (8, 2, 'Responder Safety, Welfare & Inclusive Emergency Operations',
     'Duty of care; PPE; responder health and safety; psychosocial support; fatigue management; workforce rotation; gender/inclusion considerations; protection of vulnerable groups; safe operating procedures',
     'Essential 9 – Ensure Effective Disaster Response', 'Essentials 6, 7, 8'),
    (2, 3, 'Risk Intelligence, Prevention & Mitigation',
     'Multi-hazard risk assessment; hazard/exposure/vulnerability analysis; climate risk; risk scenarios; GIS-based risk information; prevention and mitigation measures; risk-informed development planning',
     'Essential 2 – Identify, Understand and Use Current and Future Risk Scenarios', 'Essentials 4, 5, 8'),
    (5, 3, 'Early Warning, Emergency Communications & Public Information',
     'Monitoring; detection; warning thresholds; multi-channel dissemination; public information; risk communication; accessible alerts; community feedback; rumor management; warning verification',
     'Essential 9 – Ensure Effective Disaster Response', 'Essentials 2, 7, 6'),
    (6, 3, 'Situational Awareness, Information Management & GIS',
     'Data collection; validation; common operating picture; GIS; dashboards; incident reports; SITREPs; data standards; information-sharing; decision support; risk intelligence',
     'Essential 2 – Identify, Understand and Use Current and Future Risk Scenarios', 'Essentials 6, 9, 8'),
    (9, 4, 'Digital Continuity, Cybersecurity & Systems Resilience',
     'Critical information systems; cybersecurity; data protection; backups; cloud redundancy; alternate communications; power continuity; disaster recovery; system interoperability; continuity of operations',
     'Essential 8 – Increase Infrastructure Resilience', 'Essentials 6, 9, 4'),
    (10, 5, 'Recovery, Learning, Performance & Continuous Improvement',
     'Recovery transition; damage/loss assessment; debris management; rehabilitation/reconstruction; Build Back Better; economic recovery; AARs; M&E; audits; exercises; lessons learned; manual revision',
     'Essential 10 – Expedite Recovery and Build Back Better', 'Essentials 3, 6, 7, 8, 9'),
]
AREA_TITLE = {a[0]: a[2] for a in MANUAL_AREAS}

# The 18 shells of v1.0-1.5 (nine MOO and nine EOC chapters) and the JD annex. Three became the drafted
# Chapters 1-3 (same ids, new codes). The rest merge into the area outline that now carries their
# indicators; their old code stays as an alias so links, protocols and IAT routing keep working.
CHAPTERS = {  # legacy code -> (new code, chapter no, primary area, also areas, title)
    # 1.17: Introduction drafted (v1.0, 12 Nov 2026, ADR-031): purpose, organization and the assessment method,
    # stated once here so no chapter repeats it. Primary area 1 (governance); it serves all areas.
    # 1.18 (ADR-032 addendum): the Introduction is front matter, not a chapter — code 'Introduction',
    # chapter_no NULL. The deterministic doc id is unchanged (keyed by the legacy 'MOO Ch.0' code).
    'MOO Ch.0': ('Introduction', None, 1, [], 'Introduction to the Manual'),
    'MOO Ch.1': ('Chapter 1', 1, 1, [], 'Legal Mandate, DRRM Governance and Institutional Accountability'),
    'MOO Ch.2': ('Chapter 2', 2, 1, [3, 8], 'CDRRMO Organizational Structure, Staffing and Human Resource Management'),
    'MOO Ch.3': ('Chapter 3', 3, 2, [3], 'Risk Intelligence, DRRM and Contingency Planning, and Institutional Preparedness'),
    # 1.11: Chapter 4 drafted (v1.1, 8 Nov 2026). Primary area 4; also area 5 (early warning, public information).
    'MOO Ch.4': ('Chapter 4', 4, 4, [5], 'Early Warning, EOC Activation, Incident Management and Emergency Response'),
    # 1.18 (ADR-032): the keys below are the workbook chapter codes as remapped by CHAPTER_RENUMBER.
    # 'MOO Ch.5' rows are now Recovery (drafted v1.0, primary area 10); 'MOO Ch.6' rows are Financing
    # (drafted v1.1, renumbered from the 1.15 'MOO Ch.5' seed; primary area 1, also 7 for procurement);
    # 'MOO Ch.7' rows are M&E (v1.0, area 10, also 3); 'MOO Ch.8' rows are Stakeholder (v1.0, area 1, also 3, 7).
    'MOO Ch.5': ('Chapter 5', 5, 10, [], 'Recovery, Rehabilitation and Build Back Better'),
    'MOO Ch.6': ('Chapter 6', 6, 1, [7], 'DRRM Financing, Resource Management and Accountability'),
    'MOO Ch.7': ('Chapter 7', 7, 10, [3], 'Monitoring, Evaluation, Knowledge Management and Continuous Improvement'),
    'MOO Ch.8': ('Chapter 8', 8, 1, [3, 7], 'Stakeholder Engagement and Institutional Partnerships'),
}
# 1.18 (ADR-032): the four MOO shells (old Ch.6 capacity, Ch.7 M&E, Ch.8 recovery, Ch.9 partnerships) are
# gone — their codes now carry the drafted Chapters 5-8 (CHAPTERS above), so only the EOC merges remain.
MERGED = {  # legacy shell -> functional area
    'EOC Ch.1': 1, 'EOC Ch.2': 4, 'EOC Ch.3': 9, 'EOC Ch.4': 5, 'EOC Ch.5': 4, 'EOC Ch.6': 6,
    'EOC Ch.7': 7, 'EOC Ch.8': 3, 'EOC Ch.9': 10,
}
LEGACY_TITLES = {ANNEX_JD: 'Job descriptions', 'MOO Annex 1-0': 'Chapter 1 Implementation Package: document control and annex register'}
RETIRED = {ANNEX_JD: 'MOO Ch.2', 'MOO Annex 1-0': 'MOO Ch.1'}  # merged into a chapter (JDs; package control is in Ch.1 v1.0)


def new_code(code: str) -> str:
    """'MOO Ch.1' -> 'Chapter 1'; 'MOO Annex 2-A' -> 'Annex 2-A'; SOP and FORM codes are kept."""
    if code in CHAPTERS:
        return CHAPTERS[code][0]
    return re.sub(r'^MOO Annex ', 'Annex ', code)


def chapter_of(code: str) -> int | None:
    m = re.search(r'(?:Annex|Ch)[ ._]*(\d+)', code)
    return int(m.group(1)) if m else None



# ------------------------------------------------------------------ offices ---
OFFICES = [  # code, name, kind
    ('CDRRMO', 'City Disaster Risk Reduction and Management Office', 'cdrrmo'),
    ('CMO', "City Mayor's Office", 'city_office'),
    ('CSWDO', 'City Social Welfare and Development Office', 'city_office'),
    ('CHO', 'City Health Office', 'city_office'),
    ('CPDO', 'City Planning and Development Office', 'city_office'),
    ('CBO', 'City Budget Office', 'city_office'),
    ('CACCO', 'City Accounting Office', 'city_office'),
    ('BAC', 'Bids and Awards Committee', 'city_office'),
    ('CEO', 'City Engineering Office / Building Official', 'city_office'),
    ('GSO', 'General Services Office', 'city_office'),
    ('CENRO', 'City Environment and Natural Resources Office', 'city_office'),
    ('CAO', 'City Agriculture Office', 'city_office'),
    ('CVO', 'City Veterinary Office', 'city_office'),
    ('ZA', 'Zoning Administrator', 'city_office'),
    ('TRAFFIC', 'City traffic office', 'city_office'),
    ('MARKET', 'City market office', 'city_office'),
    ('PIO', 'City public information office', 'city_office'),
    ('DEPED-SDO', 'DepEd Schools Division of Ormoc City', 'national_agency'),
    ('DPWH', 'Department of Public Works and Highways (district office)', 'national_agency'),
    ('DENR-CENRO', 'DENR Community Environment and Natural Resources Office', 'national_agency'),
    ('DTI-LEYTE', 'DTI Leyte Provincial Office', 'national_agency'),
    ('OCD-VIII', 'Office of Civil Defense Region VIII / RDRRMC VIII', 'national_agency'),
    ('HOSPITALS', 'Hospitals in Ormoc City', 'other'),
    ('PORT', 'Port and terminal operators', 'private'),
    ('UTILITIES', 'Utility providers (power, water, telecommunications)', 'utility'),
    ('CHAMBER', 'Ormoc chamber of commerce', 'private'),
    # 1.9.0: response cluster leads and partners (MOO Ch.1 sec. 6.3; Ch.2 sec. 10)
    ('PNP', 'Ormoc City Police Office (PNP)', 'national_agency'),
    ('BFP', 'Bureau of Fire Protection, Ormoc City', 'national_agency'),
    ('PRC', 'Philippine Red Cross, Ormoc Chapter', 'cso'),
    ('LIGA', 'Liga ng mga Barangay, Ormoc Chapter', 'barangay'),
]
LEAD_MAP = {  # Part C lead-office text fragment -> office code
    'CDRRMO': 'CDRRMO', 'Chamber of Commerce': 'CHAMBER', 'utility providers': 'UTILITIES', 'CENRO': 'CENRO',
    'City Engineer': 'CEO', 'GSO': 'GSO', 'DENR CENRO': 'DENR-CENRO', 'CPDO': 'CPDO', 'City Budget Office': 'CBO',
    'Zoning Administrator': 'ZA', 'City Agriculture Office': 'CAO', 'City Veterinary Office': 'CVO',
    'City Engineer / Building Official': 'CEO', 'traffic office': 'TRAFFIC', 'DPWH': 'DPWH', 'port operator': 'PORT',
    'City Health Office': 'CHO', 'hospitals': 'HOSPITALS', 'DTI Leyte': 'DTI-LEYTE', 'city market office': 'MARKET',
    'DepEd Schools Division of Ormoc City': 'DEPED-SDO',
}


def lead_offices(text: str) -> list[str]:
    parts = []
    for chunk in re.split(r';', text):
        chunk = chunk.strip()
        for piece in re.split(r'\s+with\s+', chunk):
            piece = piece.strip()
            code = LEAD_MAP.get(piece)
            if code is None:
                raise SystemExit(f'Unmapped lead office: {piece!r} in {text!r}')
            parts.append(code)
    return list(dict.fromkeys(parts))


# ------------------------------------------------------------------ hazards ---
HAZARDS = [  # code, name, forecastable, typical lead h, declaration eligible, note, AA family (IRR Rule II Sec. 2)
    ('tropical_cyclone', 'Tropical cyclone (severe winds)', True, 96, True, 'PAGASA bulletins; usually reaches the 3-day lead time', 'hydromet'),
    ('storm_surge', 'Storm surge (Ormoc Bay)', True, 72, True, 'Forecast with tropical cyclones; coastal barangays', 'hydromet'),
    ('flood', 'Riverine flood', True, 48, True, 'Eligible only when the forecast gives 3 days or more', 'hydromet'),
    ('flash_flood', 'Flash flood (Anilao–Malbasag system)', True, 6, False, 'Lead time usually hours: city early action under LGU authority', 'hydromet'),
    ('rain_landslide', 'Rain-induced landslide', True, 12, False, 'Upland barangays; city early action on rainfall thresholds', 'hydromet'),
    ('drought', 'Drought (El Niño)', True, 720, True, 'Slow onset: timelines and disbursement rates per the NDRRMC operational guidelines (IRR Rule V Sec. 2)', 'climatic'),
    ('extreme_heat', 'Extreme heat', True, 72, True, 'PAGASA heat index forecasts', 'hydromet'),
    ('earthquake', 'Earthquake (Philippine Fault)', False, None, False, 'Not forecastable: no lead time for a declaration', 'geological'),
    ('tsunami', 'Tsunami (local source)', False, None, False, 'Minutes of warning: no lead time for a declaration', 'geological'),
    ('industrial', 'Industrial / geothermal incident', False, None, False, 'Not forecastable: no lead time for a declaration', 'other'),
]

# ------------------------------------------------- AA checklist (IRR Rule IV) -
AA_TEMPLATES = [  # sector, title, irr_ref, lead_office, timing, hazard
    ('Public information', 'Issue official notice of the declaration and the anticipatory actions being taken', 'IRR Rule IV Sec. 2(a)', 'CDRRMO / public information office', 'on_declaration', None),
    ('Public information', 'Disseminate impact-based advisories on all channels, including GIDA barangays, in Cebuano and accessible formats', 'IRR Rule IV Sec. 2(b)-(c)', 'CDRRMO / public information office', 'before_impact_beyond_3d', None),
    ('Prepositioning', 'Preposition food and non-food relief items for the forecast affected population', 'IRR Rule IV Sec. 3(a)(i); Sec. 6(a)', 'CSWDO', 'before_impact_beyond_3d', None),
    ('Prepositioning', 'Preposition essential medicines, medical supplies and hygiene kits', 'IRR Rule IV Sec. 3(a)(ii)', 'CHO', 'before_impact_beyond_3d', None),
    ('Prepositioning', 'Stock animal feed, forage, emergency water and mobile veterinary kits', 'IRR Rule IV Sec. 3(a)(iii)', 'City Veterinary Office', 'within_3d', None),
    ('Prepositioning', 'Secure water and power supply for evacuation centres', 'IRR Rule IV Sec. 3(a)(iv)', 'GSO / utility providers', 'within_3d', None),
    ('Operational assets', 'Pre-deploy heavy equipment and road-clearing convoys', 'IRR Rule IV Sec. 3(b)(i)', 'City Engineering Office', 'within_3d', None),
    ('Operational assets', 'Activate transport for pre-emptive evacuation and supply distribution', 'IRR Rule IV Sec. 3(b)(ii)', 'GSO / CDRRMO', 'within_3d', None),
    ('Operational assets', 'Preposition response teams and their equipment', 'IRR Rule IV Sec. 3(b)(iii)', 'CDRRMO', 'within_3d', None),
    ('Evacuation', 'Conduct pre-emptive or forced evacuation of at-risk families', 'RA 12287 Sec. 9(c); IRR Rule IV Sec. 4(a)(i)', 'CDRRMO / BDRRMCs', 'within_3d', None),
    ('Evacuation', 'Assist evacuation of livestock, pets, crops and livelihood assets', 'IRR Rule IV Sec. 4(a)(ii)', 'City Agriculture Office / City Veterinary Office', 'within_3d', None),
    ('Evacuation', 'Open safe and inclusive evacuation centres and apply CCCM and IDP protection protocols', 'IRR Rule IV Sec. 4(b)', 'CSWDO', 'within_3d', None),
    ('Lifelines', 'Rapid safety inspection of evacuation centres and other critical facilities', 'IRR Rule IV Sec. 4(c)(i)', 'Building Official', 'within_3d', None),
    ('Lifelines', 'Coordinate load-shedding, water rationing and alternate logistics with utilities', 'IRR Rule IV Sec. 4(c)(ii)-(iii)', 'Utility providers', 'within_3d', None),
    ('Lifelines', 'Request pre-deployment of cell-on-wheels or satellite communication units', 'IRR Rule IV Sec. 4(c)(iv)', 'CDRRMO / telecommunications providers', 'within_3d', None),
    ('Volunteers', 'Mobilize accredited community disaster volunteers, CSOs and private partners under the deployment plan', 'RA 12287 Sec. 9(d); IRR Rule IV Sec. 5', 'CDRRMO', 'within_3d', None),
    ('Social amelioration', 'Identify and prioritize families using CBMS or the prevailing registry (no personal data copied into this platform)', 'IRR Rule IV Sec. 7(a)', 'CSWDO', 'before_impact_beyond_3d', None),
    ('Social amelioration', 'Release anticipatory cash or vouchers under the City guidelines', 'IRR Rule IV Sec. 7(b)-(c)', 'CSWDO / City Treasurer', 'within_3d', None),
    ('Agriculture and fisheries', 'Activate early-action protocols for farmers and fisherfolk (RSBSA, FishR, livestock registries)', 'IRR Rule IV Sec. 8', 'City Agriculture Office', 'before_impact_beyond_3d', None),
    ('Health', 'Activate the Health Cluster, service-continuity and surge plans; put health teams on standby', 'IRR Rule IV Sec. 9(a)', 'CHO / hospitals', 'within_3d', None),
    ('Education', 'Activate school anticipatory action plans and learning-continuity modalities', 'IRR Rule IV Sec. 10(a)', 'DepEd Schools Division', 'within_3d', None),
    ('Transportation', 'Pre-inspect bridges, clear roads, set alternate routes and traffic teams; coordinate with port operators', 'IRR Rule IV Sec. 10(b)', 'City Engineering Office / traffic office / DPWH', 'within_3d', None),
    ('Economy', 'Monitor prices of basic goods and act on profiteering before impact', 'IRR Rule IV Sec. 10(c)', 'DTI Leyte / city market office', 'within_3d', None),
    ('Environment', 'Declog waterways and drainage; stabilize slopes and coasts in delineated hazard zones', 'IRR Rule IV Sec. 10(d)(i)-(ii)', 'CENRO / City Engineering Office', 'before_impact_beyond_3d', None),
    ('Environment', 'Prepare safe disposal of debris and livestock carcasses', 'IRR Rule IV Sec. 10(d)(iii)', 'CENRO / GSO', 'within_3d', None),
    ('Evacuation', 'Evacuate coastal puroks exposed to the forecast storm surge height', 'IRR Rule IV Sec. 4(a)', 'CDRRMO / coastal BDRRMCs', 'within_3d', 'storm_surge'),
    ('Agriculture and fisheries', 'Advise early harvest and safe storage of crops; secure fishing boats', 'IRR Rule IV Sec. 8(b)', 'City Agriculture Office', 'before_impact_beyond_3d', 'tropical_cyclone'),
    ('Water supply', 'Implement water rationing and protect drinking-water sources', 'IRR Rule IV Sec. 4(c)(ii)', 'Water service provider / CHO', 'before_impact_beyond_3d', 'drought'),
    ('Reporting', 'Submit the report to OCD within 45 days of lifting: declaration status, AA fund use, estimated costs minimized', 'RA 12287 Sec. 8; IRR Rule VI Sec. 1', 'CDRRMO', 'after_lifting', None),
]

# --------------------------------------------------------- CDRRMO protocols ---
# Draft templates for CDRRMO validation. Thresholds that the City has not yet
# set are written as instructions to apply the City's own matrix, not as numbers.
PROTOCOLS = [
    dict(code='PR-DUTY-HANDOVER', title='Duty shift handover', category='daily_operations', owner_role='duty_officer',
         doc='MOO Ch.4', purpose='Keep 24/7 operations continuous between shifts.',
         trigger='Every change of duty shift at the Operations Center.',
         steps=[('Read the logbook entries since the last handover', False, False, 0),
                ('Review open incidents, resource requests and pending barangay reports', True, False, 5),
                ('Check the latest PAGASA and PHIVOLCS bulletins and record any change', True, True, 10),
                ('Run the radio net check with the barangays scheduled for this shift', True, True, 20),
                ('Check generator fuel, UPS and backup internet status', False, True, 25),
                ('Record handover notes and sign off with the incoming duty officer', True, True, 30)]),
    dict(code='PR-WARNING-DISSEM', title='Warning dissemination', category='warning', owner_role='duty_officer',
         doc='MOO Ch.4', purpose='Move a hazard bulletin to every at-risk purok, in a form people understand.',
         trigger='On receipt of a PAGASA, PHIVOLCS or MGB bulletin or advisory that affects Ormoc.',
         steps=[('Log the bulletin: issuer, number, time issued, hazard and areas', True, True, 0),
                ('Check it against the City warning-to-action matrix and note the matching alert and actions', True, True, 10),
                ('Notify the EOC Manager and CDRRMO Head; record the instruction received', True, True, 15),
                ('Issue the advisory in Cebuano, with Filipino/English and accessible formats as needed', True, False, 30),
                ('Send through every channel: emergency cell broadcast/SMS, radio, social media, barangay officials', True, True, 40),
                ('Confirm receipt from riverine, coastal and upland barangays first, then the rest', True, True, 60),
                ('Log barangays that did not confirm and assign follow-up', False, True, 75)]),
    dict(code='PR-EOC-ACTIVATE', title='EOC activation (Blue or Red)', category='eoc', owner_role='eoc_manager',
         doc='MOO Ch.4', purpose='Stand up the EOC quickly with the right people and records.',
         trigger='When the EOC is raised to Blue or Red as directed by the City Mayor (Responsible Official), or by the EOC Manager under the approved activation protocol.',
         steps=[('Record the level change and reason in the platform (logs it automatically). If no device can connect, write it in the paper logbook with the time and enter it once connected', True, False, 0),
                ('Notify CDRRMC members, cluster leads and liaison desks of the activation', True, True, 15),
                ('Fill EOC positions from the roster, with alternates', True, True, 30),
                ('Run the communications check on all redundant channels', True, True, 30),
                ('Set the operational period and the SitRep schedule', True, True, 45),
                ('Brief the Mayor on the situation and decisions needed', True, True, 60)]),
    dict(code='PR-PDRA', title='Pre-disaster risk assessment (PDRA)', category='anticipatory_action', owner_role='eoc_manager',
         doc='MOO Ch.4', purpose='Decide, from the forecast and local exposure, whether to monitor, act early or request a declaration.',
         trigger='When a forecast hazard may affect Ormoc.',
         steps=[('Convene the PDRA core group and record attendance by office', True, False, 0),
                ('Review the forecast: hazard, expected impact time, areas, impact level', True, True, 15),
                ('Identify exposed barangays, vulnerable groups, critical facilities and possible cascading hazards', True, True, 30),
                ('Classify the projected impact and compute the lead time left', True, False, 45),
                ('Decide: monitor, city early action, or request a State of Imminent Disaster; record the basis', True, True, 60),
                ('Record the PDRA in the platform and brief the CDRRMO Head', True, False, 75)]),
    dict(code='PR-SOID-REQUEST', title='State of Imminent Disaster: request and declaration', category='anticipatory_action', owner_role='eoc_manager',
         doc='SOP GOV-05', purpose='Follow RA 12287, its IRR and SOP GOV-05 from the PDRA to the Mayor\'s Executive Order.',
         trigger='When the PDRA classifies the projected impact as severe or its equivalent (including where IRR Rule II Sec. 4 factors support that classification below the thresholds) and there is enough lead time to carry out anticipatory action.',
         steps=[('Record the official forecast: issuer, time issued, validity, areas, expected impact time, and both the lead time from issuance and the time left before impact', True, True, 0),
                ('Attach the PDRA summary: exposure, projected severity, cascading hazards, sector needs, and any IRR Rule II Sec. 4 factors relied on', True, True, 10),
                ('Prepare the anticipatory action matrix: actions, owners, resources, funding source and target completion', True, False, None),
                ('Convene the CDRRMC (or its authorized mechanism) to review and endorse the request; record the minutes', True, True, None),
                ('Send the request to RDRRMC VIII and record the time sent and the acknowledgment (RDRRMC replies within 24 hours)', True, True, None),
                ('Record the RDRRMC VIII recommendation and its reference', True, True, None),
                ('City Legal Office confirms the prerequisites; prepare the Mayor\'s Executive Order (hazard, areas, validity, measures, offices, fund controls, reporting)', True, False, None),
                ('Record the EO number and time of declaration', True, True, None),
                ('Issue official public notice of the declaration and the actions required', True, False, None),
                ('Load the anticipatory action checklist and assign lead offices', True, False, None)]),
    dict(code='PR-SOC-DECLARE', title='State of Calamity: assessment, declaration and lifting', category='council', owner_role='cdrrmo_head',
         doc='SOP GOV-04', purpose='Follow RA 10121 Sec. 16 and SOP GOV-04: the Sangguniang Panlungsod declares or lifts, on the CDRRMC\'s recommendation.',
         trigger='When damage and needs reports indicate that a State of Calamity may be warranted.',
         steps=[('Log incoming reports from BDRRMCs, agencies, utilities and City offices with source, time, location and verification status', True, True, 0),
                ('Conduct and consolidate the RDANA with the sector offices; separate verified facts, estimates and gaps', True, True, None),
                ('Prepare the technical assessment: scale, severity, sectors, urgent needs, capacity, and the basis for or against declaring', True, False, None),
                ('Submit the assessment to the CDRRMC; record the deliberation and its recommendation', True, True, None),
                ('Transmit the recommendation and evidence to the Sangguniang Panlungsod; record the reference', True, True, None),
                ('Record the Sanggunian resolution number and date (a Mayor\'s EO does not substitute for it)', True, True, None),
                ('Implement the authorized measures and keep the post-declaration action and resource register', True, False, None),
                ('Recommend lifting when warranted and record the Sanggunian\'s lifting resolution', True, True, None),
                ('Archive the decision trail and schedule the after-action review', False, True, None)]),
    dict(code='PR-FLASHFLOOD-EARLY', title='Flash flood and landslide early action', category='anticipatory_action', owner_role='duty_officer',
         doc='MOO Ch.4', purpose='Act on short-lead hazards that cannot wait for a declaration.',
         trigger='When rainfall or river readings reach the City\'s early-action thresholds for the Anilao–Malbasag system or upland barangays.',
         steps=[('Record the reading, gauge or source, and the threshold reached', True, True, 0),
                ('Alert riverine and upland BDRRMCs by radio and SMS', True, True, 5),
                ('Recommend pre-emptive evacuation of the identified puroks to the EOC Manager', True, True, 10),
                ('Open the designated evacuation centres and alert CSWDO', True, False, 20),
                ('Position rescue teams at the agreed staging points', True, True, 30),
                ('Confirm evacuation counts from each barangay and log them', True, True, 60)]),
    dict(code='PR-SITREP-CYCLE', title='SitRep cycle', category='reporting', owner_role='eoc_staff',
         doc='MOO Ch.4', purpose='Produce a verified SitRep on schedule every operational period.',
         trigger='At each scheduled SitRep time during an activation.',
         steps=[('Collect barangay reports and cluster updates since the last SitRep', True, False, 0),
                ('Reconcile evacuation figures with evacuation-centre counts', True, True, 20),
                ('Draft the SitRep in the standard format', True, False, 40),
                ('EOC Manager reviews and approves', True, False, 55),
                ('Submit to OCD VIII and the Province; record the time sent', True, True, 60)]),
    dict(code='PR-CDRRMC-MEETING', title='CDRRMC meeting (secretariat)', category='council', owner_role='duty_officer',
         doc='MOO Ch.1', purpose='Run the Council meeting and keep its records complete.',
         trigger='Quarterly, and whenever the Chair calls a special meeting.',
         steps=[('Send the notice and agenda to all members', True, True, None),
                ('Record attendance and confirm quorum', True, True, None),
                ('Record decisions and draft resolutions', True, True, None),
                ('Circulate the minutes for approval', False, False, None),
                ('File approved minutes and resolutions; post as required', True, False, None)]),
    dict(code='PR-LIFT-REPORT', title='Lifting and 45-day report', category='anticipatory_action', owner_role='eoc_manager',
         doc='SOP GOV-05', purpose='Lift a State of Imminent Disaster correctly and report to OCD on time.',
         trigger='When the hazard occurs or the PDRA shows the projected impacts will not be met.',
         steps=[('Record the lifting ground and its basis (advisory, incident or situation report, or latest PDRA)', True, True, 0),
                ('Shift to response and early recovery if the hazard occurred', True, False, None),
                ('Record unutilized LDRRMF anticipatory funds; they revert per IRR Rule V Sec. 3 (accrue to the Special Trust Fund after the validity period). Hand stocks to CSWDO', True, True, None),
                ('Deliver perishable goods to the intended beneficiaries (no-regrets principle)', False, True, None),
                ('Compile declaration status, AA fund use and estimated costs minimized', True, False, None),
                ('Submit the report to OCD within 45 days of lifting and record the reference', True, True, None)]),
]


# ------------------------------------------------------------------- build ----
def main():
    domains, indicators, crosswalk = read_iat()
    mrs, doms_mrt, dd = read_mrt()
    assert len(indicators) == 140, len(indicators)

    out = dict(manual_parts=[dict(no=n, title=t, summary=sm, sort=n) for n, t, sm in MANUAL_PARTS],
               manual_areas=[dict(no=n, part_no=pt, title=t, scope=sc, mcr_primary=mp, mcr_supporting=ms, sort=i)
                             for i, (n, pt, t, sc, mp, ms) in enumerate(MANUAL_AREAS, 1)],
               parts=[dict(code='A', name='Part A – CDRRMO institutional capacity', in_imi=True, sort=1),
                      dict(code='B', name='Part B – Emergency Operations Center', in_imi=True, sort=2),
                      dict(code='C', name='Part C – Interface indicators', in_imi=False, sort=3)])
    out['domains'] = []
    for i, d in enumerate(domains, 1):
        m = doms_mrt[d['code']]
        out['domains'].append(dict(code=d['code'], part=d['part'], name=m['Domain'], scope=d['scope'],
                                   functional_area=m['Primary Functional Area'], platform_module=m['Platform Module'], sort=i))
    out['indicators'] = []
    for i, ind in enumerate(indicators, 1):
        tags = [t.strip() for t in str(dd[ind['id']]['Thematic Tags*']).split(';') if t.strip() and t.strip() != '—']
        fa = int(str(dd[ind['id']]['Primary Functional Area']).split()[0])
        out['indicators'].append(dict(ind, tags=tags, version_status=dd[ind['id']]['Version Status (v1.1)'],
                                      functional_area=fa, sort=i))
    out['master_requirements'] = [dict(
        id=m['Req ID'], title=m['Requirement / Source Objective'], statement=m['Requirement Statement'],
        source_basis=m['Source Basis'], iat_coverage=m['IAT Coverage'], evidence=m['Evidence / Verification'],
        sa_output=m['Situational Analysis Output'], moo_output=m['Draft MOO Output'],
        platform_req=m['Platform Requirement / UX Workflow'], data_entities=m['Core Data Entities'],
        escalation_rule=m['Priority / Escalation Rule'], priority=m['Priority'], sort=i) for i, m in enumerate(mrs, 1)]
    links = []
    for ind in indicators:
        raw = str(dd[ind['id']]['Master Requirement(s)*'])
        ids = []
        for tok in [t.strip() for t in raw.split(';')]:
            if tok == 'MR-12–MR-15':
                ids += ['MR-12', 'MR-13', 'MR-14', 'MR-15']
            elif tok:
                ids.append(tok)
        for mr in dict.fromkeys(ids):
            links.append(dict(indicator_id=ind['id'], mr_id=mr))
    out['indicator_requirements'] = links
    out['crosswalk'] = [dict(c, sort=i) for i, c in enumerate(crosswalk, 1)]

    out['offices'] = [dict(id=uid('office', c), code=c, name=n, kind=k) for c, n, k in OFFICES]
    office_id = {o['code']: o['id'] for o in out['offices']}
    out['indicator_lead_offices'] = [dict(indicator_id=i['id'], office_id=office_id[c])
                                     for i in indicators if i['lead_office'] for c in lead_offices(i['lead_office'])]

    out['hazards'] = [dict(code=c, name=n, forecastable=f, typical_lead_hours=l, declaration_eligible=e, note=no, aa_family=fam, sort=i)
                      for i, (c, n, f, l, e, no, fam) in enumerate(HAZARDS, 1)]

    # ---- Library: one manual, five Parts, ten functional areas (ADR-012) ----
    docs, doc_links, versions = [], [], []
    by_ch: dict[str, list[dict]] = {}
    for ind in indicators:
        for ch in chapters_of(ind['moo_chapter']):
            by_ch.setdefault(ch, []).append(ind)
    legacy = list(MOO_TITLES) + [ANNEX_JD]
    missing = [c for c in by_ch if c not in legacy]
    legacy.append('MOO Annex 1-0')
    assert not missing, missing
    by_fa: dict[int, list[dict]] = {}
    for ind in out['indicators']:
        by_fa.setdefault(ind['functional_area'], []).append(ind)
    area_id = {n: uid('doc', f'Area {n}') for n, *_ in MANUAL_AREAS}
    sort = 0

    def requirement_lines(inds):
        lines = []
        for ind in inds:
            lines.append(f'- **{ind["id"]}** ({ind["type"]}, weight {ind["weight"]}) {ind["statement"]}  ')
            lines.append(f'  *Basis:* {ind["reference"]}')
        return lines or ['- None yet. No indicator in the Traceability Dictionary v1.1 names this as its primary area.']

    # 1. Area outlines: the home of every gap whose primary functional area this is.
    part_title = {n: t for n, t, _ in MANUAL_PARTS}
    for n, part, title, scope, mcr_p, mcr_s in MANUAL_AREAS:
        sort += 1
        merged = [c for c, fa in MERGED.items() if fa == n]
        inds = by_fa.get(n, [])
        chapters = [f'{v[0]}: {v[4]}' for v in CHAPTERS.values() if v[2] == n or n in v[3]]
        body = [f'# Area {n}. {title}', '',
                f'**Part {part}: {part_title[part]}**', '',
                '> Outline generated from the Inception Report (Annex A) and the Traceability Dictionary v1.1. '
                'Drafted chapters that serve this area are listed below; write the remaining procedures here or in a new chapter.', '',
                '## Scope', '', scope + '.', '',
                '## MCR2030 alignment', '', f'- Primary: {mcr_p}', f'- Supporting: {mcr_s}', '',
                '## Drafted chapters for this area', '']
        body += [f'- {c}' for c in chapters] or ['- None yet.']
        body += ['', '## Sections merged into this area', '',
                 'These sections of the earlier two-manual outline were merged here in v1.6. Their codes still find this page.', '']
        body += [f'- {c} ({MOO_TITLES[c]})' for c in merged] or ['- None.']
        body += ['', f'## Requirements this area must meet ({len(inds)} indicators)', ''] + requirement_lines(inds)
        did = area_id[n]
        docs.append(dict(id=did, manual='MOO', kind='area', code=f'Area {n}', title=title, parent_id=None,
                         summary=f'Part {part}. {len(inds)} IAT indicator(s) name this as their primary area.',
                         status='draft', sort=sort, current_version_id=None, area_no=n, chapter_no=None,
                         aliases=merged, also_areas=[]))
        versions.append(dict(id=uid('docver', f'Area {n}', 'v0.1'), document_id=did, label='v0.1 outline',
                             body_md='\n'.join(body), change_note='Generated from the Inception Report (Annex A) and Traceability v1.1',
                             status='draft'))
        doc_links += [dict(document_id=did, indicator_id=i['id']) for i in inds]

    # 2. Legacy shells: three become Chapters 1-3, the rest are superseded by their area.
    superseded = []
    for code in legacy:
        did = uid('doc', code)
        inds = by_ch.get(code, [])
        sort += 1
        if code in CHAPTERS:
            nc, no, fa, also, title = CHAPTERS[code]
            docs.append(dict(id=did, manual='MOO', kind='chapter', code=nc, title=title, parent_id=None,
                             summary=None, status='draft', sort=sort, current_version_id=None, area_no=fa,
                             chapter_no=no, aliases=[code] + [k for k, v in RETIRED.items() if v == code and k == ANNEX_JD],
                             also_areas=also))
            extra = {'MOO Ch.3': _CH3_INDS, 'MOO Ch.5': _CH5REC_INDS, 'MOO Ch.6': _CH6_INDS,
                     'MOO Ch.7': _CH7_INDS, 'MOO Ch.8': _CH8_INDS}.get(code, [])
            doc_links += [dict(document_id=did, indicator_id=i) for i in dict.fromkeys([i['id'] for i in inds] + extra)]
        else:
            parent = uid('doc', RETIRED[code]) if code in RETIRED else area_id[MERGED[code]]
            into = new_code(RETIRED[code]) if code in RETIRED else f'Area {MERGED[code]}'
            docs.append(dict(id=did, manual=code.split()[0], kind='annex' if code in RETIRED else 'chapter', code=code,
                             title=MOO_TITLES.get(code, LEGACY_TITLES.get(code, '')), parent_id=parent,
                             summary=f'Merged into {into} in v1.6. Kept for history; open {into} instead.',
                             status='superseded', sort=sort, current_version_id=None,
                             area_no=MERGED.get(code) or CHAPTERS[RETIRED[code]][2], chapter_no=None, aliases=[], also_areas=[]))
            superseded.append(did)
        if code == 'MOO Annex 1-0':  # the v0.9 package-control annex keeps its own text
            versions.append(dict(id=uid('docver', code, 'v0.9 consolidated draft'), document_id=did, label='v0.9 consolidated draft',
                                 body_md=(ROOT / 'reference' / 'moo' / 'Annex_1_00_package_control.md').read_text(encoding='utf-8'),
                                 change_note='Chapter 1 consolidated draft v0.9 (31 Oct 2026)', status='draft'))
            continue
        body = [f'# {code} – {MOO_TITLES.get(code, LEGACY_TITLES.get(code))}', '',
                '> Skeleton generated from IAT v1.1. Replace each requirement with the City\'s procedure, standard or form.', '',
                '## Requirements this section must meet', ''] + requirement_lines(inds)
        versions.append(dict(id=uid('docver', code, 'v0.1'), document_id=did, label='v0.1 skeleton', body_md='\n'.join(body),
                             change_note='Generated from IAT v1.1', status='draft'))

    # 3. Drafted text (chapters, annexes, SOPs, forms).
    known = {d['id']: d for d in docs}
    ind_ids = {i['id'] for i in indicators}
    for code, manual, kind, title, fname, label, inds in LIBRARY_DRAFTS:
        body = (ROOT / 'reference' / 'moo' / fname).read_text(encoding='utf-8')
        did = uid('doc', code)
        ch = chapter_of(code) or chapter_of(fname)
        chap_legacy = f'MOO Ch.{ch}'
        if code == 'MOO Ch.0':  # front matter, not a chapter (ADR-032 addendum)
            where, chapter_no = 'Introduction', None
        else:
            where, chapter_no = f'Chapter {ch}', ch
        if did not in known:
            sort += 1
            nc = new_code(code)
            if code in AREA_ONLY_DRAFTS:  # a text whose chapter is not drafted yet: it sits under its area outline
                area = AREA_ONLY_DRAFTS[code]
                parent, where, chapter_no = uid('doc', f'Area {area}'), f'Area {area}', None
            else:
                area = CHAPTERS[chap_legacy][2]
            docs.append(dict(id=did, manual='MOO', kind=kind, code=nc, title=title, parent_id=parent,
                             summary=f'{where} draft ({label}). {len(inds)} IAT indicator(s) linked.',
                             status='draft', sort=sort, current_version_id=None, area_no=area,
                             chapter_no=chapter_no, aliases=[code] if nc != code else [], also_areas=[]))
            known[did] = docs[-1]
            bad = [i for i in inds if i not in ind_ids]
            assert not bad, (code, bad)
            doc_links += [dict(document_id=did, indicator_id=i) for i in inds]
        versions.append(dict(id=uid('docver', code, label), document_id=did, label=label, body_md=body,
                             change_note=f'Loaded from reference/moo/{fname} ({where}, {label})',
                             status='draft'))
    for d in docs:
        if d['kind'] == 'chapter' and d['status'] != 'superseded' and d['id'] != uid('doc', 'MOO Ch.0'):
            n = sum(1 for x in docs if x['parent_id'] == d['id'] and x['status'] != 'superseded')
            d['summary'] = f'Area {d["area_no"]}. Drafted chapter with {n} annex(es), SOP(s) and form(s).'
        if d['id'] == uid('doc', 'MOO Ch.0'):
            d['summary'] = ('Front matter, not a chapter (ADR-032 addendum). Purpose, city context, legal basis, '
                            'structure, the assessment-informed method and systems diagnosis, design principles, '
                            'invariants, conventions and abbreviations shared by all ten chapters.')

    # Links inside drafted text: (doc:<code or alias>) -> /library/doc/<id>
    by_code = {}
    for d in docs:
        for c in [d['code']] + d['aliases']:
            by_code.setdefault(c, d['id'])
    for v in versions:
        def link(m):
            assert m.group(1) in by_code, ('unknown doc link', m.group(1))
            return f'(/library/doc/{by_code[m.group(1)]})'
        v['body_md'] = re.sub(r'\(doc:([^)]+)\)', link, v['body_md'])
    doc_links = [l for l in doc_links if l['document_id'] not in superseded]
    out['superseded_documents'] = superseded
    out['moo_documents'], out['moo_versions'], out['moo_document_indicators'] = docs, versions, doc_links

    def doc_home(code):  # merged shells hand their protocols to the area outline
        return uid('doc', f'Area {MERGED[code]}') if code in MERGED else uid('doc', code)
    # 1.9.0: every step has a form (ADR-016): the Manual's form where one exists, otherwise STEP-RECORD.
    import json as _json
    from forms_seed import FORMS, STEP_FORMS, WORKFLOWS
    from sop_registry import META, CH3_FORMS, CH3_WORKFLOWS, PROTOCOL_CATEGORIES  # 1.10.0 (ADR-019)
    from sop_registry import CH4_FORMS, CH4_PROTOCOLS  # 1.11.0: Chapter 4 v1.1
    from sop_registry import CH6_FORMS, CH6_PROCEDURES  # 1.18: Chapter 6 v1.1 (renumbered from Ch.5 v1.0)
    from sop_registry import CH5REC_PROCEDURES, CH7_PROCEDURES, CH8_PROCEDURES  # 1.18: Chapters 5 (recovery), 7 and 8
    FORMS = FORMS + CH3_FORMS + CH4_FORMS + CH6_FORMS
    WORKFLOWS = (WORKFLOWS + CH3_WORKFLOWS + CH4_PROTOCOLS + CH6_PROCEDURES
                 + CH5REC_PROCEDURES + CH7_PROCEDURES + CH8_PROCEDURES)
    known_inds = {i['id'] for i in out['indicators']}
    out['form_templates'] = [dict(id=uid('form', c), code=c, title=t, purpose=pu, document_id=doc_home(d),
                                  schema=_json.dumps({'fields': flds}, ensure_ascii=False), status='draft', rev=1)
                             for c, t, pu, d, flds in FORMS]
    # 1.18: a step may name a Manual form (e.g. ME-F01, PTN-F03) that has no template yet. protocol_steps.form_code
    # is a foreign key to form_templates, so an unbuilt form falls back to STEP-RECORD (ADR-016) and is listed
    # here; the step instruction still names the Manual form. Build the template, and the step picks it up.
    known_forms = {c for c, *_ in FORMS}
    unbuilt_forms = {}
    tpls, steps = [], []
    for p in PROTOCOLS + WORKFLOWS:
        tid = uid('protocol', p['code'])
        sop_ref, owner, refs, inds = META[p['code']]
        bad = [i for i in inds if i not in known_inds]
        assert not bad, (p['code'], 'unknown IAT indicators', bad)
        tpls.append(dict(id=tid, code=p['code'], title=p['title'], purpose=p['purpose'], trigger_text=p['trigger'],
                         document_id=doc_home(p['doc']), owner_role=p['owner_role'], category=p['category'],
                         status='draft', template_rev=1,
                         kind='protocol' if p['category'] in PROTOCOL_CATEGORIES else 'workflow',
                         sop_ref=sop_ref, process_owner=owner, policy_refs=refs, indicator_ids=inds))
        for seq, st in enumerate(p['steps'], 1):
            instr, crit, note, due = st[:4]
            form = (st[4] if len(st) > 4 else None) or STEP_FORMS.get((p['code'], seq)) or 'STEP-RECORD'
            if form not in known_forms:
                unbuilt_forms.setdefault(form, []).append(f"{p['code']} step {seq}")
                form = 'STEP-RECORD'
            steps.append(dict(id=uid('pstep', p['code'], str(seq)), template_id=tid, seq=seq, instruction=instr,
                              is_critical=crit, requires_note=note, due_offset_minutes=due, form_code=form))
    out['protocol_templates'], out['protocol_steps'] = tpls, steps
    if unbuilt_forms:
        print(f'note: {len(unbuilt_forms)} Manual forms named on steps have no template yet; '
              'those steps use STEP-RECORD:')
        for c in sorted(unbuilt_forms):
            print(f'  {c}: {", ".join(unbuilt_forms[c])}')

    out['aa_action_templates'] = [dict(id=uid('aa', str(i)), hazard_code=h, sector=s, title=t, irr_ref=r, lead_office=lo,
                                       timing=tm, seq=i)
                                  for i, (s, t, r, lo, tm, h) in enumerate(AA_TEMPLATES, 1)]

    (ROOT / 'src' / 'data').mkdir(parents=True, exist_ok=True)
    (ROOT / 'src' / 'data' / 'reference.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
    write_sql(out)
    print({k: len(v) for k, v in out.items()})


def lit(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return "array[" + ','.join(lit(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    t = str(v)
    if '\n' in t or '\r' in t:
        # Multi-line text (manual drafts) goes on one line as an escape string, so a part never
        # exceeds the SQL editor's line limit however long the chapter is.
        t = t.replace('\\', '\\\\').replace("'", "''").replace('\r', '').replace('\n', '\\n')
        return "E'" + t + "'"
    return "'" + t.replace("'", "''") + "'"


# The Supabase SQL editor rejects long scripts, so the seed is also written as parts:
# each part is one transaction under these limits, and large tables are split by rows.
PART_MAX_LINES = 400
PART_MAX_BYTES = 100_000


def row_sql(r, cols, cast):
    return '(' + ','.join(lit(r.get(c)) + cast.get(c, '') for c in cols) + ')'


def upsert_chunks(table, rows, key, cols=None, cast=None, conflict=True, keep=()):
    """Insert statements for one table, split so each stays well inside one part.
    Columns in `keep` are written on first insert only, so a re-seed never resets them
    (for example the approval status the City sets in the app). keep='*' updates nothing."""
    if not rows:
        return []
    cols = cols or list(rows[0].keys())
    cast = cast or {}
    if conflict:
        keys = key if isinstance(key, list) else [key]
        upd = [] if keep == '*' else [c for c in cols if c not in keys and c not in keep]
        action = ('do update set ' + ', '.join(f'{c} = excluded.{c}' for c in upd)) if upd else 'do nothing'
        tail = f'\non conflict ({",".join(keys)}) {action};\n\n'
    else:
        tail = ';\n\n'
    head = f'insert into public.{table} ({",".join(cols)}) values\n'
    budget_lines, budget_bytes = PART_MAX_LINES - 20, PART_MAX_BYTES - 8_000
    chunks, cur, lines, size = [], [], 0, 0
    for r in rows:
        t = row_sql(r, cols, cast)
        n, b = t.count('\n') + 1, len(t.encode())
        if cur and (lines + n > budget_lines or size + b > budget_bytes):
            chunks.append(cur); cur, lines, size = [], 0, 0
        cur.append(t); lines += n; size += b
    if cur:
        chunks.append(cur)
    return [(table, head + ',\n'.join(c) + tail) for c in chunks]


def replace_links_by_indicator(links):
    """indicator_requirements, chunked by whole indicators. Each chunk first deletes the
    links of its own indicators and then inserts them, so any part can be re-run alone
    without touching rows another part loaded."""
    by_ind = {}
    for r in links:
        by_ind.setdefault(r['indicator_id'], []).append(r)
    budget = PART_MAX_LINES - 40
    groups, cur, n = [], [], 0
    for ind, rows in by_ind.items():
        if cur and n + len(rows) > budget:
            groups.append(cur); cur, n = [], 0
        cur.append(ind); n += len(rows)
    if cur:
        groups.append(cur)
    out = []
    for g in groups:
        rows = [r for ind in g for r in by_ind[ind]]
        delete = ('delete from public.indicator_requirements where indicator_id in ('
                  + ','.join(lit(i) for i in g) + ');\n')
        (_, ins), = upsert_chunks('indicator_requirements', rows, ['indicator_id', 'mr_id'])
        out.append(('indicator_requirements', delete + ins))
    return out


def version_statements(rows):
    """moo_versions, with any body too long for one SQL-editor part sent in pieces (1.9.0: Chapter 1 v1.2 is
    about 128 KB). The row is inserted with the first piece; each further piece is appended only while the
    body is exactly as long as the pieces before it, so a re-run (row already complete) changes nothing and
    an approved text is never touched."""
    cast = {'id': '::uuid', 'document_id': '::uuid'}
    piece_bytes = PART_MAX_BYTES - 12_000
    small, out = [], []
    for r in rows:
        if len(row_sql(r, list(r.keys()), cast).encode()) < piece_bytes:
            small.append(r); continue
        body, pieces, cur = r['body_md'], [], ''
        for line in body.splitlines(keepends=True):
            if cur and len((cur + line).encode()) > piece_bytes - 4_000:
                pieces.append(cur); cur = ''
            cur += line
        pieces.append(cur)
        (_, first), = upsert_chunks('moo_versions', [{**r, 'body_md': pieces[0]}], 'id', cast=cast, keep='*')
        out.append(('moo_versions', first))
        done = len(pieces[0])
        for piece in pieces[1:]:
            out.append(('moo_versions', f"update public.moo_versions set body_md = body_md || {lit(piece)}\n"
                        f"where id = {lit(r['id'])}::uuid and status = 'draft' and length(body_md) = {done};\n\n"))
            done += len(piece)
    return upsert_chunks('moo_versions', small, 'id', cast=cast, keep='*') + out


def statements(o):
    st = []
    st += upsert_chunks('manual_parts', o['manual_parts'], 'no')
    st += upsert_chunks('manual_areas', o['manual_areas'], 'no')
    st += upsert_chunks('iat_parts', o['parts'], 'code')
    st += upsert_chunks('iat_domains', o['domains'], 'code')
    st += upsert_chunks('iat_indicators', o['indicators'], 'id')
    st += upsert_chunks('master_requirements', o['master_requirements'], 'id')
    st += replace_links_by_indicator(o['indicator_requirements'])
    # The crosswalk has no natural key, so it is replaced whole: delete and insert stay in
    # one statement group, which therefore always lands in one part.
    cw = upsert_chunks('framework_crosswalk', o['crosswalk'], None,
                       cols=['framework', 'ref', 'subject', 'treatment', 'indicators', 'note', 'sort'], conflict=False)
    assert len(cw) == 1, 'framework_crosswalk no longer fits one part; give it a key and chunk it'
    st.append(('framework_crosswalk', 'delete from public.framework_crosswalk;\n' + cw[0][1]))
    st += upsert_chunks('offices', o['offices'], 'id', cast={'id': '::uuid'})
    st += upsert_chunks('indicator_lead_offices', o['indicator_lead_offices'], ['indicator_id', 'office_id'], cast={'office_id': '::uuid'})
    st += upsert_chunks('hazards', o['hazards'], 'code')
    # Parents first: area outlines and chapters, then everything that points at them.
    docs = sorted(o['moo_documents'], key=lambda d: d['parent_id'] is not None)
    st += upsert_chunks('moo_documents', docs, 'id',
                        cols=['id', 'manual', 'kind', 'code', 'title', 'parent_id', 'summary', 'status', 'sort',
                              'area_no', 'chapter_no', 'aliases', 'also_areas'],
                        cast={'id': '::uuid', 'parent_id': '::uuid', 'also_areas': '::smallint[]'},
                        keep=('status',))
    # v1.6: the merged shells step aside (only while still unapproved), and their indicator links move to the areas.
    ids = ','.join(lit(i) + '::uuid' for i in o['superseded_documents'])
    st.append(('moo_documents', f"update public.moo_documents set status = 'superseded' where id in ({ids}) and status in ('draft','in_review');\n"
                                f"delete from public.moo_document_indicators where document_id in ({ids});\n\n"))
    # 1.15: a legacy shell that has since been drafted as a chapter (Chapters 4 and 5) must not stay superseded from an
    # earlier load. Only a superseded shell changes; draft, review and approval states are left alone.
    chap_ids = ','.join(lit(uid('doc', c)) + '::uuid' for c in CHAPTERS)
    st.append(('moo_documents', f"update public.moo_documents set status = 'draft', parent_id = null where id in ({chap_ids}) and status = 'superseded';\n\n"))
    # Versions belong to the Library workflow once loaded (drafts get edited, reviewed, approved).
    st += version_statements(o['moo_versions'])
    st += upsert_chunks('moo_document_indicators', o['moo_document_indicators'], ['document_id', 'indicator_id'], cast={'document_id': '::uuid'})
    # Forms before the steps that name them. Fields are written on first load only: afterwards the Library
    # workflow (draft, approve) owns them, as for manual versions.
    st += upsert_chunks('form_templates', o['form_templates'], 'id',
                        cast={'id': '::uuid', 'document_id': '::uuid', 'schema': '::jsonb'}, keep=('status', 'rev', 'schema'))
    st += upsert_chunks('protocol_templates', o['protocol_templates'], 'id',
                        cast={'id': '::uuid', 'document_id': '::uuid', 'owner_role': '::public.app_role'},
                        keep=('status', 'template_rev'))  # template_rev is bumped by the step trigger
    st += upsert_chunks('protocol_steps', o['protocol_steps'], 'id', cast={'id': '::uuid', 'template_id': '::uuid'})
    st += upsert_chunks('aa_action_templates', o['aa_action_templates'], 'id', cast={'id': '::uuid'})
    return st


CHECK_SQL = """-- Expected: 140 | 18 | 935 | 71 | 36 | 250 | 29 | 10 | 140 | 59
select (select count(*) from public.iat_indicators)         as indicators,
       (select count(*) from public.master_requirements)    as requirements,
       (select count(*) from public.indicator_requirements) as indicator_links,
       (select count(*) from public.framework_crosswalk)    as crosswalk,
       (select count(*) from public.protocol_templates)     as protocols,
       (select count(*) from public.protocol_steps)         as protocol_steps,
       (select count(*) from public.aa_action_templates)    as aa_actions,
       (select count(*) from public.manual_areas)           as manual_areas,
       (select count(*) from public.iat_indicators where functional_area is not null) as indicators_with_area,
       (select count(*) from public.form_templates)         as forms;
"""

HEADER = ('-- GENERATED by scripts/generate_seed.py from reference/*.xlsx — do not edit by hand.\n'
          '-- Reference data only. No personal data. Protocols and AA items are DRAFT for CDRRMO validation.\n')


def write_sql(o):
    st = statements(o)
    seed_dir = ROOT / 'supabase' / 'seed'
    seed_dir.mkdir(parents=True, exist_ok=True)
    (seed_dir / 'seed.sql').write_text(HEADER + 'begin;\n\n' + ''.join(t for _, t in st) + 'commit;\n')

    # Pack statements into parts, in order (parents before children).
    parts, cur, lines, size = [], [], 0, 0
    for tbl, t in st:
        n, b = t.count('\n'), len(t.encode())
        if cur and (lines + n > PART_MAX_LINES - 12 or size + b > PART_MAX_BYTES - 2_000):
            parts.append(cur); cur, lines, size = [], 0, 0
        cur.append((tbl, t)); lines += n; size += b
    parts.append(cur)
    part_dir = seed_dir / 'parts'
    part_dir.mkdir(exist_ok=True)
    # Remove only the parts this script writes (NN_seed.sql). Parts made by other generators,
    # such as 26a_ddrive.sql ... from scripts/ddrive_seed.py, are kept (audit 11 Nov 2026, R3).
    for old in part_dir.glob('[0-9][0-9]_seed.sql'):
        old.unlink()
    total = len(parts)
    for i, part in enumerate(parts, 1):
        tables = list(dict.fromkeys(tbl for tbl, _ in part))
        body = (HEADER + f'-- Part {i} of {total}: {", ".join(tables)}\n'
                f'-- Run the parts in order in the Supabase SQL editor. A part can be run again safely.\n'
                'begin;\n\n' + ''.join(t for _, t in part) + 'commit;\n')
        if i == total:
            body += '\n' + CHECK_SQL
        (part_dir / f'{i:02d}_seed.sql').write_text(body)
    print(f'seed: {len(st)} statements in {total} parts')


if __name__ == '__main__':
    main()
