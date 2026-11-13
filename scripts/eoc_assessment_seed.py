#!/usr/bin/env python3
"""Generate supabase/seed/parts/38a_eoc_assessment.sql, 38b_..., — the EOC Capability Assessment seed (1.20.0, ADR-035).

Source of truth (committed so anyone can regenerate):
  reference/EOC_Capability_Assessment_Checklist_ACCOMPLISHED_Ormoc_2026-11.xlsx
  Sheet "Accomplished Checklist" (headers at row 3; 154 data rows): Section, Item #,
  Checklist Item, Primary EOC, Alternate EOC, Mapped IAT Indicator(s), Status,
  Evidence Observed, Gap / Remarks, Recommended Action. The checklist is the OCD/NDRRMC TWG
  (Dec 2017, FEMA-derived) EOC Capability Assessment Checklist; responses are matched to the
  Ormoc CDRRMO-EOC Institutional Assessment Tool v1-7, Part B_EOC (Oct 2026).

Verification source: reference/Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v1-7.xlsx, sheet
B_EOC (the 43 indicators and their scores). Every mapped indicator id must exist there, and the
workbook Status must equal the status derived from the weakest mapped indicator score
(app.eoc_assessment_status). A mismatch stops the generator; the workbook is never silently
contradicted. Because the statuses are that derivation, the seeded answers are stored as
provenance 'prefilled_iat' (a crosswalk, not an observation) for the primary EOC; a person
confirms or changes each one on site, which makes it 'observed' (review fix, ADR-035).

Ids are deterministic uuid5 against the same namespace as generate_seed.py / raci_seed.py.
Everything is insert-only: a re-run neither duplicates rows nor resets evidence, gap or action
text the assessment team has edited. The one baseline run is seeded as a draft — seeds never
mark content validated or approved. Output files stay under about 90 KB each, within the SQL
editor's limit.

Usage: python3 scripts/eoc_assessment_seed.py [path-to-workbook.xlsx]
"""
from __future__ import annotations
import os
import re
import sys
import uuid
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
PARTS = ROOT / 'supabase' / 'seed' / 'parts'
NS = uuid.UUID('6f1c1d1e-0a0b-4c4d-9e8f-0123456789ab')   # same namespace as generate_seed.py
MAX_BYTES = 90_000

DEFAULT_XLSX = str(ROOT / 'reference' / 'EOC_Capability_Assessment_Checklist_ACCOMPLISHED_Ormoc_2026-11.xlsx')
IAT_XLSX = ROOT / 'reference' / 'Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v1-7.xlsx'

RUN_KEY = 'baseline/iat-v1-7-2026-10'
RUN_TITLE = 'IAT v1-7 (Oct 2026)'

STATUS = {
    'Met': 'met',
    'Partially met': 'partially_met',
    'Largely unmet': 'largely_unmet',
    'Not met': 'not_met',
    'No direct IAT indicator': 'no_direct_indicator',
}
IAT_LINK = re.compile(r'^B[1-7]\.[0-9]+$')


def uid(*parts: str) -> str:
    return str(uuid.uuid5(NS, '/'.join(parts)))


def sql(s: str | None) -> str:
    return 'null' if s is None else "'" + s.replace("'", "''") + "'"


def derive_status(scores: list[int | None]) -> str:
    """Mirror of app.eoc_assessment_status (migration 20261114003000): the weakest mapped
    indicator score sets the status; NA scores are ignored."""
    present = [s for s in scores if s is not None]
    if not present:
        return 'no_direct_indicator'
    m = min(present)
    return 'met' if m >= 3 else 'partially_met' if m == 2 else 'largely_unmet' if m == 1 else 'not_met'


def read_checklist(path: str) -> list[dict]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb['Accomplished Checklist']
    items: list[dict] = []
    sections: list[str] = []
    for r in range(4, ws.max_row + 1):
        sec, item_no, text, prim, alt, mapped, status, evidence, gap, action = (ws.cell(r, c).value for c in range(1, 11))
        if item_no is None and text is None:
            continue  # banner row, e.g. "EOC ASSESSMENT AND SITING / PLANS"
        assert isinstance(item_no, int) and text and sec, f'row {r}: not a checklist item'
        sec = ' '.join(str(sec).split())
        status_key = STATUS.get(str(status).strip())
        assert status_key, f'row {r}: unknown Status {status!r}'
        links = [p.strip() for p in str(mapped or '').split(',')]
        links = [p for p in links if IAT_LINK.match(p)]
        if sec not in sections:
            sections.append(sec)
        items.append(dict(
            section=sec, section_sort=sections.index(sec) + 1, item_no=item_no,
            item_text=' '.join(str(text).split()), applies_primary=str(prim).strip() not in ('', 'N/A', 'Not applicable', 'None'),
            applies_alternate=str(alt).strip() in STATUS, iat_links=links, status=status_key,
            evidence=str(evidence).strip() if evidence else None,
            gap=str(gap).strip() if gap else None,
            recommended_action=str(action).strip() if action else None,
        ))
    return items


