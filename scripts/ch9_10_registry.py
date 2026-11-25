"""Runnable templates for Manual Chapters 9 and 10 (Consolidated Draft 1.0, 12 Nov 2026).

The protocols and workflows are read from the chapter text itself (reference/moo/consolidated/09_*.md and
10_*.md, made by split_consolidated_md.py): each SOP's control block gives the template code, owner, trigger,
policy basis and IAT indicators, and its steps table gives the steps. Editing the chapter and re-running
generate_seed.py updates the templates, so the Manual and MODE cannot drift apart.

All templates are DRAFT and NOT VALIDATED. They are loaded so offices can run and test them before and at
the 1-4 Dec 2026 validation workshop; the workshop result changes the text, not this file.
Forms follow each chapter's forms register (Ch.9 Table 9.28, Ch.10 Table 10.23) with short, predictable
fields. Positions, never personal names (RA 10173).
"""
from __future__ import annotations

import html
import re
from pathlib import Path

from forms_seed import f

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'reference' / 'moo' / 'consolidated'
VERSION = 'Consolidated Draft 1.0'

# Category per SOP (labels in src/features/protocols/labels.ts; migration 20261125003800).
CATEGORY = {**{f'9-0{i}': 'capacity' for i in range(1, 10)},
            '10-01': 'sustainability', '10-02': 'sustainability', '10-03': 'continuity', '10-04': 'continuity',
            '10-05': 'sustainability', '10-06': 'sustainability', '10-07': 'sustainability'}
# Who opens a run in MODE (app_role). Approval stays with the decision authority named in the step.
OWNER_ROLE = {'10-02': 'eoc_manager', '10-04': 'eoc_manager'}
# Step wording that needs a condition the chapter text does not state (decisions of 18 Nov 2026).
STEP_NOTES = {
    # NDRRMC Memo 131 s.2018: an alternate EOC "may be established, as needed"; the City does not require one.
    '10-04': 'Alternate EOC items apply only where the City has designated an alternate EOC (IAT B2.7 is N/A otherwise).',
}

_TAG = re.compile(r'<[^>]+>')


def _cells(row: str) -> list[str]:
    out = []
    for c in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row, re.S):
        paras = [html.unescape(_TAG.sub('', p)).strip() for p in re.split(r'</p>\s*<p>', c)]
        out.append('\n'.join(p for p in paras if p))
    return out


def _field(cell: str, key: str) -> str:
    m = re.search(rf'^{key}:\s*(.+)$', cell, re.M)
    return m.group(1).strip() if m else ''


def _control(block: str) -> dict[str, str]:
    rows = {}
    for line in block.splitlines():
        m = re.match(r'\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$', line)
        if m and not set(m.group(1)) <= set('-') and '**' not in m.group(1):
            rows[m.group(1)] = m.group(2)
    return rows


def _indicators(text: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r'\b([ABC]\d{1,2}\.\d{1,2})\b', text)))


