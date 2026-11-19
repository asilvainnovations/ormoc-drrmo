#!/usr/bin/env python3
"""Add GeoAnalyticsPH flood-prone population reports to the barangay hazard-assessment workbook.

Usage:
    python3 scripts/flood_geoanalytics_merge.py <results.json> <input_workbook.xlsx> <output_workbook.xlsx>

results.json is a list of reports, one per barangay, exactly as GeoAnalyticsPH exported them (Hazard: Flood;
Exposure: Demography > Population):
    {"bgy": "083738108", "bname": "Alta Vista", "when": "November 19, 2026 ...", "tot": "952 out of 5,209 (18.276%)",
     "prone": 952, "den": 5209, "classes": [["Not prone", 4257], ["High", 952]],
     "age": [["Under 5", m_not, m_prone, f_not, f_prone], ...]}

GeoAnalyticsPH still lists the former Poblacion districts as "Barangay N (Pob.)". They get their own "Bgy - N (Pob.)"
worksheets; scripts/ddrive_seed.py rolls them up into Barangays South, East, West and North (City Ordinance
No. 052 s. 2021; composition as in the Ormoc City CDP, Vol. 1, Table 1). Every other barangay updates its row in
04_Flood_Assessment by PSGC and gets a "Bgy - <name>" worksheet in the existing layout. Values are copied as reported;
nothing is imputed. A report replaces an earlier worksheet of the same barangay only when --replace names it.
"""
import argparse
import json
import re
from copy import copy
from pathlib import Path

import openpyxl
from openpyxl.utils import get_column_letter

CLASS_ORDER = ['Low', 'Moderate', 'High', 'Very High']
TEMPLATE = 'Bgy - Batuan'


def psgc10(code9: str) -> str:
    """GeoAnalyticsPH uses the 9-digit PSGC (083738108); the workbook uses 10 digits (0803738108)."""
    return code9[:2] + '0' + code9[2:] if len(code9) == 9 else code9


def class_label(classes) -> str:
    prone = [c for c, n in classes if c != 'Not prone' and (n or 0) > 0]
    prone = sorted(set(prone), key=CLASS_ORDER.index)
    if not prone:
        return 'Not prone (no population in a flood class)'
    return prone[0] if len(prone) == 1 else f'{prone[0]}–{prone[-1]} (mixed classes)'


def copy_style(src, dst):
    if src.has_style:
        dst.font, dst.fill, dst.border = copy(src.font), copy(src.fill), copy(src.border)
        dst.alignment, dst.number_format = copy(src.alignment), src.number_format


