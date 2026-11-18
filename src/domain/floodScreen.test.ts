import { describe, expect, it } from 'vitest';
import { annuity, classCounts, floodClassOf, leadStrategy, missingAssumptions, screenAll, screenMeasure, watchList, watchText, type Assumptions, type FloodRow, type Measure } from './floodScreen';

const row = (psgc: string, name: string, cls: FloodRow['cls'], exposedPop: number | null, exposurePct: number | null = null, priority: number | null = null): FloodRow =>
  ({ psgc, name, cls, exposedPop, exposurePct, pop2024: null, priority });

describe('flood class', () => {
  it('reads DDRiVE text and never turns a blank into a low class', () => {
    expect(floodClassOf('High')).toBe('High');
    expect(floodClassOf('Moderate-High')).toBe('High');
    expect(floodClassOf(null)).toBe('Not assessed');
    expect(floodClassOf('')).toBe('Not assessed');
  });
});

describe('watch list', () => {
  const rows = [row('1', 'Cogon', 'Moderate', 900), row('2', 'Lao', 'High', 100, 5, 3), row('3', 'Linao', 'Very high', 50, 40, 1), row('4', 'Ipil', 'High', 400, 2, 2), row('5', 'Alta', 'High', null), row('6', 'Dry', 'Not assessed', 9000)];
  it('keeps barangays at or above the chosen class, class first, then the basis', () => {
    expect(watchList(rows, 'High', 'exposed').map((r) => r.name)).toEqual(['Linao', 'Ipil', 'Lao', 'Alta']);
    expect(watchList(rows, 'Moderate', 'exposed').map((r) => r.name)).toEqual(['Linao', 'Ipil', 'Lao', 'Alta', 'Cogon']);
  });
  it('orders by share and by priority, with unknown figures last', () => {
    expect(watchList(rows, 'High', 'share').map((r) => r.name)).toEqual(['Linao', 'Lao', 'Ipil', 'Alta']);
    expect(watchList(rows, 'High', 'priority').map((r) => r.name)).toEqual(['Linao', 'Ipil', 'Lao', 'Alta']);
  });
  it('counts people per class and flags unknowns', () => {
    const c = classCounts(rows);
    expect(c[0]).toEqual({ cls: 'Very high', barangays: 1, people: 50, unknown: 0 });
    expect(c.find((x) => x.cls === 'High')).toEqual({ cls: 'High', barangays: 3, people: 500, unknown: 1 });
  });
  it('writes rainfall as context only', () => {
    const t = watchText(watchList(rows, 'High', 'exposed'), { rain24: '120', rain72: '', product: 'PAGASA bulletin 5', at: '' });
    expect(t).toContain('24-hour rainfall 120 mm');
    expect(t).toContain('not a warning');
    expect(t.split('\n')[1]).toMatch(/^1\. Linao \| Very high/);
  });
});

describe('benefit-cost screen', () => {
  const a: Assumptions = { assets: 100, damage: 0.5, events: 1, horizon: 10, discount: 0, om: 0.02 };
  const m: Measure = { id: 'a', name: 'Riparian buffer', type: 'nbs', capital: 50, reduction: 0.4, economic: 0, social: 0 };
  it('annuity handles a zero rate and a positive rate', () => {
    expect(annuity(0, 10)).toBe(10);
    expect(annuity(0.1, 1)).toBeCloseTo(1 / 1.1, 10);
  });
  it('computes benefits, cost, BCR and NPV from the assumptions', () => {
    const r = screenMeasure(a, m);
    expect(r.avoided).toBeCloseTo(200); // 100 x 0.5 x 1 x 0.4 x 10 years
    expect(r.cost).toBeCloseTo(60);     // 50 + 50 x 0.02 x 10
    expect(r.bcr).toBeCloseTo(200 / 60);
    expect(r.npv).toBeCloseTo(140);
  });
  it('adds the other two dividends to the benefits', () => {
    const r = screenMeasure(a, { ...m, economic: 2, social: 3 });
    expect(r.benefits).toBeCloseTo(200 + 20 + 30);
  });
  it('responds to the assumptions: more events, higher BCR', () => {
    expect(screenMeasure({ ...a, events: 2 }, m).bcr!).toBeGreaterThan(screenMeasure(a, m).bcr!);
  });
  it('ranks by BCR, skips measures with no cost, and names the lead', () => {
    const g: Measure = { id: 'b', name: 'Pump station', type: 'grey', capital: 200, reduction: 0.3, economic: 0, social: 0 };
    const none: Measure = { id: 'c', name: 'Blank', type: 'hybrid', capital: 0, reduction: 0.5, economic: 0, social: 0 };
    const res = screenAll(a, [g, m, none]);
    expect(res.map((r) => r.measure.id)).toEqual(['a', 'b']);
    expect(leadStrategy(res)?.key).toBe('hybrid');
    expect(leadStrategy(screenAll(a, [m]))?.label).toBe('Nature-based first');
    expect(leadStrategy([])).toBeNull();
  });
  it('says what is missing instead of showing zeros', () => {
    expect(missingAssumptions({ ...a, assets: 0, events: 0 })).toEqual(['assets exposed', 'events per year']);
    expect(missingAssumptions(a)).toEqual([]);
  });
});
