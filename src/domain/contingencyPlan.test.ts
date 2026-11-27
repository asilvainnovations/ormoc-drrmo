import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { xlsxWorkbookBytes } from '@/lib/xlsx';
import type { Barangay, ContingencyPlan, CpActivationItem, EocDesignation, EocPosition, EvacuationCentre, Hazard, ResponseCluster } from '@/types';
import { buildCpWorkbook, clusterSheet, cpFileName, planClusters, timeframes, usesForm3B, type CpInput } from './contingencyPlan';

const plan: ContingencyPlan = { id: 'p', version: 1, code: 'CP-FLASHFLOOD', title: 'Contingency plan for flash floods (Anilao-Malbasag system)', hazard_code: 'flash_flood',
  hazard_codes: ['flash_flood'], scenario: 'Flash flood', warning_time: 'Hours', activation_triggers: 'Red straight from an orange or red heavy-rainfall warning',
  status: 'to_prepare', adopted_ref: null, adopted_on: null, valid_until: null, vault_document_id: null };
const item = (kind: 'module' | 'cluster', code: string, state: 'on' | 'lead' | 'standby', min: 'blue' | 'red', note: string | null = null): CpActivationItem =>
  ({ id: `${kind}-${code}`, version: 1, plan_id: 'p', item_kind: kind, item_code: code, state, min_level: min, note });
const cluster = (code: string, name: string, sort: number): ResponseCluster =>
  ({ id: code, version: 1, code, name, national_lead: 'DSWD', lead_office_id: code === 'CCCM' ? 'o-cswdo' : null, mandate: null, sort, is_active: true });
const hz = (code: string, name: string, sort: number): Hazard => ({ code, name, forecastable: true, typical_lead_hours: null, declaration_eligible: false, note: null, sort });
const brgy = (psgc: string, name: string, district_id: number): Barangay => ({ psgc, name, classification: [], population: null, lat: null, lng: null, district_id });
const pos: EocPosition = { id: 'pm', version: 1, code: 'EOC-MGR', title: 'EOC Manager', section: 'command', min_level: 'blue', cluster_code: null, required_depth: 3, sort: 1, is_active: true };
const des = (rank: 1 | 2, who: string): EocDesignation => ({ id: `d${rank}`, version: 1, position_id: 'pm', rank, person_id: null, office_id: null, designee_position: who,
  status: 'approved', valid_from: '2026-01-01', valid_until: null, note: null, proposed_by: null, approved_by: null, approved_at: null });
const centre = (name: string, psgc: string): EvacuationCentre => ({ id: name, version: 1, code: null, name, barangay_psgc: psgc, kind: 'other', capacity_persons: null,
  covered_area_m2: null, toilets_male: null, toilets_female: null, toilets_accessible: null, bathing: null, water_l_day: null, is_school: false, is_permanent: true,
  accessible: null, hazard_screening: null, structural_ref: null, ra12076: {}, verification_status: 'pending_field_validation' } as EvacuationCentre);

