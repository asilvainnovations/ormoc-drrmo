import { describe, expect, it } from 'vitest';
import ref from './reference.json';
import { explain, parseCitations } from './references';

const cw = ref.crosswalk as { framework: string; ref: string; subject: string }[];

describe('citations', () => {
  it('splits a field and inherits the instrument for bare rules', () => {
    const c = parseCitations('RA 12287; RA 12287 IRR (2026) Rule II Sec. 6; Rule III Secs. 2-4');
    expect(c.map((x) => [x.key, x.section])).toEqual([['RA 12287', undefined], ['RA 12287 IRR', 'Rule II Sec. 6'], ['RA 12287 IRR', 'Rule III Sec. 2-4']]);
    expect(parseCitations('RA 10121 Sec. 12; IRR Rule 6').map((x) => x.key)).toEqual(['RA 10121', 'RA 10121 IRR']);
    expect(parseCitations('IRR Rule IV Sec. 2(a)', 'aa')[0]!.key).toBe('RA 12287 IRR');
  });

  it('explains a known section and sends item numbers to the official text', () => {
    const fund = explain(parseCitations('RA 10121 Sec. 21')[0]!, cw);
    expect(fund.details[0]).toMatch(/Local DRRM Fund/);
    const item = explain(parseCitations('RA 10121 Sec. 12(c)(8)')[0]!, cw);
    expect(item.details.join(' ')).toMatch(/lists the functions of the local DRRM office/);
    expect(item.details.join(' ')).not.toMatch(/early warning/i);   // never guesses what item (8) says
  });

  it('takes Scorecard and IRR topics from the verified crosswalk', () => {
    expect(explain(parseCitations('UNDRR DRSC 2.3.1')[0]!, cw).details).toEqual(['Scorecard 2.3.1: Critical assets and failure chains.']);
    expect(explain(parseCitations('RA 12287 IRR (2026) Rule VI Sec. 1')[0]!, cw).details.join(' ')).toMatch(/45 days/);
  });

  it('matches IRR sections to crosswalk rows exactly, ranges included', () => {
    const d = (t: string) => explain(parseCitations(t, 'aa')[0]!, cw).details.join(' | ');
    expect(d('IRR Rule IV Sec. 3(a)(i)')).toMatch(/Rule IV Secs\. 3, 4, 6/);
    expect(d('IRR Rule IV Sec. 3(a)(i)')).not.toMatch(/Rule IV Sec\. 1:/);
    expect(d('IRR Rule IV Sec. 7(a)')).toMatch(/Social amelioration/);
    expect(d('RA 12287 IRR (2026) Rule III Secs. 2-4')).toMatch(/Declaration, request to RDRRMC/);
    expect(d('RA 12287 IRR (2026) Rule I Sec. 5(b),(d)')).toBe('');   // the crosswalk has no Rule I row: say nothing
  });

  it('recognizes the instruments behind almost every citation in the data', () => {
    const all = [...ref.indicators.flatMap((i) => parseCitations(i.reference)),
      ...ref.aa_action_templates.flatMap((a) => parseCitations(a.irr_ref, 'aa'))];
    const unknown = all.filter((c) => !c.key).map((c) => c.text);
    expect(all.length).toBeGreaterThan(250);
    // Generic phrases (for example "hazard maps", "DPWH") stay plain text.
    expect(unknown.length / all.length).toBeLessThan(0.05);
    expect(new Set(unknown)).toMatchSnapshot();
  });
});
