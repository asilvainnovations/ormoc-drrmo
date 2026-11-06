// EOC structure and contingency-plan clustering (ADR-017). Mirrors, in order:
//   v_eoc_depth, v_cluster_status and the state rule in activate_contingency_plan()
//   (supabase/migrations/20261106001800_eoc_structure_and_clusters.sql).
import type { BarangayCluster, BarangayReport, Barangay, CpActivationItem, EocDesignation, EocLevel, EocPosition } from '@/types';

const LEVEL_RANK: Record<EocLevel, number> = { white: 0, blue: 1, red: 2 };
/** Postgres enum order white < blue < red. */
export const levelBelow = (a: EocLevel, b: EocLevel) => LEVEL_RANK[a] < LEVEL_RANK[b];

export interface PositionDepth {
  position: EocPosition; approved: number; proposed: number; hasPrimary: boolean; twoDeep: boolean; threeDeep: boolean;
  /** The approved designation for each rank (1 primary, 2 and 3 alternates), if any. */
  byRank: Record<1 | 2 | 3, EocDesignation | undefined>;
}

/** today is a Manila calendar date, yyyy-mm-dd (current_date on the server). */
export function positionDepth(positions: EocPosition[], designations: EocDesignation[], today: string): PositionDepth[] {
  const live = (d: EocDesignation) => d.status === 'approved' && (d.valid_until === null || d.valid_until >= today);
  return positions.filter((p) => p.is_active).sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code)).map((p) => {
    const ds = designations.filter((d) => d.position_id === p.id);
    const approved = ds.filter(live).length;
    const byRank = { 1: undefined, 2: undefined, 3: undefined } as PositionDepth['byRank'];
    for (const d of ds) if (d.status !== 'withdrawn' && (!byRank[d.rank] || d.status === 'approved')) byRank[d.rank] = d;
    return {
      position: p, approved, proposed: ds.filter((d) => d.status === 'proposed').length,
      hasPrimary: ds.some((d) => d.rank === 1 && d.status === 'approved'),
      twoDeep: approved >= 2, threeDeep: approved >= 3, byRank,
    };
  });
}

/** Share of positions covered two deep, the B4.2 measure (null when no positions are set). */
export function depthSummary(rows: PositionDepth[]) {
  const n = rows.length;
  return {
    positions: n,
    twoDeep: rows.filter((r) => r.twoDeep).length,
    threeDeep: rows.filter((r) => r.threeDeep).length,
    noPrimary: rows.filter((r) => !r.hasPrimary).length,
    share: n ? rows.filter((r) => r.twoDeep).length / n : null,
  };
}

/** The state an item takes when its plan is activated at this level (standby below its minimum level). */
export const activatedState = (item: Pick<CpActivationItem, 'state' | 'min_level'>, level: EocLevel) =>
  item.state === 'standby' || levelBelow(level, item.min_level) ? 'standby' : item.state;

export interface ClusterStatus {
  cluster: BarangayCluster; barangays: number; reporting: number; silent: number; affected: number;
  personsEvacuated: number; lastReportAt: string | null; silentNames: string[];
}

const AFFECTED = new Set(['affected', 'isolated', 'evacuating']);

/** The Barangay Liaison Desk roll-up: latest report per barangay in the open activation, by cluster. */
export function clusterStatus(clusters: BarangayCluster[], barangays: Barangay[], reports: BarangayReport[], activationId: string | null): ClusterStatus[] {
  const latest = new Map<string, BarangayReport>();
  if (activationId) {
    for (const r of reports) {
      if (r.activation_id !== activationId) continue;
      const cur = latest.get(r.barangay_psgc);
      if (!cur || r.reported_at > cur.reported_at) latest.set(r.barangay_psgc, r);
    }
  }
  return [...clusters].sort((a, b) => a.code.localeCompare(b.code)).map((c) => {
    const bs = barangays.filter((b) => b.cluster_id === c.id);
    const rs = bs.map((b) => latest.get(b.psgc)).filter((r): r is BarangayReport => !!r);
    return {
      cluster: c, barangays: bs.length, reporting: rs.length, silent: bs.length - rs.length,
      affected: rs.filter((r) => AFFECTED.has(r.condition)).length,
      personsEvacuated: rs.reduce((s, r) => s + (r.persons_evacuated ?? 0), 0),
      lastReportAt: rs.reduce<string | null>((m, r) => (m === null || r.reported_at > m ? r.reported_at : m), null),
      silentNames: bs.filter((b) => !latest.has(b.psgc)).map((b) => b.name).sort(),
    };
  });
}

/** Today's date in Manila, yyyy-mm-dd. */
export const manilaToday = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
