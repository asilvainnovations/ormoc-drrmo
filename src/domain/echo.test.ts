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
