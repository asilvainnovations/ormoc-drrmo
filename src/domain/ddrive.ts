// DDRiVE risk band — the TypeScript mirror of view v_ddrive_city_risk
// (migration 20261110002100_ddrive_base.sql, ADR-024). The band of a desk score is
// COMPUTED from ddrive_risk_matrix, never stored. Keep the lookup identical to the view:
// severity between severity_min/max AND likelihood between likelihood_min/max.
import type { DdriveRiskMatrixRow } from '@/types';

export interface RiskBand { ranking: number; band: string; label: string }

export function riskBand(likelihood: number, severity: number, matrix: DdriveRiskMatrixRow[]): RiskBand | null {
  const row = matrix.find((m) => severity >= m.severity_min && severity <= m.severity_max
    && likelihood >= m.likelihood_min && likelihood <= m.likelihood_max);
  return row ? { ranking: row.ranking, band: row.band, label: row.label } : null;
}

/** The band prefix the UI chips show: VL1 -> "VL", H7 -> "H". */
export const bandPrefix = (band: string): string => band.replace(/\d+$/, '');

/** A barangay-level hazard wording shortened for chips, keeping its meaning. */
export function hazardChip(w: string | null): string | null {
  if (!w) return null;
  if (/^not (available|assessed|indicated)/i.test(w)) return null;
  if (/^(high|very high|moderate|low) \(/i.test(w)) return w.slice(0, w.indexOf('(')).trim();
  if (/susceptible/i.test(w) && /pending/i.test(w)) return 'Pending class';
  if (/susceptible/i.test(w)) return 'Susceptible';
  if (/outside mapped/i.test(w)) return 'Outside mapped zone';
  if (/within tsunami-inundation/i.test(w)) return 'Inundation zone';
  if (/very high intensity/i.test(w)) return 'Very high (VIII+)';
  return w.length > 28 ? `${w.slice(0, 26)}…` : w;
}
