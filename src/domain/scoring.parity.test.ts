// The TypeScript engine must give the same results as the PostgreSQL views
// (fixture produced by scripts/make_parity_fixture.sh).
import { describe, expect, it } from 'vitest';
import reference from '@/data/reference.json';
import fixture from '@/test/fixtures/scoring-parity.json';
import { cycleResults } from './scoring';
import type { Domain, Indicator, Response } from '@/types';

const responses = fixture.responses.map((r, i) => ({ id: String(i), cycle_id: 'c', indicator_id: r.indicator_id, score: r.score, is_na: r.is_na,
  na_justification: null, gap_remarks: null, recommended_action: null, status: 'draft', version: 1 })) as Response[];
const res = cycleResults(reference.indicators as Indicator[], reference.domains as Domain[], responses);

describe('scoring parity with SQL', () => {
  it.each(fixture.domains)('domain $domain', (d) => {
    const r = res.domains[d.domain]!;
    expect(r.scored).toBe(d.scored);
    expect(r.maturityIndex).toBe(d.maturity_index === null ? null : Number(d.maturity_index));
    expect(r.mandatoryCompliance).toBe(d.mandatory_compliance === null ? null : Number(d.mandatory_compliance));
    expect(r.highGaps).toBe(d.high_gaps);
  });
  it.each(fixture.cycle)('group $grp', (g) => {
    const r = { A: res.partA, B: res.partB, C: res.interface, IMI: res.imi }[g.grp as 'A' | 'B' | 'C' | 'IMI'];
    expect(r.scored).toBe(g.scored);
    expect(r.maturityIndex).toBe(Number(g.maturity_index));
    expect(r.mandatoryCompliance).toBe(g.mandatory_compliance === null ? null : Number(g.mandatory_compliance));
    expect(r.highGaps).toBe(g.high_gaps);
  });
});