def verify(items: list[dict]) -> None:
    assert len(items) == 154, f'expected 154 items, got {len(items)}'
    assert len({i['section'] for i in items}) == 15, 'expected 15 sections'
    assert len({(i['section'], i['item_no']) for i in items}) == 154, 'duplicate (section, item_no)'
    for i in items:
        assert 3 <= len(i['item_text']) <= 1000, (i['section'], i['item_no'], 'item_text length')
    ws = openpyxl.load_workbook(IAT_XLSX, data_only=True)['B_EOC']
    scores = {}
    for r in range(5, ws.max_row + 1):
        ind, score = ws.cell(r, 1).value, ws.cell(r, 9).value
        if ind and IAT_LINK.match(str(ind)):
            scores[str(ind)] = int(score) if isinstance(score, (int, float)) else None
    assert len(scores) == 43, f'expected 43 B_EOC indicators in {IAT_XLSX.name}, found {len(scores)}'
    for i in items:
        missing = [link for link in i['iat_links'] if link not in scores]
        assert not missing, (i['section'], i['item_no'], f'unknown IAT ids {missing}')
        derived = derive_status([scores[link] for link in i['iat_links']])
        assert derived == i['status'], (i['section'], i['item_no'], f"workbook says {i['status']}, IAT scores derive {derived}")


def main() -> None:
    xlsx = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('EOC_CHECKLIST_XLSX', DEFAULT_XLSX)
    items = read_checklist(xlsx)
    verify(items)

    run_id = uid('eoc-assessment/run', RUN_KEY)
    item_rows, response_rows = [], []
    for i in items:
        item_id = uid('eoc-assessment/item', i['section'], str(i['item_no']))
        links = "'{" + ','.join(i['iat_links']) + "}'" if i['iat_links'] else "'{}'"
        item_rows.append(
            f"({sql(item_id)}::uuid,{sql(i['section'])},{i['section_sort']},{i['item_no']},"
            f"{sql(i['item_text'])},{str(i['applies_primary']).lower()},{str(i['applies_alternate']).lower()},{links}::text[])")
        response_rows.append(
            f"({sql(uid('eoc-assessment/response', RUN_KEY, i['section'], str(i['item_no'])))}::uuid,"
            f"{sql(run_id)}::uuid,{sql(item_id)}::uuid,{sql(i['status'])},"
            f"{sql(i['evidence'])},{sql(i['gap'])},{sql(i['recommended_action'])})")

    head = """-- GENERATED by scripts/eoc_assessment_seed.py from reference/EOC_Capability_Assessment_Checklist_ACCOMPLISHED_Ormoc_2026-11.xlsx
-- (OCD/NDRRMC TWG Dec 2017 checklist, matched to IAT v1-7 B_EOC, Oct 2026) — do not edit by hand.
-- EOC capability assessment seed (1.20.0, ADR-035), part {n} of {total}. Run after parts 01-37, in order. Safe to run again.
"""
    files = []
    # Part a: the items and the one draft run.
    files.append(f"""begin;

-- Items: insert-only reference rows. A re-run adds items new to the checklist and leaves existing
-- rows, including any corrected wording, as they are.
insert into public.eoc_assessment_items (id,section,section_sort,item_no,item_text,applies_primary,applies_alternate,iat_links) values
{','.join(item_rows)}
on conflict do nothing;

-- The one baseline run, always a draft. A re-run never validates it and never touches its responses.
insert into public.eoc_assessment_runs (id,title,status) values
({sql(run_id)}::uuid,{sql(RUN_TITLE)},'draft')
on conflict do nothing;

commit;
""")
    # Parts b..: the primary-EOC answers, PRE-FILLED from the IAT crosswalk, in chunks under MAX_BYTES.
    chunks, cur, size = [], [], 0
    for r in response_rows:
        b = len(r.encode('utf-8')) + 2
        if cur and size + b > MAX_BYTES:
            chunks.append(cur); cur, size = [], 0
        cur.append(r); size += b
    if cur:
        chunks.append(cur)
    for chunk in chunks:
        files.append(f"""begin;

-- Primary-EOC answers PRE-FILLED from IAT v1-7: the status is the weakest mapped indicator score, the text is
-- the workbook's. Stored as provenance 'prefilled_iat' until a person confirms or changes the answer on site.
-- Seeded only where no answer exists yet for the run, item and site: a re-run never resets a person's work.
insert into public.eoc_assessment_responses (id,run_id,item_id,site,status,provenance,evidence,gap,recommended_action)
select v.id, v.run_id, v.item_id, 'primary', v.status, 'prefilled_iat', v.evidence, v.gap, v.recommended_action
  from (values
{','.join(chunk)}
  ) as v (id, run_id, item_id, status, evidence, gap, recommended_action)
 where not exists (select 1 from public.eoc_assessment_responses x
                    where x.run_id = v.run_id and x.item_id = v.item_id and x.site = 'primary')
on conflict do nothing;

commit;
""")
    for old in PARTS.glob('38*_eoc_assessment.sql'):
        old.unlink()
    for n, body in enumerate(files):
        path = PARTS / f"38{'abcdefgh'[n]}_eoc_assessment.sql"
        path.write_text(head.format(n=n + 1, total=len(files)) + body, encoding='utf-8')
        assert path.stat().st_size < 100_000, f'{path.name} is {path.stat().st_size} bytes; the SQL editor limit is about 100 KB'
    counts = {}
    for i in items:
        counts[i['status']] = counts.get(i['status'], 0) + 1
    print(f'wrote {len(files)} parts 38a-38{"abcdefgh"[len(files) - 1]} (154 items, 1 draft run, 154 pre-filled primary-EOC answers; statuses {counts})')


if __name__ == '__main__':
    main()