const input: CpInput = {
  plan, today: '2026-11-28',
  hazards: [hz('tropical_cyclone', 'Tropical cyclone (severe winds)', 1), hz('flash_flood', 'Flash flood (Anilao–Malbasag system)', 4)],
  items: [item('module', 'operations', 'on', 'red'), item('module', 'planning', 'on', 'blue'), item('module', 'logistics', 'on', 'blue'), item('module', 'cluster_desks', 'lead', 'red'),
    item('cluster', 'SRR', 'lead', 'red', 'Lead. CDRRMO rescue team'), item('cluster', 'CCCM', 'lead', 'red', 'Lead. Anchored on the six CSWD districts'),
    item('cluster', 'HEALTH', 'standby', 'red'), item('cluster', 'FNFI', 'standby', 'red')],
  clusters: [cluster('FNFI', 'Food and Non-Food Items', 1), cluster('CCCM', 'Camp Coordination and Camp Management', 2), cluster('HEALTH', 'Health (WASH, nutrition, MHPSS)', 4),
    cluster('SRR', 'Search, Rescue and Retrieval', 8)],
  offices: [{ id: 'o-cswdo', code: 'CSWDO', name: 'City Social Welfare and Development Office', kind: 'city' }],
  positions: [pos], designations: [des(1, 'CDRRMO Head'), des(2, 'Operations Division Head')],
  eocPoint: { id: 'e', version: 1, code: 'EOC', name: 'City EOC', kind: 'eoc', lat: 11.013896, lng: 124.604287, altitude_m: null, source: 'KML', verification_status: 'pending_field_validation',
    verified_by: null, verified_at: null, superseded_by: null, vault_document_id: null, note: null, created_by: null },
  barangays: [brgy('0803738049', 'Dolores', 1), brgy('0803738018', 'Curva', 2), brgy('0803738107', 'Danhug', 4)],
  centres: [centre('Dolores Evacuation Center', '0803738049'), centre('Curva Evacuation Center', '0803738018'), centre('Danhug Evacuation Center', '0803738107')],
  districts: [1, 2, 3, 4, 5, 6].map((n) => ({ code: `District ${n}`, coordinatorTitle: 'Social Welfare Officer III / District Camp Coordinator', barangays: n === 1 ? ['Dolores'] : ['x'] })),
};
const sheets = buildCpWorkbook(input);
const byName = (n: string) => sheets.find((s) => s.name === n)!;
const flat = (n: string) => byName(n).rows.flat();

