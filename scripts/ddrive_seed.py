#!/usr/bin/env python3
"""Generate supabase/seed/parts/26a_ddrive.sql, 26b_ddrive.sql ... from the DDRiVE desk-assessment workbook.

DDRiVE = Data-Driven Risk and Vulnerability Estimation (renamed from QRE; historical
file and sheet names still say QRE). Source: Ormoc-City-Barangays_Hazard-Assessment_QRE_*.xlsx
(place the current version in reference/). Run:

    python3 scripts/ddrive_seed.py [path/to/workbook.xlsx]

Writes part 26 as 26a, 26b ... (idempotent upserts, run after parts 1-25, each small enough
for the Supabase SQL editor). Data rules carried from the
workbook: a missing value is never zero - only numeric text becomes a number; the
9-digit PSGC typo in sheet 04 is normalised to the 10-digit code. No personal data.
"""
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / 'supabase/seed/parts'

MISSING = ('', 'not available', 'not assessed', 'n/a', '—', '-')
PSGC_RE = re.compile(r'\D')


def norm_psgc(v) -> str | None:
    """Digits only, left-padded to the 10-digit PSGC (sheet 04 row 2 ships 9 digits)."""
    if v is None:
        return None
    d = PSGC_RE.sub('', str(v))
    return d.zfill(10) if d else None


def num(v):
    """Workbook number or NULL - never zero-fill a missing value."""
    if v is None or isinstance(v, str) and v.strip().lower() in MISSING:
        return None
    if isinstance(v, (int, float)):
        return v
    s = str(v).strip().replace(',', '')
    try:
        return float(s)
    except ValueError:
        return None


def integer(v):
    n = num(v)
    return int(n) if n is not None else None


def text(v):
    """Verbatim wording for classification columns; empty/missing becomes NULL."""
    if v is None:
        return None
    s = str(v).strip()
    return s if s.lower() not in MISSING else None


def lit(v) -> str:
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def rows(ws):
    header = [str(c.value).strip() if c.value is not None else '' for c in ws[1]]
    out = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if all(v is None or str(v).strip() == '' for v in r):
            continue
        out.append({header[i]: r[i] for i in range(len(header))})
    return out


# The Supabase SQL editor refuses large snippets ("request entity too large"). Keep every part
# under the same size as the generate_seed.py parts, splitting big upserts into row batches
# (each batch is an idempotent ON CONFLICT upsert, so the order and re-runs stay safe).
PART_MAX_BYTES = 90_000
STATEMENT_MAX_BYTES = 45_000


def chunk_upsert(head: str, rows: list[str], tail: str, max_bytes: int = STATEMENT_MAX_BYTES) -> list[str]:
    """One INSERT ... ON CONFLICT statement per batch of rows; rows are '  (...)' without commas."""
    out, cur, size = [], [], len(head) + len(tail)
    for r in rows:
        if cur and size + len(r.encode()) + 2 > max_bytes:
            out.append('\n'.join([head, ',\n'.join(cur), tail]) + '\n\n')
            cur, size = [], len(head) + len(tail)
        cur.append(r); size += len(r.encode()) + 2
    if cur:
        out.append('\n'.join([head, ',\n'.join(cur), tail]) + '\n\n')
    return out


def upserts(table: str, cols: list[str], data: list[list], key: str) -> list[str]:
    head = f'insert into public.{table} ({", ".join(cols)}) values'
    rows = ['  (' + ', '.join(lit(v) for v in row) + ')' for row in data]
    tail = (f'on conflict ({key}) do update set ' +
            ', '.join(f'{c} = excluded.{c}' for c in cols if c != key) + ';')
    return chunk_upsert(head, rows, tail)


