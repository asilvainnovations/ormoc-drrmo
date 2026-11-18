import { describe, expect, it } from 'vitest';
import { buildMatrix } from './riskMatrix';
import type { DdriveCityRisk, DdriveRiskMatrixRow } from '@/types';

const m = (s: [number, number], l: [number, number], ranking: number, band: string, label: string): DdriveRiskMatrixRow => ({ severity_min: s[0], severity_max: s[1], likelihood_min: l[0], likelihood_max: l[1], ranking, band, label });
const matrix = [m([0, 10], [0, 5], 1, 'VL1', 'Very Low'), m([0, 10], [5.1, 10], 2, 'L2', 'Low'), m([11, 100], [0, 5], 3, 'L3', 'Low'), m([11, 100], [5.1, 10], 4, 'H4', 'High')];
const risk = (hazard_event: string, likelihood: number, severity: number) => ({ hazard_event, likelihood, severity } as DdriveCityRisk);

describe('risk matrix grid', () => {
  it('puts the highest likelihood on the top row and the highest severity on the right', () => {
    const g = buildMatrix(matrix, []);
    expect(g.likelihood[0]!.min).toBe(5.1);
    expect(g.severity.at(-1)!.min).toBe(11);
    expect(g.cells[0]![1]!.band).toBe('H4');       // top row, right column
    expect(g.cells[1]![0]!.band).toBe('VL1');      // bottom row, left column
  });
  it('places each hazard in the cell its scores fall in', () => {
    const g = buildMatrix(matrix, [risk('Flood', 9, 50), risk('Quake', 3, 20), risk('Drought', 2, 5)]);
    expect(g.cells[0]![1]!.hazards.map((h) => h.hazard_event)).toEqual(['Flood']);
    expect(g.cells[1]![1]!.hazards.map((h) => h.hazard_event)).toEqual(['Quake']);
    expect(g.cells[1]![0]!.hazards.map((h) => h.hazard_event)).toEqual(['Drought']);
  });
});