def parse_sops(path: Path) -> list[dict]:
    text = path.read_text(encoding='utf-8')
    heads = list(re.finditer(r'^### SOP (\d+-\d+) \\\| (.+)$', text, re.M))
    sops = []
    for i, h in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else text.find('\n## ', h.end())
        body = text[h.end():end]
        owner_m = re.search(r'\*\*Process owner:\*\*\s*(.+?)\s*\*\*Purpose:\*\*\s*(.+)', body)
        ctl = _control(body.split('<table>')[0])
        kind_line = ctl['Type and MODE template']
        code = re.search(r'\b((?:WF|PR)-[A-Z0-9-]+)', kind_line).group(1)
        steps = []
        for row in re.findall(r'<tr[^>]*>(.*?)</tr>', body, re.S):
            c = _cells(row)
            if len(c) != 5 or c[0].startswith('Step'):
                continue
            title = re.sub(r'^\d+\.\s*', '', c[0])
            action = '\n'.join(l for l in c[2].splitlines() if not l.startswith('Decision:'))
            decision = _field(c[2], 'Decision')
            outputs = _field(c[3], 'Out')
            timing, control, escalate = _field(c[4], 'Time'), _field(c[4], 'Control'), _field(c[4], 'Escalate')
            instr = f'{title} ({c[1]}). {action}'.strip()
            if decision:
                instr += f' Check: {decision}'
            if outputs:
                instr += f' Record: {outputs}.'
            if timing or escalate:
                instr += f' [{", ".join(x for x in (f"When: {timing}" if timing else "", f"Escalate to: {escalate}" if escalate else "") if x)}]'
            form = next(iter(re.findall(r'\b((?:CAP|SUS)-F\d{2})\b', outputs)), None)
            # Critical: approvals and decisions by the CDRRMC, the Mayor or the CDRRMO Head, and life-safety steps.
            critical = bool(re.search(r'CDRRMC|Mayor|CDRRMO Head|Sanggunian', c[1])) or 'life-safety' in (c[2] + control).lower()
            steps.append((instr, critical, bool(decision), None, form))
        if not steps:
            raise SystemExit(f'SOP {h.group(1)}: no steps parsed from {path.name}')
        sop = h.group(1)
        if sop in STEP_NOTES:
            steps = [(f'{s[0]} Note: {STEP_NOTES[sop]}', *s[1:]) if i == 0 else s for i, s in enumerate(steps)]
        doc = f'MOO Ch.{sop.split("-")[0]}'
        inds = _indicators(ctl.get('IAT v1.7 indicators', ''))
        refs = [r.strip() for r in re.split(r';\s*', ctl.get('Policy basis', '')) if r.strip()]
        sops.append(dict(
            code=code, title=f'SOP {sop} {h.group(2).strip()}', category=CATEGORY[sop],
            kind='protocol' if kind_line.lower().startswith('protocol') else 'workflow',
            owner_role=OWNER_ROLE.get(sop, 'cdrrmo_head'), doc=doc,
            purpose=(owner_m.group(2).strip() if owner_m else ctl.get('Purpose', '')) +
                    ' Draft for validation; not yet validated by the CDRRMO.',
            trigger=ctl.get('Trigger', ''), steps=steps,
            meta=(f'SOP {sop} ({doc} {VERSION})', ctl.get('Process owner (operational)', owner_m.group(1) if owner_m else ''),
                  refs, inds)))
    return sops


def _one(pattern: str) -> Path:
    found = sorted(SRC.glob(pattern))
    if len(found) != 1:
        raise SystemExit(f'Run scripts/split_consolidated_md.py first (expected one {pattern} in {SRC})')
    return found[0]


CH9_PROCEDURES = parse_sops(_one('09_*.md'))
CH10_PROCEDURES = parse_sops(_one('10_*.md'))
CH910_META = {p['code']: p.pop('meta') for p in CH9_PROCEDURES + CH10_PROCEDURES}

_OFFICE = 'Office (CDRRMO division, City office or barangay)'
_GROUPS = ['CDRRMO staff', 'EOC staff', 'City offices', 'BDRRMC', 'Schools', 'Health facilities', 'Volunteers', 'Partners']
_MET = ['Met', 'Partly met', 'Not met', 'Not checked']
_STATUS = ['Not started', 'In progress', 'Done', 'Stalled', 'Not applicable']

