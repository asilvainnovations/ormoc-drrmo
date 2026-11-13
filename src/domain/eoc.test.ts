import { describe, expect, it } from 'vitest';
import type { Activation, BarangayReport } from '@/types';
import {
  barangayReportProblem, currentReportWindow, evacuationTotals, eventOf, eventsOf, latestPerBarangay, parseCount, sitrepReportWindow,
} from './eoc';

const act = (id: string, level: 'blue' | 'red', started_at: string, ended_at: string | null): Activation =>
  ({ id, level, reason: 'test', hazard_code: null, authority_ref: null, started_at, ended_at, version: 1, created_at: started_at, updated_at: started_at } as Activation);

const rep = (psgc: string, reported_at: string, families: number | null, persons: number | null, condition: BarangayReport['condition'] = 'evacuating'): BarangayReport =>
  ({ id: `${psgc}-${reported_at}`, barangay_psgc: psgc, activation_id: null, reported_at, condition, families_evacuated: families, persons_evacuated: persons, remarks: null, channel: 'radio', created_at: reported_at });

// Typhoon in September (Blue then Red, closed), then a new Blue activation in November.
// The server returns +00:00 offsets; the device writes Z. Both must compare correctly.
const past = [act('sep-blue', 'blue', '2026-09-10T00:00:00Z', '2026-09-11T00:00:00Z'), act('sep-red', 'red', '2026-09-11T00:00:00+00:00', '2026-09-13T00:00:00Z')];
const now = [...past, act('nov-blue', 'blue', '2026-11-04T06:00:00Z', '2026-11-05T00:00:00Z'), act('nov-red', 'red', '2026-11-05T00:00:30Z', null)];

