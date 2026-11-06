import { describe, expect, it } from 'vitest';
import { activatedState, clusterStatus, depthSummary, levelBelow, manilaToday, positionDepth } from './structure';
import type { Barangay, BarangayCluster, BarangayReport, EocDesignation, EocPosition } from '@/types';

const pos = (id: string, sort: number): EocPosition => ({ id, code: id.toUpperCase(), title: id, section: 'operations', min_level: 'red',
  cluster_code: null, required_depth: 3, sort, is_active: true, version: 1 });
const des = (id: string, position_id: string, rank: 1 | 2 | 3, status: EocDesignation['status'], valid_until: string | null = null): EocDesignation => ({
  id, position_id, rank, person_id: null, office_id: 'o', designee_position: null, status, valid_from: '2026-01-01', valid_until, note: null,
  proposed_by: null, approved_by: null, approved_at: null, version: 1 });

describe('positionDepth mirrors v_eoc_depth', () => {
  const rows = positionDepth([pos('b', 2), pos('a', 1), { ...pos('x', 0), is_active: false }], [
    des('1', 'a', 1, 'approved'), des('2', 'a', 2, 'approved'), des('3', 'a', 3, 'proposed'),
    des('4', 'b', 1, 'approved', '2026-01-31'), des('5', 'b', 2, 'withdrawn'),
  ], '2026-11-06');
  it('orders by sort and drops inactive positions', () => expect(rows.map((r) => r.position.id)).toEqual(['a', 'b']));
  it('counts live approvals and proposals', () => {
    expect(rows[0]).toMatchObject({ approved: 2, proposed: 1, hasPrimary: true, twoDeep: true, threeDeep: false });
    expect(rows[0]!.byRank[3]!.id).toBe('3');
  });
  it('an expired approval still marks a primary but does not count toward depth', () =>
    expect(rows[1]).toMatchObject({ approved: 0, hasPrimary: true, twoDeep: false }));
  it('summarises B4.2', () => expect(depthSummary(rows)).toEqual({ positions: 2, twoDeep: 1, threeDeep: 0, noPrimary: 0, share: 0.5 }));
});

describe('activatedState mirrors activate_contingency_plan', () => {
  it('is standby below the minimum level', () => expect(activatedState({ state: 'on', min_level: 'red' }, 'blue')).toBe('standby'));
  it('keeps the plan state at or above it', () => expect(activatedState({ state: 'lead', min_level: 'blue' }, 'red')).toBe('lead'));
  it('a standby item stays standby', () => expect(activatedState({ state: 'standby', min_level: 'white' }, 'red')).toBe('standby'));
  it('orders levels like the enum', () => { expect(levelBelow('white', 'blue')).toBe(true); expect(levelBelow('red', 'blue')).toBe(false); });
});

describe('clusterStatus mirrors v_cluster_status', () => {
  const clusters: BarangayCluster[] = [{ id: 'c1', code: 'D1', name: 'District 1', is_pilot: true, pilot_from: null, pilot_to: null, note: null, version: 1 }];
  const b = (psgc: string, name: string): Barangay => ({ psgc, name, classification: [], population: null, lat: null, lng: null, cluster_id: 'c1' });
  const r = (id: string, psgc: string, at: string, condition: BarangayReport['condition'], persons: number | null, act = 'A'): BarangayReport => ({
    id, barangay_psgc: psgc, activation_id: act, reported_at: at, condition, families_evacuated: null, persons_evacuated: persons, remarks: null, channel: null, created_at: at });
  const out = clusterStatus(clusters, [b('1', 'Liloan'), b('2', 'Cogon'), b('3', 'Alegria')], [
    r('a', '1', '2026-11-06T01:00:00Z', 'evacuating', 40), r('b', '1', '2026-11-06T03:00:00Z', 'affected', 55),
    r('c', '2', '2026-11-06T02:00:00Z', 'normal', null), r('d', '3', '2026-11-06T02:00:00Z', 'isolated', 9, 'OLD'),
  ], 'A');
  it('uses each barangay\'s latest report in the open activation only', () =>
    expect(out[0]).toMatchObject({ barangays: 3, reporting: 2, silent: 1, affected: 1, personsEvacuated: 55, lastReportAt: '2026-11-06T03:00:00Z', silentNames: ['Alegria'] }));
  it('reports nothing without an open activation', () => expect(clusterStatus(clusters, [b('1', 'Liloan')], [], null)[0]!.silent).toBe(1));
});

it('gives the Manila date', () => expect(manilaToday(new Date('2026-11-05T17:30:00Z'))).toBe('2026-11-06'));
