import { describe, expect, it } from 'vitest';
import { composeSitrep, lifelinesText, parseLifelines, type ComposeInput } from './sitrepCompose';

const base: ComposeInput = {
  level: 'red', hazardName: 'Tropical cyclone', hasActivation: true, periodStart: '2026-11-18T00:00:00Z', periodEnd: '2026-11-18T10:00:00Z', totalBarangays: 85,
  latest: [
    { barangay_psgc: 'a', condition: 'isolated', families_evacuated: 10, persons_evacuated: 40 },
    { barangay_psgc: 'b', condition: 'evacuating', families_evacuated: 5, persons_evacuated: 20 },
    { barangay_psgc: 'c', condition: 'normal', families_evacuated: null, persons_evacuated: null },
    { barangay_psgc: 'd', condition: 'affected', families_evacuated: null, persons_evacuated: null },
  ],
  names: new Map([['a', 'Linao'], ['b', 'Cogon'], ['d', 'Ipil']]),
  camps: { centresOpen: 2, persons: 300, families: 80, overCapacity: 1 },
  openRequests: [{ quantity: 50, unit: 'packs', item: 'Food packs', requesting_party: 'Cogon', priority: 'urgent' }, { quantity: 2, unit: 'units', item: 'Rescue boat', requesting_party: 'Linao', priority: 'life_safety' }],
  deliveredInPeriod: [{ quantity: 100, unit: 'litres', item: 'Drinking water', requesting_party: 'Ipil' }],
  log: [{ occurred_at: '2026-11-18T02:00:00Z', entry: 'Evacuation advised for Linao', category: 'decision' }, { occurred_at: '2026-11-18T01:00:00Z', entry: 'tea break', category: 'general' }],
};

describe('composeSitrep', () => {
  const r = composeSitrep(base);
  it('counts affected barangays and evacuees from the latest reports', () => {
    expect(r.affected_barangays).toBe(3);
    expect(r.evacuated_families).toBe(15); expect(r.evacuated_persons).toBe(60);
    expect(r.report_type).toBe('during_disaster');
  });
  it('writes a situation that names who is hit, who is isolated and what is not yet counted', () => {
    expect(r.situation).toContain('4 of 85 barangays have reported');
    expect(r.situation).toContain('Isolated: Linao');
    expect(r.situation).toContain('1 barangay has not reported counts');
    expect(r.situation).toContain('18:00'); // 10:00Z is 18:00 in Manila
    expect(r.situation).toContain('in 2 open centres, 1 over capacity');
  });
  it('lists decisions from the log only, oldest first', () => {
    expect(r.actions_taken).toBe('- 10:00 Evacuation advised for Linao');
  });
  it('puts life-safety needs first and lists what was delivered', () => {
    expect(r.needs!.split('\n')[0]).toContain('Rescue boat for Linao (life safety)');
    expect(r.assistance_provided).toContain('100 litres Drinking water to Ipil');
  });
  it('leaves empty sections null, never invented', () => {
    const e = composeSitrep({ ...base, latest: [], openRequests: [], deliveredInPeriod: [], log: [], camps: { centresOpen: 0, persons: 0, families: 0, overCapacity: 0 } });
    expect(e.actions_taken).toBeNull(); expect(e.needs).toBeNull(); expect(e.assistance_provided).toBeNull();
    expect(e.affected_barangays).toBe(0);
  });
});

describe('lifelines', () => {
  it('writes only the chosen lifelines and round-trips', () => {
    const t = lifelinesText({ power: 'out', roads: 'partial' }, 'Bridge at Cogon closed.');
    expect(t).toBe('Power: out. Roads and bridges: partly out. Bridge at Cogon closed.');
    expect(parseLifelines(t)).toEqual({ state: { power: 'out', roads: 'partial' }, note: 'Bridge at Cogon closed.' });
  });
  it('keeps free text the chips did not write', () => { expect(parseLifelines('Roads cut at Ipil').note).toBe('Roads cut at Ipil'); });
});