describe('events', () => {
  it('joins back-to-back activations (Blue then Red) into one event', () => {
    const ev = eventsOf(now);
    expect(ev).toHaveLength(2);
    expect(ev[0]!.activationIds).toEqual(['sep-blue', 'sep-red']);
    expect(ev[1]).toEqual({ start: '2026-11-04T06:00:00Z', end: null, activationIds: ['nov-blue', 'nov-red'] });
    expect(eventOf(now, 'nov-red')!.start).toBe('2026-11-04T06:00:00Z');
    expect(eventOf(now, null)).toBeNull();
  });
  it('keeps activations a day apart as separate events', () => {
    const ev = eventsOf([act('a', 'blue', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'), act('b', 'blue', '2026-10-03T00:00:00Z', null)]);
    expect(ev).toHaveLength(2);
  });
});

describe('report windows (#16)', () => {
  const reports = [
    rep('A', '2026-09-12T00:00:00Z', 300, 1200),        // September typhoon: must not count
    rep('B', '2026-09-12T00:00:00Z', 50, 200),
    rep('A', '2026-11-04T08:00:00+00:00', 10, 40),       // this event, Blue phase
    rep('A', '2026-11-05T02:00:00Z', 25, 90),            // this event, Red phase: latest for A
    rep('C', '2026-11-05T03:00:00Z', null, null, 'affected'),
  ];
  it('counts only the current event, across its Blue and Red phases', () => {
    const w = currentReportWindow(now);
    expect(w.kind).toBe('event');
    const latest = latestPerBarangay(reports, w);
    expect(latest.map((r) => r.barangay_psgc).sort()).toEqual(['A', 'C']);
    expect(evacuationTotals(latest)).toEqual({ families: 25, persons: 90, notReported: 1 });
  });
  it('at White level shows only the last 24 hours', () => {
    const w = currentReportWindow(past, new Date('2026-11-05T12:00:00Z'));
    expect(w.kind).toBe('monitoring');
    expect(latestPerBarangay(reports, w).map((r) => r.barangay_psgc).sort()).toEqual(['A', 'C']);
  });
  it('a SitRep uses its own event up to the end of its period', () => {
    const w = sitrepReportWindow(now, { activation_id: 'nov-blue', period_start: '2026-11-04T06:00:00Z', period_end: '2026-11-04T18:00:00Z' });
    expect(evacuationTotals(latestPerBarangay(reports, w))).toEqual({ families: 10, persons: 40, notReported: 0 });
  });
  it('a SitRep with no activation uses its period only', () => {
    const w = sitrepReportWindow(now, { activation_id: null, period_start: '2026-09-11T00:00:00Z', period_end: '2026-09-13T00:00:00Z' });
    expect(evacuationTotals(latestPerBarangay(reports, w))).toEqual({ families: 350, persons: 1400, notReported: 0 });
  });
});

describe('barangay report form (#17)', () => {
  it('reads a blank box as not reported, not zero', () => {
    expect(parseCount('')).toBeNull();
    expect(parseCount('  ')).toBeNull();
    expect(parseCount('0')).toBe(0);
    expect(parseCount('12')).toBe(12);
    expect(parseCount('-1')).toBe('invalid');
    expect(parseCount('1.5')).toBe('invalid');
  });
  it('needs both counts for an evacuating barangay, and persons at least families', () => {
    expect(barangayReportProblem({ condition: 'monitoring', families: '', persons: '' })).toBeNull();
    expect(barangayReportProblem({ condition: 'evacuating', families: '12', persons: '' })).toMatch(/needs both counts/);
    expect(barangayReportProblem({ condition: 'evacuating', families: '0', persons: '0' })).toBeNull();
    expect(barangayReportProblem({ condition: 'affected', families: '12', persons: '5' })).toMatch(/fewer than families/);
    expect(barangayReportProblem({ condition: 'affected', families: 'x', persons: '5' })).toMatch(/whole numbers/);
  });
});

// ---------------------------------------------------- reporting cut-offs (1.21.0, ADR-038)
import { cutoffForLevel, manilaTime, reportLate } from './eoc';
import type { SitrepCutoff } from '@/types';

const cutoff = (level: 'white' | 'blue' | 'red', barangay_am: string, barangay_pm: string): SitrepCutoff =>
  ({ id: level, alert_level: level, barangay_am, barangay_pm, submission_am: '06:00', submission_pm: '18:00', updated_by: null, version: 1 });
const CUTS = [cutoff('white', '05:00', '17:00'), cutoff('blue', '08:00', '18:00'), cutoff('red', '08:00', '18:00')];

describe('reporting cut-offs (ADR-038)', () => {
  it('picks the cut-off for the alert level', () => {
    expect(cutoffForLevel(CUTS, 'blue')?.barangay_am).toBe('08:00');
    expect(cutoffForLevel(CUTS, 'white')?.barangay_pm).toBe('17:00');
    expect(cutoffForLevel([], 'red')).toBeUndefined();
  });

  it('reads Manila time-of-day regardless of the running device', () => {
    expect(manilaTime('2026-11-14T05:30:00+08:00')).toBe('05:30');
    expect(manilaTime('2026-11-13T21:30:00Z')).toBe('05:30');   // same instant
  });

  it('flags a report late when it arrives after its window cut-off', () => {
    const white = cutoffForLevel(CUTS, 'white');
    expect(reportLate('2026-11-14T04:59:00+08:00', white)).toEqual({ late: false, cutoffTime: '05:00', window: 'am' });
    expect(reportLate('2026-11-14T05:01:00+08:00', white)).toEqual({ late: true, cutoffTime: '05:00', window: 'am' });
    expect(reportLate('2026-11-14T16:59:00+08:00', white)).toEqual({ late: false, cutoffTime: '17:00', window: 'pm' });
    expect(reportLate('2026-11-14T17:30:00+08:00', white)).toEqual({ late: true, cutoffTime: '17:00', window: 'pm' });
  });

  it('uses the seeded defaults when no cut-off is on the device', () => {
    expect(reportLate('2026-11-14T06:00:00+08:00', undefined).late).toBe(true);
    expect(reportLate('2026-11-14T04:00:00+08:00', undefined).late).toBe(false);
  });
});
