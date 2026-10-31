import { describe, expect, it } from 'vitest';
import { band, buildDrill, doctrineFor, ICS, metrics, scoreDecision, shuffled, spotlight, type Pick } from './ics/engine';
import { GK_CRITERIA, gkBand, gkResult, suggestFromIat } from './gk/gk';
import { pscpChecks, pscpMarkdown, riskBand, starterPscp } from './pscp/pscp';
import refData from '@/data/reference.json';

const IAT_IDS = new Set((refData as { indicators: { id: string }[] }).indicators.map((i) => i.id));

describe('ICS scenario data', () => {
  it('has six scenarios of four operational periods, each with exactly one best option', () => {
    expect(ICS.SCENARIOS).toHaveLength(6);
    for (const s of ICS.SCENARIOS) {
      expect(s.phases).toHaveLength(4);
      for (const p of s.phases) {
        expect(p.opts.filter((o) => o.v === 'best')).toHaveLength(1);
        for (const o of p.opts) { expect(o.s).toHaveLength(5); o.s.forEach((v) => expect(v).toBeGreaterThanOrEqual(0)); o.s.forEach((v) => expect(v).toBeLessThanOrEqual(100)); }
        for (const f of p.forms) expect(ICS.FORMS[f]).toBeTruthy();
      }
    }
  });
  it('has a three-decision drill for every position, and rubric weights that add to 1', () => {
    for (const r of ICS.ROLES) { const d = buildDrill(r.id); expect(d.phases).toHaveLength(3); d.phases.forEach((p) => expect(p.opts.filter((o) => o.v === 'best')).toHaveLength(1)); }
    expect(ICS.RUBRIC.reduce((a, c) => a + c.w, 0)).toBeCloseTo(1);
  });
  it('keeps the Ormoc facts current: 85 barangays', () => {
    expect(JSON.stringify(ICS)).not.toMatch(/\b110 barangays\b/);
  });
});

describe('ICS scoring', () => {
  const best = ICS.SCENARIOS[0]!.phases[0]!.opts.find((o) => o.v === 'best')!;
  it('keeps full timeliness in the first half of the time allowed, then falls to 60%', () => {
    expect(scoreDecision(best, 30, 120, { intel: false, hint: false, expert: false }).time).toBe(best.s[4]);
    expect(scoreDecision(best, 120, 120, { intel: false, hint: false, expert: false }).time).toBe(Math.round(best.s[4] * 0.6));
  });
  it('charges intel and hints against timeliness, more for intel at expert level', () => {
    const base = scoreDecision(best, 10, 120, { intel: false, hint: false, expert: false }).time;
    expect(scoreDecision(best, 10, 120, { intel: true, hint: false, expert: false }).time).toBe(base - 2);
    expect(scoreDecision(best, 10, 120, { intel: true, hint: true, expert: true }).time).toBe(base - 7);
  });
  it('weights the total by the rubric and bands it', () => {
    const p = (v: number): Pick => ({ phase: 0, name: '', clock: '', choice: '', verdict: 'best', why: '', best: '', bestWhy: '', secs: 0, intel: false, hint: false, timeout: false, role: 'ic', refs: [], fx: [],
      scores: { command: v, coordination: v, communication: v, decision: v, time: v } });
    expect(metrics([p(90), p(70)]).total).toBe(80);
    expect(band(85)).toBe('Exemplary'); expect(band(54)).toBe('Needs further training');
  });
  it('cites the instruments a decision rests on', () => {
    const refs = doctrineFor('Request a State of Imminent Disaster under RA 12287 after the PDRA');
    expect(refs).toEqual(expect.arrayContaining(['NDRRMC MC No. 4, s. 2012 (ICS)', 'RA 12287 and IRR (State of Imminent Disaster, anticipatory action)', 'NDRRMC Memo No. 17, s. 2014 (PDRA)']));
  });
  it('rotates the tabletop spotlight and shuffles without losing options', () => {
    expect(spotlight('multi', 'ic', 1).id).toBe('osc');
    expect(spotlight('single', 'ic', 3).id).toBe('ic');
    expect(shuffled([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('Gawad KALASAG Seal readiness', () => {
  it('uses the six published criteria, weights and indicator counts', () => {
    expect(GK_CRITERIA.map((c) => [c.name, c.weight, c.indicators.length])).toEqual([
      ['Structure', 0.25, 9], ['Competency', 0.35, 12], ['Management Systems', 0.15, 3],
      ['Enabling Policies', 0.05, 1], ['Knowledge Management and Advocacy', 0.1, 2], ['Partnership and Participation', 0.1, 2]]);
    expect(GK_CRITERIA.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1);
  });
  it('maps only to real IAT indicators', () => {
    for (const c of GK_CRITERIA) for (const i of c.indicators) for (const id of i.iat) expect(IAT_IDS.has(id)).toBe(true);
  });
  it('bands the weighted mean: 2.50-3.00 Beyond, 1.50-2.49 Fully', () => {
    expect(gkBand(2.5)).toBe('Beyond Compliant'); expect(gkBand(2.495)).toBe('Beyond Compliant');
    expect(gkBand(2.49)).toBe('Fully Compliant'); expect(gkBand(1.5)).toBe('Fully Compliant'); expect(gkBand(1.49)).toBe('Below Fully Compliant');
  });
  it('computes the weighted mean over criteria', () => {
    const all = (v: number) => Object.fromEntries(GK_CRITERIA.flatMap((c) => c.indicators.map((i) => [i.id, v])));
    expect(gkResult(all(2)).mean).toBeCloseTo(2);
    const mixed = { ...all(3), ...Object.fromEntries(GK_CRITERIA[1]!.indicators.map((i) => [i.id, 1])) };   // Competency at 1
    expect(gkResult(mixed).mean).toBeCloseTo(0.65 * 3 + 0.35 * 1);
    expect(gkResult(mixed).band).toBe('Fully Compliant');
  });
  it('never suggests more than the IAT evidence supports', () => {
    expect(suggestFromIat([3])).toBe(2); expect(suggestFromIat([4])).toBe(3); expect(suggestFromIat([2])).toBe(1);
    expect(suggestFromIat([4, 2])).toBe(2); expect(suggestFromIat([null, undefined])).toBeNull();
  });
});

describe('PSCP workbench', () => {
  it('starts from a consistent CDRRMO draft, apart from what the City must supply', () => {
    const c = pscpChecks(starterPscp());
    expect(c.some((x) => /RTO .* longer than the MTPD/.test(x))).toBe(false);
    expect(c).toEqual(expect.arrayContaining(['Designate an alternate site with an address (IAT B2.7).', 'Schedule the next test or exercise.']));
  });
  it('flags a recovery time beyond the tolerable disruption', () => {
    const p = starterPscp(); p.functions[0]!.rtoHours = 10; p.functions[0]!.mtpdHours = 2;
    expect(pscpChecks(p).some((x) => x.includes('longer than the MTPD'))).toBe(true);
  });
  it('writes a plan document with every section, functions in priority order', () => {
    const md = pscpMarkdown(starterPscp());
    for (const h of ['## 1. Policy and scope', '## 3. Essential functions', '## 4. Risk assessment', '### Orders of succession', '## 6. Activation', '## 7. Testing']) expect(md).toContain(h);
    expect(md.indexOf('24/7 hazard monitoring')).toBeLessThan(md.indexOf('Training, IEC'));
    expect(riskBand(25)).toBe('High'); expect(riskBand(9)).toBe('Medium'); expect(riskBand(4)).toBe('Low');
  });
});
