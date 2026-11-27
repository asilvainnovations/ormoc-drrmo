import { describe, expect, it } from 'vitest';
import {
  BENCHMARKS, campReportProblems, campTotals, centreScreening, exerciseAlerts, exercisePhase, importExercise, latestPerCentre, movement, newExercise,
  parseWhole, populationProblems, spaceCheck, toiletCheck, waterCheck,
} from './echo';
import proto from './echo.fixture.json';

describe('ECHO standards stay distinct', () => {
  it('keeps the Sphere 15 L and the JMC 52 L as separate checks', () => {
    const w = waterCheck(1000, 20000);
    expect(w.needSphere).toBe(15000);
    expect(w.needJmc).toBe(52000);
    expect(w.meetsSphere).toBe(true);
    expect(w.meetsJmc).toBe(false);
  });
  it('blank water is not reported, not a failure', () => {
    expect(waterCheck(1000, null).meetsSphere).toBeNull();
  });
  it('uses 3.5 m² per person for covered space', () => {
    expect(spaceCheck(100, 350).meets).toBe(true);
    expect(spaceCheck(101, 350).meets).toBe(false);
    expect(spaceCheck(0, 350).capacityAtStandard).toBe(100);
  });
  it('computes RA 12076 toilets by sex and the JMC ratio by phase, separately', () => {
    const t = toiletCheck({ families: 100, persons: 400, female: 210, children: 120, older: 30, pwd: 10 }, { male: 9, female: 11, accessible: 5 }, 'short');
    expect(t.ra).toEqual({ male: 10, female: 11, accessible: 5 }); // 190/20, 210/20, 40/8
    expect(t.jmc).toBe(8); // 400/50
    expect(t.gaps).toEqual(['RA 12076: 10 for males, 9 available.']);
    expect(toiletCheck({ families: 100, persons: 400, female: null, children: null, older: null, pwd: null }, { male: 5, female: 5, accessible: 0 }, 'long').jmc).toBe(20);
  });
  it('lists each benchmark once with a source', () => {
    const keys = BENCHMARKS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(BENCHMARKS.find((b) => b.key === 'water_jmc_prolonged')!.value).toMatch(/52/);
    expect(BENCHMARKS.find((b) => b.key === 'toilet_ra')!.where).toBe('Sec. 4(c)(2)');
  });
});

describe('ECHO counts', () => {
  it('reads blanks as not reported', () => {
    expect(parseWhole('')).toBeNull();
    expect(parseWhole('12')).toBe(12);
    expect(parseWhole('-1')).toBe('invalid');
    expect(parseWhole('1.5')).toBe('invalid');
  });
  it('refuses groups larger than the total', () => {
    expect(populationProblems({ families: 10, persons: 5, female: 6, children: null, older: null, pwd: null }))
      .toEqual(['Persons cannot be fewer than families.', 'Women and girls cannot exceed persons.']);
  });
  it('computes movement loads and cycles', () => {
    expect(movement(1200, 12, 20, 40)).toEqual({ loads: 60, cycles: 5, minutes: 200 });
    expect(movement(1200, 0, 20, null).cycles).toBeNull();
  });
});

describe('ECHO exercise', () => {
  it('starts in preparation with a route alert', () => {
    const e = newExercise(new Date('2026-11-12T00:00:00Z'));
    expect(exercisePhase(e).step).toBe(1);
    expect(exerciseAlerts(e).map((a) => a.title)).toContain('Route not validated');
  });
  it('flags capacity and water for the default scenario at Site A', () => {
    const titles = exerciseAlerts(newExercise()).map((a) => a.title);
    expect(titles).toContain('Centre capacity exceeded');
    expect(titles).toContain('Covered space below 3.5 m² per person (Sphere)');
    expect(titles).toContain('Water below 15 L per person per day (Sphere, initial)'); // 15,000 L for 1,200 persons = 12.5 L
  });
  it('imports the standalone prototype export', () => {
    const e = importExercise(proto);
    expect(e.schema).toBe('mode-echo-exercise/2');
    expect(e.scenario.persons).toBe(1200);
    expect(e.scenario.female).toBe(620);
    expect(e.sites).toHaveLength(2);
    expect(e.sites[0]!.name).toMatch(/Training Site A/);
    expect(e.camp.water_l_day).toBe(15000);
    expect((e.camp.toilets_female ?? 0) + (e.camp.toilets_male ?? 0)).toBe(30);
    expect(() => importExercise({ hello: 1 })).toThrow(/not an ECHO exercise/);
  });
  it('round-trips its own format', () => {
    const e = newExercise();
    e.scenario.persons = 77;
    expect(importExercise(JSON.parse(JSON.stringify(e))).scenario.persons).toBe(77);
  });
});

