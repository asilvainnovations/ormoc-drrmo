// The DDRiVE city risk picture as a grid: severity across, likelihood up, each hazard placed in the cell its
// scores fall in. The band of every cell comes from the ddrive_risk_matrix table, never from this file.
import type { DdriveCityRisk, DdriveRiskMatrixRow } from '@/types';

export interface MatrixBand { min: number; max: number }
export interface MatrixCell { band: string; label: string; ranking: number; hazards: DdriveCityRisk[] }
export interface MatrixGrid { severity: MatrixBand[]; likelihood: MatrixBand[]; cells: MatrixCell[][] }

const uniq = (bands: MatrixBand[]) => [...new Map(bands.map((b) => [`${b.min}-${b.max}`, b])).values()].sort((a, b) => a.min - b.min);

/** rows run from the highest likelihood (top) to the lowest; columns from the lowest severity (left) to the highest. */
export function buildMatrix(matrix: DdriveRiskMatrixRow[], risks: DdriveCityRisk[]): MatrixGrid {
  const severity = uniq(matrix.map((m) => ({ min: m.severity_min, max: m.severity_max })));
  const likelihood = uniq(matrix.map((m) => ({ min: m.likelihood_min, max: m.likelihood_max }))).reverse();
  const cells = likelihood.map((l) => severity.map((s) => {
    const m = matrix.find((x) => x.severity_min === s.min && x.likelihood_min === l.min);
    return {
      band: m?.band ?? '', label: m?.label ?? '', ranking: m?.ranking ?? 0,
      hazards: risks.filter((r) => r.severity >= s.min && r.severity <= s.max && r.likelihood >= l.min && r.likelihood <= l.max),
    };
  }));
  return { severity, likelihood, cells };
}
