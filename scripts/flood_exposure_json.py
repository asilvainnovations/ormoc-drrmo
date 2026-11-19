#!/usr/bin/env python3
"""Generate src/data/floodExposure.json from the newest workbook in reference/flood-assessment.

One record per current barangay (85-barangay PSGC configuration) that has a GeoAnalyticsPH flood report:
  - each "Bgy - <name>" worksheet, matched to its PSGC through 04_Flood_Assessment;
  - Barangays South, East, West and North, summed from the "Bgy - N (Pob.)" district worksheets
    (City Ordinance No. 052 s. 2021; composition as in the Ormoc City CDP, Vol. 1, Table 1). A merged barangay is
    written only when every one of its districts has a report.
Values are copied as reported. Blank source cells stay null. Nothing is imputed.

    python3 scripts/flood_exposure_json.py
"""
import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src' / 'data' / 'floodExposure.json'
MERGED = {'0803738091': ('Barangay North', [29]), '0803738115': ('Barangay East', [9, 10, 11, 16, 18, 25, 28]),
          '0803738116': ('Barangay South', [1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 15, 17, 23, 27]),
          '0803738117': ('Barangay West', [14, 19, 20, 21, 22, 24, 26])}
CLASSES = ['Not prone', 'Low', 'Moderate', 'High', 'Very High']


def key(name: str) -> str:
    return re.sub(r'[^a-z0-9ñ]', '', re.sub(r'\(.*?\)', '', name.lower()))


def psgc10(v) -> str:
    s = str(v).strip()
    return s[:2] + '0' + s[2:] if len(s) == 9 else s


def num(v):
    if v is None or v == '':
        return None
    return int(round(float(str(v).replace(',', ''))))


def read_sheet(ws):
    rows = list(ws.iter_rows(values_only=True))
    when = tot = None
    for r in rows[:14]:
        a = str(r[0] or '')
        if 'date/time' in a.lower():
            when = str(r[1])
        if r[1] and re.search(r'[\d,]+ out of [\d,]+', str(r[1])) and 'flood' in a.lower():
            tot = str(r[1])
    m = re.search(r'([\d,]+) out of ([\d,]+) \(([\d.]+)%\)', tot or '')
    classes, age = [], []
    mode = None
    for r in rows:
        a = r[0]
        if a == 'Assessment class':
            mode = 'c'; continue
        if a == 'Age group':
            mode = 'a'; continue
        if isinstance(a, str) and a.upper().startswith('TOTAL'):
            mode = None; continue
        if mode == 'c' and a in CLASSES and r[1] is not None:
            classes.append({'name': a, 'population': num(r[1])})
        elif mode == 'a' and isinstance(a, str) and re.match(r'^(Under 5|\d+-\d+|80\+)$', a):
            age.append({'ageGroup': a, 'maleNotProne': num(r[1]), 'maleProne': num(r[2]), 'femaleNotProne': num(r[3]), 'femaleProne': num(r[4])})
    if not m:
        return None
    return {'reportedAt': when, 'pronePopulation': num(m.group(1)), 'denominator': num(m.group(2)), 'exposurePercent': float(m.group(3)),
            'classes': classes, 'ageSex': age}


def main():
    src = sorted((ROOT / 'reference' / 'flood-assessment').glob('*Hazard_Assessment*.xlsx'))[-1]
    wb = openpyxl.load_workbook(src, data_only=True)
    names = {}
    for r in wb['04_Flood_Assessment'].iter_rows(min_row=2, values_only=True):
        if r[1] and r[2]:
            names[key(r[2])] = (psgc10(r[1]), r[2])
    out, districts = {}, {}
    for ws in wb.worksheets:
        if not ws.title.startswith('Bgy - '):
            continue
        rec = read_sheet(ws)
        if rec is None:
            continue
        nm = ws.title[6:]
        d = re.fullmatch(r'(\d+) \(Pob\.\)', nm)
        if d:
            districts[int(d.group(1))] = rec; continue
        hit = names.get(key(nm))
        if not hit:
            raise SystemExit(f'No PSGC for worksheet {ws.title}')
        out[hit[0]] = {'psgc': hit[0], 'name': nm, 'source': f'{src.name}, worksheet "{ws.title}" (GeoAnalyticsPH report)',
                       'ageSexStatus': 'available' if rec['ageSex'] else 'source-record-pending', **rec}
    for psgc, (name, ds) in MERGED.items():
        if not all(d in districts for d in ds):
            continue
        recs = [districts[d] for d in ds]
        den = sum(r['denominator'] for r in recs); prone = sum(r['pronePopulation'] for r in recs)
        cls = {}
        for r in recs:
            for c in r['classes']:
                cls[c['name']] = cls.get(c['name'], 0) + c['population']
        age = []
        if all(r['ageSex'] for r in recs):
            for i, g in enumerate(recs[0]['ageSex']):
                row = {'ageGroup': g['ageGroup']}
                for f in ('maleNotProne', 'maleProne', 'femaleNotProne', 'femaleProne'):
                    vals = [r['ageSex'][i][f] for r in recs if i < len(r['ageSex'])]
                    row[f] = sum(v for v in vals if v is not None) if any(v is not None for v in vals) else None
                age.append(row)
        out[psgc] = {'psgc': psgc, 'name': name,
                     'source': f'{src.name}: sum of the reports for former Barangay Districts {", ".join(map(str, ds))} (City Ord. 052 s.2021; CDP Vol. 1, Table 1)',
                     'reportedAt': 'District reports, ' + ', '.join(sorted({(r['reportedAt'] or '')[:17].strip() for r in recs if r['reportedAt']})),
                     'pronePopulation': prone, 'denominator': den, 'exposurePercent': round(prone / den * 100, 3) if den else 0,
                     'classes': [{'name': n, 'population': cls[n]} for n in CLASSES if n in cls],
                     'ageSex': age, 'ageSexStatus': 'available' if age else 'source-record-pending',
                     'notes': f'Sum of {len(ds)} district report{"" if len(ds) == 1 else "s"}; age bands kept as reported.'}
    for r in out.values():   # say so when the source's age table and its headline split prone / not prone differently
        if r['ageSex'] and r['pronePopulation'] is not None:
            p = sum((g['maleProne'] or 0) + (g['femaleProne'] or 0) for g in r['ageSex'])
            if p != r['pronePopulation']:
                note = (f'The source age table counts {p:,} prone against the report\'s {r["pronePopulation"]:,} '
                        '(source rounding); both kept as reported.')
                r['notes'] = f'{r["notes"]} {note}' if r.get('notes') else note
    rows = sorted(out.values(), key=lambda r: r['name'])
    OUT.write_text(json.dumps({'source': src.name, 'records': rows}, ensure_ascii=False, indent=1) + '\n')
    print(f'{len(rows)} barangays -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