CH910_FORMS = [
    # Chapter 9 (Table 9.28)
    ('CAP-F01', 'DRRM skills inventory', 'Chapter 9 CAP-F01 (SOP 9-01). Counts by skill, office and barangay; blank means "not reported".', 'MOO Ch.9', [
        f('unit', _OFFICE, 'text', True), f('skill', 'Skill', 'select', True, ['ICS', 'Basic life support / first aid', 'Water search and rescue',
          'Collapsed structure search and rescue', 'CCCM', 'RDANA', 'Early warning', 'GIS', 'Psychosocial first aid', 'Other']),
        f('count', 'People with the skill', 'integer', True, min=0), f('last_trained', 'Most recent training', 'date'),
        f('lapsed', 'Refresher lapsed', 'integer', min=0, hint='Number of people past their refresher date')]),
    ('CAP-F02', 'Annual City DRRM training plan entry', 'Chapter 9 CAP-F02 (SOP 9-01). One course per entry; every course has an evaluation method.', 'MOO Ch.9', [
        f('course', 'Course', 'text', True), f('target_group', 'Target group', 'multiselect', True, _GROUPS),
        f('gap_source', 'Gap source', 'select', True, ['Competency matrix (Annex 9-B)', 'IAT gap', 'AAR finding', 'Lapsed refresher', 'Post-election orientation']),
        f('provider', 'Provider', 'text', True), f('month', 'Planned month', 'select', True,
          ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']),
        f('cost', 'Estimated cost (PHP)', 'integer', min=0), f('evaluation', 'Evaluation method', 'select', True,
          ['Written test', 'Practical assessment', 'Drill observation', 'Pre- and post-test', 'Attendance only']),
        f('ldrrmfip_line', 'LDRRMFIP line', 'text')]),
    ('CAP-F03', 'Training and competence record', 'Chapter 9 CAP-F03 (SOP 9-02). One record per course run; refresher date set on completion.', 'MOO Ch.9', [
        f('course', 'Course', 'text', True), f('date', 'Date', 'date', True), f('target_group', 'Group', 'select', True, _GROUPS),
        f('attended', 'Attended', 'integer', True, min=0), f('women', 'Of whom women', 'integer', min=0),
        f('passed', 'Passed the evaluation', 'integer', min=0), f('refresher_due', 'Refresher due', 'date', True),
        f('evidence', 'Evidence filed', 'multiselect', options=['Attendance sheet', 'Test results', 'Certificates', 'Photos'])]),
    ('CAP-F04', 'Exercise plan', 'Chapter 9 CAP-F04 (SOP 9-03; Annex 9-C). The protocol runs in drill mode; findings go to the AAR route (SOP 7-04).', 'MOO Ch.9', [
        f('exercise_type', 'Type', 'select', True, ['Orientation', 'Tabletop', 'Functional (EOC)', 'Full-scale', 'NSED participation']),
        f('scenario', 'Hazard scenario', 'select', True, ['Typhoon and flood', 'Flash flood', 'Landslide', 'Earthquake', 'Tsunami', 'Fire', 'Other']),
        f('objectives', 'Objectives (short)', 'textarea', True), f('protocols', 'MODE protocols exercised', 'text'),
        f('date', 'Date', 'date', True), f('participants', 'Participating offices and barangays', 'text', True),
        f('evaluators', 'Evaluators (positions)', 'text', True), f('aar_due', 'AAR due', 'date')]),
    ('CAP-F05', 'IEC reach log and sector consultation record', 'Chapter 9 CAP-F05 (SOPs 9-04, 9-09). Reach is counted, not estimated.', 'MOO Ch.9', [
        f('entry', 'Entry', 'select', True, ['IEC activity', 'Sector consultation']),
        f('channel', 'Channel', 'select', True, ['Barangay assembly', 'School', 'Radio', 'Social media', 'Printed material', 'Sign language video', 'Other']),
        f('language', 'Language', 'multiselect', True, ['Ormocanon (Bisaya)', 'English', 'Filipino (Tagalog)', 'Waray', 'Filipino Sign Language']),
        f('barangay', 'Barangay or venue', 'text', True), f('reached', 'People reached', 'integer', True, min=0),
        f('sectors', 'Sectors reached or consulted', 'multiselect', options=['Persons with disabilities', 'Older persons', 'Women', 'Children and youth',
          'Indigenous peoples', 'Informal settlers', 'Farmers and fisherfolk']),
        f('feedback', 'Feedback or request raised', 'textarea')]),
    ('CAP-F06', 'BDRRMC functionality matrix entry', 'Chapter 9 CAP-F06 (SOP 9-06). One entry per barangay (85). Tier thresholds are set by the CDRRMC.', 'MOO Ch.9', [
        f('barangay', 'Barangay', 'text', True), f('organised', 'BDRRMC organised by resolution', 'select', True, ['Yes', 'No', 'Records not obtained']),
        f('bdrrm_plan', 'BDRRM plan current', 'select', True, ['Yes', 'No', 'Records not obtained']),
        f('contingency_plan', 'Barangay contingency plan', 'select', True, ['Yes', 'No', 'Records not obtained']),
        f('drill', 'Drill in the last 12 months', 'select', True, ['Yes', 'No', 'Records not obtained']),
        f('ews', 'Early warning arrangement tested', 'select', True, ['Yes', 'No', 'Records not obtained']),
        f('fund_use', 'BDRRMF used as planned', 'select', True, ['Yes', 'Partly', 'No', 'Records not obtained']),
        f('tier', 'Tier (CDRRMC thresholds)', 'select', options=['Tier 1', 'Tier 2', 'Tier 3', 'Not yet tiered']),
        f('support', 'Support package', 'multiselect', options=['Training', 'Plan review', 'Drill', 'Equipment check', 'Mentoring by another barangay'])]),
    ('CAP-F07', 'Purok welfare-check time record', 'Chapter 9 CAP-F07 (SOPs 9-03, 9-06). Target: every resident accounted for within 12 hours.', 'MOO Ch.9', [
        f('barangay', 'Barangay', 'text', True), f('purok', 'Purok', 'text', True),
        f('mode', 'Mode', 'select', True, ['Drill', 'Real event']), f('started', 'Check started', 'datetime', True),
        f('completed', 'All households accounted for', 'datetime'), f('households', 'Households checked', 'integer', True, min=0),
        f('unaccounted', 'Households not yet accounted for', 'integer', True, min=0)]),
    ('CAP-F08', 'Volunteer registry entry', 'Chapter 9 CAP-F08 (SOP 9-07). Role-limited access; personal data under RA 10173.', 'MOO Ch.9', [
        f('group', 'Volunteer group', 'text', True), f('skill', 'Main skill', 'select', True,
          ['Search and rescue', 'First aid', 'CCCM', 'Logistics', 'Communications', 'Psychosocial support', 'Other']),
        f('accredited', 'Accreditation', 'select', True, ['Accredited', 'Pending', 'Lapsed']),
        f('insured', 'Insurance valid until', 'date', True), f('trained_on', 'Last training', 'date'),
        f('barangay', 'Home barangay', 'text', True), f('available', 'Available for deployment', 'select', True, ['Yes', 'No', 'Limited'])]),
    ('CAP-F09', 'Evacuation centre audit', 'Chapter 9 CAP-F09 (SOP 9-08; Annex 9-D). Twelve items, each met or not met with a note.', 'MOO Ch.9', [
        f('centre', 'Evacuation centre', 'text', True), f('barangay', 'Barangay', 'text', True),
        f('centre_type', 'Type', 'select', True, ['Dedicated evacuation centre', 'School (last resort, RA 12076)', 'Covered court', 'Other public building']),
        f('low_risk', '1. Low-risk location (current hazard maps)', 'select', True, _MET),
        f('structural', '2. Structural safety assessed (Building Official)', 'select', True, _MET),
        f('capacity', '3. Capacity matched to families served', 'select', True, _MET),
        f('wash', '4. WASH separated by sex, accessible, maintained', 'select', True, _MET),
        f('access', '5. Ground-floor priority and access', 'select', True, _MET),
        f('privacy', '6. Privacy, family, women- and child-friendly spaces', 'select', True, _MET),
        f('health', '7. Health and first-aid area; referral', 'select', True, _MET),
        f('security', '8. Security arrangement', 'select', True, _MET),
        f('kitchen', '9. Kitchen, storage and waste', 'select', True, _MET),
        f('power', '10. Power backup and communications', 'select', True, _MET),
        f('signage', '11. Signage in Ormocanon (Bisaya) and accessible formats', 'select', True, _MET),
        f('designated', '12. Designated by City issuance', 'select', True, _MET),
        f('fixes', 'Improvements agreed', 'textarea')]),
    # Chapter 10 (Table 10.23)
    ('SUS-F01', 'Legal instrument tracker', 'Chapter 10 SUS-F01 (SOP 10-01). Status sourced to documents in the Vault.', 'MOO Ch.10', [
        f('instrument', 'Instrument', 'select', True, ['DRRM ordinance amendment', 'EOC Executive Order', 'CDRRMC Executive Order', 'Manual version', 'Agreement', 'Other']),
        f('reference', 'Reference or draft title', 'text', True), f('status', 'Status', 'select', True, _STATUS),
        f('since', 'In this status since', 'date', True), f('next_step', 'Next step and office', 'text', True)]),
    ('SUS-F02', 'Annual sustainability checklist', 'Chapter 10 SUS-F02 (SOP 10-01). Five pillars; each needs evidence.', 'MOO Ch.10', [
        f('year', 'Year', 'integer', True, min=2026),
        f('legal', 'Legal and institutional permanence', 'select', True, _MET),
        f('people', 'People and succession', 'select', True, _MET),
        f('finance', 'Financial sustainability', 'select', True, _MET),
        f('continuity', 'Continuity of operations', 'select', True, _MET),
        f('digital', 'Digital continuity and information security', 'select', True, _MET),
        f('roadmap_updated', 'Resilience roadmap updated', 'checkbox'), f('gaps', 'Gaps and owners', 'textarea')]),
    ('SUS-F03', 'Succession order and alternates', 'Chapter 10 SUS-F03 (SOP 10-02). Positions, not persons; mirrors EOC designations.', 'MOO Ch.10', [
        f('position', 'Position', 'text', True), f('first_alternate', 'First alternate (position)', 'text', True),
        f('second_alternate', 'Second alternate (position)', 'text'), f('issuance', 'Designating issuance', 'text'),
        f('handover_pack', 'Transition pack (Annex 10-C) ready', 'checkbox'), f('reviewed_on', 'Reviewed on', 'date', True)]),
    ('SUS-F04', 'Backup, restore and access review log', 'Chapter 10 SUS-F04 (SOP 10-03). A backup counts only once a restore is tested.', 'MOO Ch.10', [
        f('system', 'System', 'select', True, ['MODE database', 'MODE files (Vault)', 'City records', 'Email', 'Other']),
        f('check', 'Check', 'select', True, ['Backup', 'Restore test', 'Access review', 'Connectivity test']),
        f('result', 'Result', 'select', True, ['Passed', 'Failed', 'Partly passed']), f('done_on', 'Done on', 'date', True),
        f('accounts_removed', 'Accounts removed or changed', 'integer', min=0), f('follow_up', 'Follow-up', 'text')]),
    ('SUS-F05', 'Annual continuity check', 'Chapter 10 SUS-F05 (SOP 10-04). Alternate EOC items only where one is designated.', 'MOO Ch.10', [
        f('year', 'Year', 'integer', True, min=2026), f('eoc_self_check', 'EOC readiness self-check done', 'select', True, ['Yes', 'No']),
        f('alternate_eoc', 'Alternate EOC', 'select', True, ['Designated and relocation tested', 'Designated, not tested', 'Not designated (N/A)']),
        f('pscp_exercise', 'PSCP exercise', 'select', True, ['Done', 'Planned', 'Not done']),
        f('power_hours', 'Backup power endurance (hours)', 'integer', min=0), f('findings', 'Findings to CAPA', 'textarea')]),
    ('SUS-F06', 'Recognition submission and results tracker', 'Chapter 10 SUS-F06 (SOP 10-05). Gawad KALASAG CY 2026 and SGLG; gaps go to CAPA.', 'MOO Ch.10', [
        f('programme', 'Programme', 'select', True, ['Gawad KALASAG (LDRRMC)', 'Seal of Good Local Governance', 'Other']),
        f('cycle', 'Cycle', 'text', True), f('stage', 'Stage', 'select', True, ['Self-check', 'Submitted', 'Validated', 'Result received']),
        f('result', 'Result', 'text'), f('gaps', 'Gaps found', 'textarea')]),
    ('SUS-F07', 'Innovation pilot proposal and evaluation', 'Chapter 10 SUS-F07 (SOP 10-06). A pilot has a measure and an end date.', 'MOO Ch.10', [
        f('idea', 'Idea', 'text', True), f('problem', 'Problem it addresses', 'text', True),
        f('source', 'Source', 'select', True, ['AAR', 'IAT gap', 'Staff suggestion', 'Partner', 'Good practice elsewhere']),
        f('measure', 'Measure of success', 'text', True), f('end_date', 'Pilot ends', 'date', True),
        f('decision', 'Decision', 'select', options=['Adopt', 'Adapt and re-test', 'Drop'])]),
]
