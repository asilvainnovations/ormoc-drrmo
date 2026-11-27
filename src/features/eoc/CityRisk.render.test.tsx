import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DdriveCityRisk, DdriveRiskMatrixRow } from '@/types';
import { CityRiskPicture } from './CityRisk';

afterEach(cleanup);
const SEV: [number, number][] = [[0, 10], [11, 25], [26, 50], [51, 75], [76, 100]];
const LIK: [number, number][] = [[0, 2], [2.1, 4], [4.1, 6], [6.1, 8], [8.1, 10]];
const CODES = ['VL1', 'VL2', 'L3', 'L4', 'M5', 'VL2', 'L3', 'L4', 'M5', 'M6', 'L3', 'L4', 'M5', 'M6', 'H7', 'L4', 'M5', 'M6', 'H7', 'H8', 'M5', 'M6', 'H7', 'H8', 'VH9'];
const matrix = SEV.flatMap((s, si) => LIK.map((l, li) => ({ ranking: si * 5 + li + 1, severity_min: s[0], severity_max: s[1], likelihood_min: l[0], likelihood_max: l[1], band: CODES[si * 5 + li]!, label: '' }))) as DdriveRiskMatrixRow[];
const r = (hazard_event: string, likelihood: number, response: string, severity: number, ranking: number, band: string) =>
  ({ hazard_event, hazard_family: 'H', exposure_infrastructure: null, exposure_productive: null, exposure_essential: null, exposure_human: null, vulnerability_rating: 70, response_measures: response, likelihood, severity, evidence_anchor: 'Record', validation_status: 'Desk score', ranking, band, label: '' }) as DdriveCityRisk;

describe('City Risk Matrix', () => {
  it('places each hazard in its QRE cell, not all in the top corner, and explains the rank', () => {
    render(<CityRiskPicture matrix={matrix} risks={[r('Riverine & flash flood', 9, '4-Some measures in place', 50, 15, 'H7'), r('Tsunami', 2, '1-Extremely few measures in place', 10, 1, 'VL1')]} />);
    expect(screen.getByRole('cell', { name: /^H7: .*Riverine/ })).toBeTruthy();
    expect(screen.getByRole('cell', { name: /^VL1: .*Tsunami/ })).toBeTruthy();
    expect(screen.getByText(/\(9 − 4\) × 10 = 50/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tsunami' }));
    expect(screen.getByText(/\(2 − 1\) × 10 = 10/)).toBeTruthy();
  });
});