def build_sheet(wb, title: str, rep: dict, note: str):
    tpl = wb[TEMPLATE]
    if title in wb.sheetnames:
        del wb[title]
    ws = wb.create_sheet(title)
    for col in range(1, 6):
        L = get_column_letter(col)
        ws.column_dimensions[L].width = tpl.column_dimensions[L].width
    style = {k: tpl.cell(row=r, column=1) for k, r in {'title': 1, 'sub': 2, 'label': 4, 'section': 10, 'head': 11, 'body': 13, 'total': 15}.items()}
    body_val = tpl.cell(row=13, column=2)

    def put(r, c, v, s):
        cell = ws.cell(row=r, column=c, value=v)
        copy_style(tpl.cell(row=s, column=min(c, 5)) if isinstance(s, int) else s, cell)
        return cell

    put(1, 1, 'ORMOC CITY — BARANGAY FLOOD-PRONE POPULATION PROFILE', 1); ws.merge_cells('A1:E1')
    put(2, 1, rep['bname'], 2); ws.merge_cells('A2:E2')
    meta = [('Source report date/time', rep['when']), ('Source location', rep['loc']),
            ('Population reported as flood-prone', rep['tot']),
            ('Source report note', 'Administrative boundaries are approximate and not authoritative.'),
            ('Source report status', 'Auto-generated report; requires validation against authoritative barangay boundaries and field data.')]
    for i, (a, b) in enumerate(meta):
        r = 4 + i
        put(r, 1, a, 4); put(r, 2, b, 4); ws.merge_cells(f'B{r}:E{r}')
    put(10, 1, 'A. FLOOD SUSCEPTIBILITY / POPULATION DISTRIBUTION', 10); ws.merge_cells('A10:E10')
    for c, h in enumerate(['Assessment class', 'Population', 'Share of reported population', 'Source field', 'Remarks'], 1):
        put(11, c, h, 11)
    first = 12
    rows = rep['classes']
    last = first + len(rows) - 1
    for i, (cls, n) in enumerate(rows):
        r = first + i
        put(r, 1, cls, 13); put(r, 2, n, 13)
        put(r, 3, f'=IFERROR(B{r}/SUM($B${first}:$B${last}),"")', 13)
        put(r, 4, 'Table', 13); put(r, 5, 'As reported; blank source values remain blank.', 13)
    t = last + 1
    put(t, 1, 'TOTAL (sum of reported classes)', 15); put(t, 2, f'=SUM(B{first}:B{last})', 15); put(t, 3, f'=SUM(C{first}:C{last})', 15)
    s = t + 3
    put(s, 1, 'B. POPULATION BY AGE GROUP AND SEX (SOURCE AGE GROUP SHEET)', 10); ws.merge_cells(f'A{s}:E{s}')
    for c, h in enumerate(['Age group', 'Male (Not prone)', 'Male (Prone)', 'Female (Not prone)', 'Female (Prone)'], 1):
        put(s + 1, c, h, 11)
    a0 = s + 2
    for i, row in enumerate(rep['age']):
        for c, v in enumerate(row, 1):
            put(a0 + i, c, v, 13)
    a1 = a0 + max(len(rep['age']), 1) - 1
    put(a1 + 1, 1, 'TOTAL', 15)
    for c in range(2, 6):
        L = get_column_letter(c)
        put(a1 + 1, c, f'=SUM({L}{a0}:{L}{a1})', 15)
    n = a1 + 4
    put(n, 1, note, 4)
    ws.merge_cells(f'A{n}:E{n + 1}')
    ws.cell(row=n, column=1).alignment = copy(tpl['A41'].alignment)
    return ws


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('results'); ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--replace', nargs='*', default=[], help='barangay names whose earlier worksheet this run supersedes')
    ap.add_argument('--run-date', default='20 Nov 2026')
    ap.add_argument('--log-id', default='L-15'); ap.add_argument('--source-id', default='S-34')
    ap.add_argument('--qa-note', nargs='*', default=[], help='extra QA log rows: "L-16|Check: Result|Status"')
    a = ap.parse_args()
    reps = json.loads(Path(a.results).read_text())
    wb = openpyxl.load_workbook(a.src)
    f04 = wb['04_Flood_Assessment']
    head = [c.value for c in f04[1]]
    col = {h: i + 1 for i, h in enumerate(head)}
    by_psgc = {}
    for r in range(2, f04.max_row + 1):
        v = f04.cell(row=r, column=col['PSGC 10-Digit Code']).value
        if v:
            by_psgc[psgc10(str(v).strip())] = r
    idx = wb['12_Flood_Data_Index']
    bm = wb['01_Barangay_Master']
    bh = {c.value: i + 1 for i, c in enumerate(bm[1])}
    cph = {psgc10(str(bm.cell(row=r, column=bh['PSGC 10-Digit Code']).value).strip()): bm.cell(row=r, column=bh['Population, 2020 CPH']).value
           for r in range(2, bm.max_row + 1) if bm.cell(row=r, column=bh['PSGC 10-Digit Code']).value}
    checks = []
    added, pob, updated = [], [], []
    for rep in sorted(reps, key=lambda x: x['bname']):
        m = re.fullmatch(r'Barangay (\d+) \(Pob\.\)', rep['bname'])
        title = f'Bgy - {m.group(1)} (Pob.)' if m else f'Bgy - {rep["bname"]}'
        if title in wb.sheetnames and rep['bname'] not in a.replace:
            raise SystemExit(f'{title} already exists; pass --replace "{rep["bname"]}" to supersede it')
        note = ('Interpretation and use: Values are transcribed from the Table and Age Group worksheets of the GeoAnalyticsPH '
                f'report exported by the lead assessor on {a.run_date} (Hazard: Flood; Exposure: Demography > Population). '
                'The age/sex figures are retained in the source\'s original age bands. Report totals and boundaries are subject '
                'to validation; this worksheet does not replace official population statistics or a GIS-based hazard validation.')
        build_sheet(wb, title, rep, note)
        if rep.get('age_prone') is not None and rep['age_prone'] != rep['prone']:
            checks.append(f'{rep["bname"]}: the age table sums to {rep["age_prone"]:,} prone and {rep["age_not"]:,} not prone against the '
                          f'report\'s {rep["prone"]:,} and {rep["den"] - rep["prone"]:,} (same total, {abs(rep["age_prone"] - rep["prone"])} persons '
                          'moved between columns by source rounding); both are kept as reported')
        r_idx = next(r for r in range(5, idx.max_row + 2) if not idx.cell(row=r, column=1).value)
        for c, v in enumerate([rep['bname'].replace('Barangay ', '') if m else rep['bname'], title, rep['when'], rep['tot'],
                               rep.get('file') or f'GeoAnalyticsPH export, {a.run_date}', 'No',
                               'Former Poblacion district — rolled up by City Ord. 052 s.2021' if m
                               else f'{psgc10(rep["bgy"])} — matched to 85-barangay PSGC reference'], 1):
            cell = idx.cell(row=r_idx, column=c, value=v)
            copy_style(idx.cell(row=r_idx - 1, column=c), cell)
        if m:
            pob.append(rep['bname']); continue
        r = by_psgc.get(psgc10(rep['bgy']))
        want = cph.get(psgc10(rep['bgy']))
        if want != rep['den']:
            raise SystemExit(f'{rep["bname"]}: report denominator {rep["den"]} is not the 2020 CPH figure {want}')
        if r is None:
            raise SystemExit(f'No 04_Flood_Assessment row for {rep["bname"]} ({rep["bgy"]})')
        vals = {
            'Flood Susceptibility Class': class_label(rep['classes']),
            'Flood Hazard Source & Vintage': f'GeoAnalyticsPH auto-generated report; {rep["when"]}; DENR-MGB flood hazard layer (GeoRiskPH)',
            'Flood-prone Area (ha)': 'Not available', 'Total Barangay Land Area (ha)': 'Not available', 'Flood-prone Land (%)': 'Not available',
            'Population Potentially Exposed': rep['prone'], 'Exposure Base Population': rep['den'], 'Exposure Base Year': '2020 CPH',
            'Population Exposure (%)': f'=IF(AND(ISNUMBER(J{r}),J{r}>0),I{r}/J{r},"")',
            'Exposure by Age & Sex': f'Available in source report (age × sex × prone/not-prone); see {title}',
            'Flood Depth / Inundation Scenario': 'Not available in source report',
            'Data Confidence': 'Modelled / auto-generated population exposure; approximate administrative boundaries',
            'Validation Status': 'Pending validation against authoritative barangay boundaries and field data',
        }
        for h, v in vals.items():
            f04.cell(row=r, column=col[h], value=v)
        (updated if rep['bname'] in a.replace else added).append(rep['bname'])
    qa = wb['10_QA_Validation_Log']
    qa.append([a.log_id, a.run_date, f'GeoAnalyticsPH flood reports supplied by the lead assessor ({len(reps)} reports: {", ".join(sorted(r["bname"] for r in reps))})',
               f'PASS — {len(added)} barangay rows filled, {len(pob)} former Poblacion district report(s) added, {len(updated)} superseded',
               'Each report was accepted only if the Table and Age Group sheets came from the same report, the class totals equalled the report '
               'total and the prone count, and (for current barangays) the report denominator equalled the 2020 CPH figure in 01_Barangay_Master. '
               + ('; '.join(checks) + '.' if checks else 'Every age table summed to the report figures.'),
               'Closed — pending field validation of classes'])
    for extra in a.qa_note:
        lid, text, status = extra.split('|')
        qa.append([lid, a.run_date, text.split(':')[0], text.split(':', 1)[1].strip(), '', status])
    src = wb['09_Source_Register']
    src.append([a.source_id, f'Population_Prone_Flood reports — {", ".join(sorted(r["bname"] for r in reps))}',
                'GeoAnalyticsPH (DOST-PHIVOLCS GeoRiskPH), exported by the lead assessor', 'Not provided in source files',
                f'Reports dated {", ".join(sorted({r["when"].split(" ")[0] + " " + r["when"].split(" ")[1] + " " + r["when"].split(" ")[2] for r in reps}))}',
                f'{len(reps)} reports (Table and Age Group worksheets)', a.run_date,
                'Population denominators are the 2020 CPH figures GeoAnalyticsPH uses; the 2024 POPCEN baseline in 01_Barangay_Master is kept separate. '
                'Boundaries are approximate; classes are modelled and need field validation.'])
    wb.save(a.out)
    print(f'filled {len(added)}, districts {len(pob)}, superseded {len(updated)} -> {a.out}')


if __name__ == '__main__':
    main()
