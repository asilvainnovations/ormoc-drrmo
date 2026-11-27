import { describe, expect, it } from 'vitest';
import { attentionItems, nextSubmission } from './boardAttention';

const base = { activeEvent: true, silentPriority: [], lifeSafetyAwaiting: 0, campsOverCapacity: 0, evacCountsMissing: 0, nextSitrep: null };

describe('attentionItems', () => {
  it('is empty when nothing needs attention', () => { expect(attentionItems(base)).toEqual([]); });
  it('puts life-safety requests first and names silent barangays', () => {
    const r = attentionItems({ ...base, lifeSafetyAwaiting: 2, silentPriority: ['Cogon', 'Linao', 'Ipil', 'Curva'] });
    expect(r[0]!.id).toBe('ls');
    expect(r[1]!.text).toContain('4 high-risk barangays not yet reporting: Cogon, Linao, Ipil…');
  });
  it('does not ask about silent barangays when no event is active', () => {
    expect(attentionItems({ ...base, activeEvent: false, silentPriority: ['Cogon'] })).toEqual([]);
  });
  it('flags a SitRep only when due within two hours', () => {
    expect(attentionItems({ ...base, nextSitrep: { time: '18:00', minutes: 90 } })).toHaveLength(1);
    expect(attentionItems({ ...base, nextSitrep: { time: '18:00', minutes: 300 } })).toHaveLength(0);
  });
});

describe('nextSubmission', () => {
  const cutoff = { submission_am: '06:00:00', submission_pm: '18:00:00' };
  it('picks the evening time in the afternoon (Manila)', () => {
    const r = nextSubmission(cutoff, new Date('2026-11-18T06:22:00Z')); // 14:22 Manila
    expect(r).toEqual({ time: '18:00', minutes: 218 });
  });
  it('rolls to tomorrow morning after the evening time', () => {
    const r = nextSubmission(cutoff, new Date('2026-11-18T12:00:00Z')); // 20:00 Manila
    expect(r).toEqual({ time: '06:00', minutes: 600 });
  });
  it('is null without a cut-off', () => { expect(nextSubmission(undefined)).toBeNull(); });
});

describe('families together on the board (1.33.0)', () => {
  it('raises one item for separated children, carer separations and split families', async () => {
    const { attentionItems } = await import('./boardAttention');
    const base = { activeEvent: true, silentPriority: [], lifeSafetyAwaiting: 0, campsOverCapacity: 0, evacCountsMissing: 0, nextSitrep: null };
    const a = attentionItems({ ...base, familyUnity: { children: 2, carers: 1, families: 0 } });
    expect(a).toEqual([{ id: 'family', tone: 'bad', text: 'Families together: 2 children unaccompanied or separated, 1 person apart from their carer', to: '/tools/echo/dashboard' }]);
    expect(attentionItems({ ...base, familyUnity: { children: 0, carers: 0, families: 0 } })).toEqual([]);
  });
});