describe('contingency plan template (CP Guidebook, Feb 2020)', () => {
  it('has every form in order, with Forms 6, 7 and 8 for each cluster the plan seats', () => {
    expect(sheets.map((s) => s.name)).toEqual(['Guide', 'CP Form 1', 'CP Form 2', 'CP Form 3A', 'CP Form 4A', 'CP Form 4B', 'CP Form 5',
      ...['FNFI', 'CCCM', 'HEALTH', 'SRR'].flatMap((c) => [clusterSheet(6, c), clusterSheet(7, c), clusterSheet(8, c)]),
      'CP Form 9', 'CP Form 10', 'CP Form 11', 'Chapter IV', 'Annex Families']);
    expect(sheets.every((s) => s.name.length <= 31)).toBe(true);
  });
  it('uses the Guidebook column headings', () => {
    expect(flat('CP Form 1')).toEqual(expect.arrayContaining(['HAZARD', 'PROBABILITY RATE', 'IMPACT RATE', 'AVERAGE (PROBABILITY + IMPACT ÷ 2)', 'RANK']));
    expect(flat('CP Form 2')).toEqual(expect.arrayContaining(['ROOT CAUSES', 'EARLY WARNING SIGNS', 'TRIGGERING FACTORS', 'EXISTING MITIGATING MEASURES']));
    expect(flat('CP Form 3A')).toEqual(expect.arrayContaining(['BAD', 'WORSE', 'WORST', 'EFFECTS: Government Trust']));
    expect(flat('CP Form 4A')).toEqual(expect.arrayContaining(['AREA/ LOCATION', 'INSIDE EVACUATION CENTERS', 'OUTSIDE EVACUATION CENTERS', 'REASONS FOR DISPLACEMENT']));
    expect(flat(clusterSheet(8, 'SRR'))).toEqual(expect.arrayContaining(['GAPS (NEED – HAVE)', 'ACTIVITIES/ SOURCES TO FILL THE GAPS', 'SOURCE OF FUNDS']));
    expect(flat('CP Form 11')).toEqual(expect.arrayContaining(['Incident Command Post', 'Helibase', 'Incident Commander', 'Finance/Admin Section Chief']));
  });
  it('computes what the Guidebook computes, as formulas', () => {
    expect(byName('CP Form 1').rows[5]![5]).toEqual({ f: 'IF(AND(ISNUMBER(B6),ISNUMBER(D6)),(B6+D6)/2,"")' });
    expect(byName('CP Form 1').rows[5]![6]).toEqual({ f: 'IF(ISNUMBER(F6),RANK(F6,$F$6:$F$7),"")' });
    expect(byName(clusterSheet(8, 'SRR')).rows[6]![3]).toEqual({ f: 'IF(AND(ISNUMBER(B7),ISNUMBER(C7)),MAX(0,B7-C7),"")' });
    const f9 = byName('CP Form 9').rows;
    expect(f9[5]![1]).toEqual({ f: "'CP Form 8 FNFI'!D15" });
    expect(f9.at(-3)).toEqual(['TOTAL', { f: 'SUM(B6:B9)' }, { f: 'SUM(C6:C9)' }]);
    const f4 = byName('CP Form 4A').rows;
    expect(f4.find((r) => r[0] === 'TOTAL')![1]).toEqual({ f: 'SUM(B6:B8)' });
  });
  it('invents no ratings, populations, resources or costs', () => {
    for (const s of sheets.filter((x) => x.name !== 'Annex Families')) {
      for (const c of s.rows.flat()) expect(typeof c === 'number', `${s.name} has a number`).toBe(false);
    }
  });
  it('lists barangays by CSWD district and fills the EOC, roster and clusters from MODE', () => {
    expect(flat('CP Form 4A')).toEqual(expect.arrayContaining(['Dolores (CSWD District 1)', 'Curva (CSWD District 2)', 'Danhug (CSWD District 4)']));
    expect(flat('CP Form 10')).toContain('Primary: CDRRMO Head; Alternate: Operations Division Head');
    expect(flat('CP Form 10').some((c) => typeof c === 'string' && c.startsWith('City EOC, 11.013896° N, 124.604287° E'))).toBe(true);
    const f5 = byName('CP Form 5').rows.find((r) => r[0] === 'Camp Coordination and Camp Management')!;
    expect(f5).toEqual(['Camp Coordination and Camp Management', 'City Social Welfare and Development Office', null, 'Lead', 'Lead. Anchored on the six CSWD districts']);
  });
  it('flash flood Chapter IV: lead clusters, modules and who decides', () => {
    const ch = flat('Chapter IV');
    expect(ch).toEqual(expect.arrayContaining(['Cluster desks', 'Lead clusters', 'Search, Rescue and Retrieval', 'Lead']));
    expect(ch.some((c) => typeof c === 'string' && /Responsible Official \(the Mayor/.test(c))).toBe(true);
    expect(byName('Chapter IV').rows.find((r) => r[0] === 'PDRA and AA desk')![1]).toBe('–');
  });
  it('keeps families together: CCCM and SRR activities and the annex anchors', () => {
    expect(flat(clusterSheet(6, 'CCCM')).some((c) => typeof c === 'string' && /one family, one bay/.test(c))).toBe(true);
    expect(flat(clusterSheet(6, 'SRR')).some((c) => typeof c === 'string' && /families together/.test(c))).toBe(true);
    const annex = flat('Annex Families');
    expect(annex.some((c) => typeof c === 'string' && /never an automatic rule/.test(c))).toBe(true);
    expect(byName('Annex Families').rows.find((r) => r[0] === 'District 1')![3]).toBe('Dolores Evacuation Center (pending field validation)');
    expect(byName('Annex Families').rows.find((r) => r[0] === 'District 2')![3]).toBe('Curva Evacuation Center (pending field validation)');
  });
  it('short-lead hazards plan in hours; human-induced uses Form 3B', () => {
    expect(timeframes(plan)[0]).toBe('D-6 hours');
    expect(timeframes({ hazard_code: 'tropical_cyclone' })[0]).toBe('D-3 days');
    expect(usesForm3B({ hazard_code: 'industrial' })).toBe(true);
    expect(planClusters(input).map((c) => c.cluster.code)).toEqual(['FNFI', 'CCCM', 'HEALTH', 'SRR']);
    expect(cpFileName(plan, '2026-11-28')).toBe('CP_TEMPLATE_CP-FLASHFLOOD_2026-11-28.xlsx');
  });
  it('writes a valid workbook', () => {
    const files = unzipSync(xlsxWorkbookBytes(sheets));
    expect(Object.keys(files).filter((f) => f.startsWith('xl/worksheets/')).length).toBe(sheets.length);
    expect(strFromU8(files['xl/workbook.xml']!)).toContain('name="Annex Families"');
  });
});
