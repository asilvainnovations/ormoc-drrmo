#!/usr/bin/env python3
"""Generate the EOC capability self-assessment seed (1.20.0, ADR-035).

Source: reference/EOC_Capability_Assessment_Checklist_ACCOMPLISHED_Ormoc_2026-11.xlsx, sheet
"Accomplished Checklist": the 154 items of the OCD/NDRRMC TWG EOC Capability Assessment Checklist
(Dec 2017), each mapped to IAT Part B indicators, with answers pre-filled from IAT v1-7.

Writes:
  supabase/seed/parts/38_eoc_capability.sql                the items (reference data)
  supabase/seed/operational/08{a,b,...}_eoc_capability_prefill.sql
                                                            the pre-filled primary-EOC answers for the 2026
                                                            baseline cycle, stored as provenance
                                                            'prefilled_iat' (not observed)

The pre-fill status is the lowest IAT v1-7 score among the mapped indicators (3 Met, 2 Partially met,
1 Largely unmet, 0 Not met); this script checks that every row in the workbook follows that rule, so
the stored label "pre-filled from IAT" stays true. A re-run updates only answers that are still
pre-filled drafts: once a person edits or confirms an answer (provenance 'observed') or the CDRRMO
Head validates it, the seed leaves it alone. Ids are uuid5 in the generate_seed.py namespace.
Parts stay under the SQL editor limits (about 100 KB per file).
"""
import re
import sys
import uuid
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'reference' / 'EOC_Capability_Assessment_Checklist_ACCOMPLISHED_Ormoc_2026-11.xlsx'
IAT = ROOT / 'reference' / 'Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v1-7.xlsx'
PART = ROOT / 'supabase' / 'seed' / 'parts' / '38_eoc_capability.sql'
OPS = ROOT / 'supabase' / 'seed' / 'operational'
NS = uuid.UUID('6f1c1d1e-0a0b-4c4d-9e8f-0123456789ab')   # same namespace as generate_seed.py
CYCLE = '8911a053-1b14-587f-b906-c0fb2adaf7f3'            # "2026 Baseline (IAT v1.7)" (operational/01)
MAX_BYTES = 90_000

STATUS = {'Met': 'met', 'Partially met': 'partially_met', 'Largely unmet': 'largely_unmet', 'Not met': 'not_met',
          'No direct IAT indicator': 'not_assessed'}
FROM_SCORE = {3: 'met', 4: 'met', 2: 'partially_met', 1: 'largely_unmet', 0: 'not_met'}


def uid(*parts: str) -> str:
    return str(uuid.uuid5(NS, '/'.join(parts)))


def q(s) -> str:
    if s is None or (isinstance(s, str) and not s.strip()):
        return 'null'
    return "E'" + str(s).strip().replace('\\', '\\\\').replace("'", "''").replace('\n', '\\n') + "'"


def iat_scores() -> dict[str, int]:
    ws = openpyxl.load_workbook(IAT, data_only=True)['B_EOC']
    out = {}
    for r in range(5, ws.max_row + 1):
        i, s = ws.cell(r, 1).value, ws.cell(r, 9).value
        if i and re.match(r'^B\d\.\d+$', str(i)):
            out[str(i)] = int(s) if isinstance(s, (int, float)) else s
    return out


def read_items():
    ws = openpyxl.load_workbook(SRC, data_only=True)['Accomplished Checklist']
    group, items = None, []
    for r in range(4, ws.max_row + 1):
        v = [ws.cell(r, c).value for c in range(1, 11)]
        if v[1] is None:
            if v[0]:
                group = ' / '.join(p.strip().title().replace(' And ', ' and ') for p in re.sub(r'\s+', ' ', v[0]).split('/'))
            continue
        items.append(dict(group=group, section=str(v[0]).strip(), no=int(v[1]), item=re.sub(r'\s+', ' ', str(v[2])).strip(),
                          primary=v[3], alternate=v[4], map=v[5] or '', status=v[6], evidence=v[7], gap=v[8], action=v[9]))
    return items


