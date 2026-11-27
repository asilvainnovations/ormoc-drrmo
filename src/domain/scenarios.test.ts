import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  activeSections, FIGURE_1_7, hasModuleSet, liveModules, MODULE_ORDER, planRow, planStatusNote, SCENARIO_ROWS, seatedClusters, suggestPlans,
} from './scenarios';

// Operational file 06 holds the plans and their activation items. Parse it so the seed answers to Figure 1.7.
const SEED = readFileSync('supabase/seed/operational/06_eoc_structure.sql', 'utf8');
const planIds = new Map([...SEED.matchAll(/\('([0-9a-f-]{36})'::uuid, '(CP-[A-Z0-9-]+)'/g)].map((m) => [m[1]!, m[2]!]));
const items = [...SEED.matchAll(/\('[0-9a-f-]{36}'::uuid, '([0-9a-f-]{36})'::uuid, '(module|cluster)', '([A-Za-z_]+)', '(on|lead|standby)', '(white|blue|red)'/g)]
  .map((m) => ({ plan_id: m[1]!, item_kind: m[2] as 'module' | 'cluster', item_code: m[3]!, state: m[4] as 'on' | 'lead' | 'standby', min_level: m[5]! }));

describe('Figure 1.7 parity: the seed seats exactly the modules the Manual shows', () => {
  it('has the seven scenarios of the figure', () => {
    expect([...planIds.values()].sort()).toEqual(SCENARIO_ROWS.map((r) => r.code).sort());
    expect(items.length).toBeGreaterThan(50);
  });
  it.each(SCENARIO_ROWS)('$label', ({ code }) => {
    const id = [...planIds].find(([, c]) => c === code)![0];
    expect(planRow(items, id)).toEqual(FIGURE_1_7[code]);
  });
  it('a "Lead clusters" cell always has at least one cluster that leads (flash flood included)', () => {
    for (const { code } of SCENARIO_ROWS) {
      const id = [...planIds].find(([, c]) => c === code)![0];
      if (planRow(items, id).cluster_desks !== 'lead') continue;
      expect(items.some((i) => i.plan_id === id && i.item_kind === 'cluster' && i.state === 'lead'), code).toBe(true);
    }
  });
  it('flash flood: SRR and CCCM lead, Health and FNFI on standby', () => {
    const id = [...planIds].find(([, c]) => c === 'CP-FLASHFLOOD')![0];
    const cl = Object.fromEntries(items.filter((i) => i.plan_id === id && i.item_kind === 'cluster').map((i) => [i.item_code, i.state]));
    expect(cl).toEqual({ SRR: 'lead', CCCM: 'lead', HEALTH: 'standby', FNFI: 'standby' });
  });
  it('seats only Planning, the PDRA and AA desk and Logistics from Blue on a Red plan (Table 1.12)', () => {
    const blue = items.filter((i) => i.item_kind === 'module' && i.min_level === 'blue' && planIds.get(i.plan_id) === 'CP-FLOOD-LUNOP').map((i) => i.item_code).sort();
    expect(blue).toEqual(['logistics', 'pdra_aa_desk', 'planning']);
  });
});

describe('live modules and sections', () => {
  const live = liveModules([
    { item_kind: 'module', item_code: 'operations', state: 'standby' }, { item_kind: 'module', item_code: 'planning', state: 'on' },
    { item_kind: 'module', item_code: 'cluster_desks', state: 'lead' }, { item_kind: 'cluster', item_code: 'SRR', state: 'lead' },
  ]);
  it('reads module states and leaves the rest off', () => {
    expect(live).toMatchObject({ operations: 'standby', planning: 'on', cluster_desks: 'lead', logistics: 'off' });
    expect(Object.keys(live)).toEqual([...MODULE_ORDER]);
  });
  it('staffs only the sections of modules that are on', () => {
    expect([...activeSections(live)].sort()).toEqual(['cluster_desk', 'command', 'command_staff', 'planning']);
  });
  it('knows whether a plan set the modules', () => {
    expect(hasModuleSet([{ item_kind: 'cluster' }])).toBe(false);
    expect(hasModuleSet([{ item_kind: 'module' }])).toBe(true);
  });
  it('groups seated clusters by state in the clusters order', () => {
    const s = seatedClusters([{ item_kind: 'cluster', item_code: 'CCCM', state: 'lead' }, { item_kind: 'cluster', item_code: 'SRR', state: 'lead' },
      { item_kind: 'cluster', item_code: 'HEALTH', state: 'standby' }], [{ code: 'SRR', name: 'Search, Rescue and Retrieval', sort: 8 },
      { code: 'CCCM', name: 'Camp Coordination and Camp Management', sort: 2 }, { code: 'HEALTH', name: 'Health', sort: 4 }]);
    expect(s.lead.map((c) => c.code)).toEqual(['CCCM', 'SRR']);
    expect(s.standby.map((c) => c.code)).toEqual(['HEALTH']);
  });
});

describe('plan suggestions and status', () => {
  const plans = [
    { code: 'CP-FLOOD-LUNOP', status: 'adopted' as const, hazard_code: 'flood', hazard_codes: ['tropical_cyclone', 'storm_surge', 'flood'] },
    { code: 'CP-EARTHQUAKE', status: 'expired' as const, hazard_code: 'earthquake', hazard_codes: ['earthquake', 'tsunami'] },
    { code: 'CP-OLD', status: 'retired' as const, hazard_code: 'tsunami', hazard_codes: [] },
  ];
  it('suggests the typhoon plan for a tropical cyclone and the earthquake plan for a tsunami, never a retired one', () => {
    expect(suggestPlans(plans, 'tropical_cyclone').map((p) => p.code)).toEqual(['CP-FLOOD-LUNOP']);
    expect(suggestPlans(plans, 'tsunami').map((p) => p.code)).toEqual(['CP-EARTHQUAKE']);
    expect(suggestPlans(plans, 'extreme_heat')).toEqual([]);
    expect(suggestPlans(plans, null)).toEqual([]);
  });
  it('says an expired plan is expired and names the three-year Gawad KALASAG rule', () => {
    expect(planStatusNote({ status: 'expired', adopted_ref: null, valid_until: '2025-12-31' }, '2026-11-28')).toMatch(/^Expired on 2025-12-31.*three years/);
    expect(planStatusNote({ status: 'to_prepare', adopted_ref: null, valid_until: null }, '2026-11-28')).toMatch(/proposal/);
  });
});