def write_parts(header: list[str], statements: list[str], check: str, out_dir: Path = None) -> list[Path]:
    """Pack statements in order into 26a_ddrive.sql, 26b_ddrive.sql ... each under PART_MAX_BYTES.
    Each part is its own transaction; the count check goes at the end of the last part."""
    out_dir = out_dir or OUT_DIR
    groups, cur, size = [], [], 0
    for st in statements:
        b = len(st.encode())
        if cur and size + b > PART_MAX_BYTES - 4_000:
            groups.append(cur); cur, size = [], 0
        cur.append(st); size += b
    groups.append(cur)
    for old in list(out_dir.glob('26_ddrive.sql')) + list(out_dir.glob('26[a-z]_ddrive.sql')):
        old.unlink()
    paths = []
    for i, g in enumerate(groups):
        letter = 'abcdefghijklmnopqrstuvwxyz'[i]
        body = '\n'.join(header) + '\n' + \
            f'-- Part 26{letter} ({i + 1} of {len(groups)} for DDRiVE): run after parts 1-25 and in order. ' \
            'Idempotent; safe to run again.\nbegin;\n\n' + ''.join(g) + 'commit;\n'
        if i == len(groups) - 1:
            body += '\n' + check
        p = out_dir / f'26{letter}_ddrive.sql'
        p.write_text(body)
        paths.append(p)
    return paths


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else next(
        (p for p in sorted((ROOT / 'reference').glob('Ormoc-City-Barangays_Hazard-Assessment_QRE_*.xlsx'))), None)
    if src is None or not src.exists():
        sys.exit('Workbook not found. Pass its path: python3 scripts/ddrive_seed.py <workbook.xlsx>')
    wb = openpyxl.load_workbook(src, data_only=True)
    W = 'v1.2'  # workbook revision (00_ReadMe_Methodology VERSION 1.2)
    sql: list[str] = [
        '-- GENERATED by scripts/ddrive_seed.py from the DDRiVE desk-assessment workbook.',
        '-- DDRiVE = Data-Driven Risk and Vulnerability Estimation (renamed from QRE).',
        f'-- Source: {src.name}. Reference data only; no personal data (RA 10173).',
    ]
    stmts: list[str] = []

    # 01+02+03 -> ddrive_barangay_profiles
    def norm_name(v) -> str:
        return re.sub(r'\s+', ' ', str(v or '').strip().lower())

    master_rows = [r for r in rows(wb['01_Barangay_Master']) if norm_psgc(r.get('PSGC 10-Digit Code'))]
    master = {norm_psgc(r['PSGC 10-Digit Code']): r for r in master_rows}
    name_to_psgc = {norm_name(r.get('Barangay Name (workbook)')): norm_psgc(r['PSGC 10-Digit Code']) for r in master_rows}
    geo = {norm_psgc(r['PSGC 10-Digit Code']): r for r in rows(wb['02_Geographic_Reference'])}
    cluster = {norm_psgc(r['PSGC 10-Digit Code']): r for r in rows(wb['03_Cluster_Crosswalk'])}

    def resolve_psgc(r, sheet: str) -> str | None:
        """10-digit PSGC; sheet 04 rows 2 and 17 ship 9 digits with an internal digit
        dropped, so an unmatched code falls back to the barangay-name lookup."""
        psgc = norm_psgc(r.get('PSGC 10-Digit Code'))
        if psgc in master:
            return psgc
        by_name = name_to_psgc.get(norm_name(r.get('Barangay Name')))
        if by_name:
            print(f'  note: {sheet} — PSGC {psgc!r} for {r.get("Barangay Name")!r} resolved to {by_name} by name')
            return by_name
        sys.exit(f'{sheet}: cannot resolve PSGC for row {r.get("No.")} ({r.get("Barangay Name")!r})')
    prof_cols = ['psgc', 'name', 'former_name', 'urban_rural', 'population_2024', 'population_2020',
                 'growth_rate_2020_2024', 'households', 'density_per_ha', 'data_quality_flag',
                 'lat', 'lng', 'coord_source', 'coord_validation',
                 'cluster_no', 'cluster_label', 'district_zone', 'assigned_coordinator',
                 'cluster_validation', 'workbook_rev']
    data = []
    for psgc, m in sorted(master.items()):
        g, c = geo.get(psgc, {}), cluster.get(psgc, {})
        cl_label = text(c.get('Proposed Cluster (1–6)'))
        cl_m = re.search(r'(\d+)', cl_label) if cl_label else None
        cl_no = int(cl_m.group(1)) if cl_m else None
        data.append([psgc, text(m.get('Barangay Name (workbook)')), text(m.get('Former Name / Predecessor / Note')),
                     text(m.get('Urban/Rural')), integer(m.get('Population, 2024 POPCEN')),
                     integer(m.get('Population, 2020 CPH')), num(m.get('Annual Growth Rate 2020–2024')),
                     integer(m.get('Households, 2024')), num(m.get('Population Density (per ha, validated area)')),
                     text(m.get('Data Quality Flag')),
                     num(g.get('Latitude (°N)')), num(g.get('Longitude (°E)')),
                     text(g.get('Coordinate Source (as supplied)')), text(g.get('Coordinate Validation Status')),
                     cl_no, cl_label, text(c.get('District / Zone')), text(c.get('Assigned Coordinator')),
                     text(c.get('Validation Status')), W])
    stmts.extend(upserts('ddrive_barangay_profiles', prof_cols, data, 'psgc'))

    def per_barangay(sheet, mapping, table):
        # mapping: (workbook header, SQL column, reader). The workbook headers carry spaces,
        # '&', '%' and '/' - they read the cell, but the SQL statement uses the column name.
        d = []
        resolved = [(resolve_psgc(r, sheet), r) for r in rows(wb[sheet])]
        for psgc, r in sorted(resolved, key=lambda x: x[0]):
            d.append([psgc] + [fn(r.get(head)) for head, _col, fn in mapping])
        stmts.extend(upserts(table, ['psgc'] + [m[1] for m in mapping], d, 'psgc'))

    # 04 -> ddrive_flood
    per_barangay('04_Flood_Assessment', [
        ('Flood Susceptibility Class', 'susceptibility_class', text),
        ('Flood Hazard Source & Vintage', 'hazard_source', text),
        ('Flood-prone Area (ha)', 'prone_area_ha', num),
        ('Total Barangay Land Area (ha)', 'land_area_ha', num),
        ('Flood-prone Land (%)', 'prone_pct', num),
        ('Population Potentially Exposed', 'exposed_population', integer),
        ('Exposure Base Population', 'exposure_base_population', integer),
        ('Exposure Base Year', 'exposure_base_year', text),
        ('Population Exposure (%)', 'exposure_pct', num),
        ('Flood Depth / Inundation Scenario', 'depth_scenario', text),
        ('Data Confidence', 'confidence', text),
        ('Validation Status', 'validation_status', text),
    ], 'ddrive_flood')

    # 05-08
    per_barangay('05_Multi_Hazard_Profile', [
        ('Rain-Induced Landslide Susceptibility', 'rain_landslide', text),
        ('Earthquake-Induced Landslide Susceptibility', 'eq_landslide', text),
        ('Ground Shaking', 'ground_shaking', text),
        ('Ground Rupture', 'ground_rupture', text),
        ('Liquefaction', 'liquefaction', text),
        ('Tsunami', 'tsunami', text),
        ('Critical Facilities Exposed', 'facilities_exposure', text),
        ('Lifeline & Road Exposure', 'lifeline_exposure', text),
        ('Vulnerable Population Indicators', 'vulnerable_population', text),
        ('Evacuation Access & Shelter Considerations', 'evacuation_access', text),
        ('Hazard Source & Vintage', 'source_vintage', text),
        ('Validation Status', 'validation_status', text),
        ('Storm Surge Susceptibility', 'storm_surge', text),
    ], 'ddrive_hazards')
    per_barangay('06_Exposure_Indicators', [
        ('Population 2024 POPCEN (baseline)', 'population_2024', integer),
        ('Population 0–4', 'pop_0_4', integer),
        ('Population 5–17', 'pop_5_17', integer),
        ('Population 18–59', 'pop_18_59', integer),
        ('Population 60+', 'pop_60_plus', integer),
        ('Schools (n)', 'schools', integer),
        ('Health Facilities (n)', 'health_facilities', integer),
        ('Infrastructure & Lifelines', 'infrastructure', text),
        ('Source', 'source', text),
        ('Status', 'status', text),
    ], 'ddrive_exposure')
    per_barangay('07_Vulnerability_Capacity', [
        ('Social Sensitivity Indicators', 'social_sensitivity', text),
        ('Access Constraints (roads, bridges, terrain)', 'access_constraints', text),
        ('Coping Capacity', 'coping_capacity', text),
        ('Adaptive Capacity', 'adaptive_capacity', text),
        ('Method / Source', 'method_source', text),
        ('Validation Status', 'validation_status', text),
    ], 'ddrive_vulnerability')
    per_barangay('08_Risk_Prioritisation', [
        ('Proposed Priority Rank (1–85)', 'priority_rank', integer),
        ('Priority Basis (evidence)', 'basis', text),
        ('Population 2024 POPCEN', 'population_2024', integer),
        ('Assessment Confidence', 'confidence', text),
        ('Validation Status', 'validation_status', text),
    ], 'ddrive_priority')

    # 14 -> ddrive_city_scores
    ws14 = wb['14_QRE_Scoring']
    found = False
    scores = []
    for r in ws14.iter_rows(values_only=True):
        if r and r[0] == 'Hazard family':
            found = True
            continue
        if found and r and r[0] and str(r[0]).startswith('H'):
            scores.append(r)
    score_cols = ['hazard_event', 'hazard_family', 'exposure_infrastructure', 'exposure_productive',
                  'exposure_essential', 'exposure_human', 'vulnerability_rating', 'response_measures',
                  'likelihood', 'severity', 'evidence_anchor', 'validation_status']
    data = [[text(r[1]), text(r[0]), text(r[2]), text(r[3]), text(r[4]), text(r[5]),
             integer(r[6]), text(r[7]), integer(r[8]), integer(r[9]), text(r[11]), text(r[12])] for r in scores]
    stmts.extend(upserts('ddrive_city_scores', score_cols, data, 'hazard_event'))

    # 13 -> ddrive_risk_matrix (header is not row 1; scan for it)
    ws13 = wb['13_QRE_Risk_Matrix']
    header = None
    matrix = []
    for r in ws13.iter_rows(values_only=True):
        if r and r[0] == 'Severity lower bound':
            header = [str(v) if v is not None else '' for v in r]
            continue
        if header and r and isinstance(r[0], (int, float)):
            row = dict(zip(header, r))
            band = text(row['Ranking reference'])
            matrix.append([integer(row['Severity lower bound']), integer(row['Severity upper bound']),
                       num(row['Likelihood lower bound']), num(row['Likelihood upper bound']),
                       integer(row['Ranking']), band,
                       {'VL': 'Very Low', 'L': 'Low', 'M': 'Moderate', 'H': 'High', 'VH': 'Very High'}[
                           re.sub(r'\d+$', '', band or 'M')]])
    stmts.extend(upserts('ddrive_risk_matrix',
                       ['severity_min', 'severity_max', 'likelihood_min', 'likelihood_max', 'ranking', 'band', 'label'],
                       matrix, 'ranking'))

    # 09 -> ddrive_sources
    src_map = [('Source ID', 'source_id', text), ('Source Name', 'name', text),
               ('Owner / Publisher', 'owner', text), ('URL', 'url', text),
               ('Vintage / Reference Date', 'vintage', text), ('Scale / Coverage', 'coverage', text),
               ('Date Accessed', 'accessed_on', text), ('Known Limitations', 'limitations', text)]
    data = [[fn(r.get(head)) for head, _col, fn in src_map] for r in rows(wb['09_Source_Register'])]
    stmts.extend(upserts('ddrive_sources', [m[1] for m in src_map], data, 'source_id'))

    check = ('-- Expected: 85 | 85 | 85 | 85 | 85 | 85 | 10 | 25 | 31\n'
               'select (select count(*) from public.ddrive_barangay_profiles) as profiles,\n'
               '       (select count(*) from public.ddrive_flood)             as flood,\n'
               '       (select count(*) from public.ddrive_hazards)            as hazards,\n'
               '       (select count(*) from public.ddrive_exposure)         as exposure,\n'
               '       (select count(*) from public.ddrive_vulnerability)    as vulnerability,\n'
               '       (select count(*) from public.ddrive_priority)           as priority,\n'
               '       (select count(*) from public.ddrive_city_scores)      as city_scores,\n'
               '       (select count(*) from public.ddrive_risk_matrix)        as matrix,\n'
               '       (select count(*) from public.ddrive_sources)            as sources;\n')

    for path in write_parts(sql, stmts, check):
        print(f'wrote {path} ({path.stat().st_size} bytes) from {src.name}')


if __name__ == '__main__':
    main()