def main() -> None:
    scores = iat_scores()
    items = read_items()
    assert len(items) == 154, f'expected 154 checklist items, found {len(items)}'
    item_rows, resp_rows = [], []
    for sort, it in enumerate(items, start=1):
        ids = re.findall(r'B\d\.\d+', str(it['map']))
        bad = [i for i in ids if i not in scores]
        assert not bad, (it['section'], it['no'], 'unknown IAT indicators', bad)
        assert it['primary'] == it['status'], (it['section'], it['no'], 'Primary EOC and Status differ')
        assert it['alternate'] == 'Not assessed', (it['section'], it['no'], 'alternate EOC answered; not expected in v1')
        status = STATUS[it['primary']]
        if ids:   # the label "pre-filled from IAT" must stay true: the status is the lowest mapped score
            expect = FROM_SCORE[min(scores[i] for i in ids)]
            assert status == expect, (it['section'], it['no'], f'status {status} is not the lowest-score rule ({expect})')
        iid = uid('eoc_cap', it['section'], str(it['no']))
        arr = "'{" + ','.join(ids) + "}'::text[]"
        item_rows.append(f"({q(iid)}::uuid,{q(it['group'])},{q(it['section'])},{it['no']},{q(it['item'])},{arr},"
                         f"{'false' if ids else 'true'},{sort})")
        resp_rows.append(f"({q(uid('eoc_cap_response', CYCLE, iid, 'primary'))}::uuid,{q(CYCLE)}::uuid,{q(iid)}::uuid,'primary',"
                         f"'{status}','prefilled_iat',{q(it['evidence'])},{q(it['gap'])},{q(it['action'])})")

    PART.write_text(f"""-- GENERATED by scripts/eoc_capability_seed.py from {SRC.name} — do not edit by hand.
-- EOC Capability Assessment Checklist (OCD/NDRRMC TWG, Dec 2017): 154 items with their IAT Part B mapping
-- (1.20.0, ADR-035). Reference data. Run after parts 01-37. Safe to run again.
begin;

insert into public.eoc_cap_items (id,section_group,section,item_no,item,iat_indicators,assess_locally,sort) values
{','.join(chr(10) + r for r in item_rows).lstrip()}
on conflict (id) do update set section_group = excluded.section_group, section = excluded.section, item_no = excluded.item_no,
  item = excluded.item, iat_indicators = excluded.iat_indicators, assess_locally = excluded.assess_locally, sort = excluded.sort;

commit;
""", encoding='utf-8')

    # Pre-fill, split under the SQL editor limit.
    for old in OPS.glob('08*_eoc_capability_prefill.sql'):
        old.unlink()
    chunks, cur, size = [], [], 0
    for r in resp_rows:
        b = len(r.encode('utf-8')) + 2
        if cur and size + b > MAX_BYTES:
            chunks.append(cur); cur, size = [], 0
        cur.append(r); size += b
    if cur:
        chunks.append(cur)
    for n, chunk in enumerate(chunks):
        letter = 'abcdefghij'[n]
        (OPS / f'08{letter}_eoc_capability_prefill.sql').write_text(f"""-- GENERATED by scripts/eoc_capability_seed.py from {SRC.name} — do not edit by hand.
-- EOC capability checklist, primary EOC, 2026 baseline cycle: answers PRE-FILLED from IAT v1-7 (part {n + 1} of {len(chunks)}).
-- Stored as provenance 'prefilled_iat': a crosswalk from the IAT scores, not an observation. The status is the lowest
-- score of the mapped indicators (3 Met, 2 Partially met, 1 Largely unmet, 0 Not met). A person confirms or changes
-- each answer on site, which makes it 'observed'. A re-run refreshes only answers that are still pre-filled drafts.
-- Skipped when the 2026 baseline cycle is not loaded (operational/01). Run after parts 01-38. Safe to run again.
begin;

insert into public.eoc_cap_responses (id,cycle_id,item_id,site,status,provenance,evidence_observed,gap_remarks,recommended_action)
select v.id, v.cycle_id, v.item_id, v.site, v.status, v.provenance, v.evidence_observed, v.gap_remarks, v.recommended_action
  from (values
{','.join(chr(10) + r for r in chunk).lstrip()}
  ) as v (id, cycle_id, item_id, site, status, provenance, evidence_observed, gap_remarks, recommended_action)
 where exists (select 1 from public.assessment_cycles c where c.id = v.cycle_id)
on conflict (cycle_id, item_id, site) do update set status = excluded.status, evidence_observed = excluded.evidence_observed,
  gap_remarks = excluded.gap_remarks, recommended_action = excluded.recommended_action
  where eoc_cap_responses.provenance = 'prefilled_iat' and eoc_cap_responses.state = 'draft';

commit;
""", encoding='utf-8')
    print(f'wrote {PART.relative_to(ROOT)} ({len(item_rows)} items) and {len(chunks)} pre-fill file(s) '
          f'({len(resp_rows)} primary-EOC answers)')


if __name__ == '__main__':
    sys.exit(main())