describe('ECHO operational records', () => {
  const base = { activation_id: 'a', families: 10, persons: 40, female: 20, children: 10, older: 2, pwd: 1, water_l_day: 400,
    toilets_functional: 2, bathing_functional: 1, unmet_needs: null };
  it('takes the latest report per centre inside the window', () => {
    const r = latestPerCentre([
      { ...base, centre_id: 'c1', reported_at: '2026-11-12T01:00:00Z', phase: 'open' as const },
      { ...base, centre_id: 'c1', reported_at: '2026-11-12T03:00:00Z', phase: 'open' as const, persons: 60 },
      { ...base, centre_id: 'c2', reported_at: '2026-11-10T03:00:00Z', phase: 'open' as const },
    ], '2026-11-12T00:00:00Z');
    expect(r).toHaveLength(1);
    expect(r[0]!.persons).toBe(60);
  });
  it('totals open centres and lists blanks instead of adding zero', () => {
    const t = campTotals([
      { ...base, centre_id: 'c1', reported_at: 'x', phase: 'open' },
      { ...base, centre_id: 'c2', reported_at: 'x', phase: 'open', persons: null, families: null },
      { ...base, centre_id: 'c3', reported_at: 'x', phase: 'closed' },
    ], new Map([['c1', 30]]));
    expect(t.centresOpen).toBe(2);
    expect(t.persons).toBe(40);
    expect(t.personsNotReported).toBe(1);
    expect(t.overCapacity).toBe(1);
    expect(t.waterBelowSphere).toBe(1); // 400 L for 40 persons = 10 L
  });
  it('needs an authority reference to open or close a centre', () => {
    expect(campReportProblems({ ...base, centre_id: 'c', reported_at: 'x', phase: 'closing', authority_ref: '' })[0]).toMatch(/authority reference/);
    expect(campReportProblems({ ...base, centre_id: 'c', reported_at: 'x', phase: 'open' })).toEqual([]);
  });
  it('never calls a centre safe', () => {
    const s = centreScreening({ verification_status: 'field_verified', hazard_screening: 'Outside flood and landslide sheets', structural_ref: 'CEO 2026-1', is_school: false, ra12076: {} });
    expect(s.label).toBe('Screening complete');
    expect(s.label).not.toMatch(/safe/i);
    expect(centreScreening({ verification_status: 'training', hazard_screening: null, structural_ref: null, is_school: true, ra12076: { power: 'no' } }).notes)
      .toContain('School: last resort only (RA 10821).');
  });
});

describe('family unity (1.33.0)', () => {
  it('never advises splitting a family when a centre is full', async () => {
    const src = (await import('node:fs')).readFileSync('src/domain/echo.ts', 'utf8');
    expect(src).not.toMatch(/split the movement/);
    expect(src).toMatch(/move whole families there together/);
  });
  it('rules: family bay, separated child stays with the relative, carer with the person, social-worker gate', async () => {
    const { FAMILY_UNITY_RULES } = await import('./echo');
    const text = FAMILY_UNITY_RULES.map((r) => r.text).join(' ');
    expect(text).toMatch(/one partitioned bay/);
    expect(text).toMatch(/stays in that relative’s family bay/);
    expect(text).toMatch(/best-interest assessment, never an automatic rule/);
    expect(text).toMatch(/sleeps with the family or carer/);
    expect(text).not.toMatch(/dormitor(y|ies) (for|by) (men|women|children)/i);
  });
  it('alerts on separated and unaccompanied children, carer separations and split families; quiet when none', async () => {
    const { familyUnityAlerts } = await import('./echo');
    const a = familyUnityAlerts({ separated_children: 2, unaccompanied_children: 1, carer_separations: 1, families_apart: 3 });
    expect(a).toHaveLength(4);
    expect(a[0]).toMatch(/^1 unaccompanied child: refer to the CSWDO.*RA 10821 Sec\. 6/);
    expect(a[1]).toMatch(/^2 separated children: keep each with the relative/);
    expect(a[3]).toMatch(/^3 families are not housed together/);
    expect(familyUnityAlerts({})).toEqual([]);
  });
  it('school stay: JMC 3 and 15 days, RA 10821 Sec. 5 documentation', async () => {
    const { schoolStay } = await import('./echo');
    expect(schoolStay(2, false)?.tone).toBe('ok');
    expect(schoolStay(4, false)?.tone).toBe('warn');
    expect(schoolStay(2, true)?.text).toMatch(/RA 10821 Sec\. 5/);
    expect(schoolStay(16, false)).toMatchObject({ tone: 'bad' });
    expect(schoolStay(null, false)).toBeNull();
  });
  it('a report cannot count more separated children than children', async () => {
    const { campReportProblems } = await import('./echo');
    const base = { centre_id: 'c', activation_id: null, reported_at: '2026-11-28T00:00:00Z', phase: 'open' as const, families: 5, persons: 20, female: null, children: 2,
      older: 1, pwd: 0, water_l_day: null, toilets_functional: null, bathing_functional: null, unmet_needs: null };
    expect(campReportProblems({ ...base, separated_children: 2, unaccompanied_children: 1 })).toContain('Separated and unaccompanied children cannot be more than the children counted.');
    expect(campReportProblems({ ...base, carer_separations: 2 })).toContain('Persons apart from their carer cannot be more than persons with disability and older persons counted.');
    expect(campReportProblems({ ...base, separated_children: 1, carer_separations: 1, families_apart: 1 })).toEqual([]);
  });
  it('totals add family-unity counts across open centres only', async () => {
    const { campTotals } = await import('./echo');
    const r = (id: string, phase: 'open' | 'closed', sep: number) => ({ centre_id: id, activation_id: null, reported_at: 'x', phase, families: 1, persons: 4, female: null,
      children: 2, older: 0, pwd: 0, water_l_day: null, toilets_functional: null, bathing_functional: null, unmet_needs: null, separated_children: sep, families_apart: 1 });
    const t = campTotals([r('a', 'open', 1), r('b', 'open', 1), r('c', 'closed', 2)], new Map());
    expect(t).toMatchObject({ separatedChildren: 2, familiesApart: 2, unaccompaniedChildren: 0 });
  });
});
