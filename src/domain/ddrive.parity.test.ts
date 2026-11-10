import { describe, expect, it } from 'vitest';
import { hazardChip, riskBand } from './ddrive';
import type { DdriveRiskMatrixRow } from '@/types';

// The 25-row DDRiVE matrix exactly as seeded from sheet 13 of the workbook (v1.2).
const MATRIX: DdriveRiskMatrixRow[] = [
  { severity_min: 0.1, severity_max: 10, likelihood_min: 0, likelihood_max: 2, ranking: 1, band: 'VL1', label: 'Very Low' },
  { severity_min: 0.1, severity_max: 10, likelihood_min: 2.1, likelihood_max: 4, ranking: 2, band: 'VL2', label: 'Very Low' },
  { severity_min: 0.1, severity_max: 10, likelihood_min: 4.1, likelihood_max: 6, ranking: 3, band: 'L3', label: 'Low' },
  { severity_min: 0.1, severity_max: 10, likelihood_min: 6.1, likelihood_max: 8, ranking: 4, band: 'L4', label: 'Low' },
  { severity_min: 0.1, severity_max: 10, likelihood_min: 8.1, likelihood_max: 10, ranking: 5, band: 'M5', label: 'Moderate' },
  { severity_min: 11, severity_max: 25, likelihood_min: 0, likelihood_max: 2, ranking: 6, band: 'VL2', label: 'Very Low' },
  { severity_min: 11, severity_max: 25, likelihood_min: 2.1, likelihood_max: 4, ranking: 7, band: 'L3', label: 'Low' },
  { severity_min: 11, severity_max: 25, likelihood_min: 4.1, likelihood_max: 6, ranking: 8, band: 'L4', label: 'Low' },
  { severity_min: 11, severity_max: 25, likelihood_min: 6.1, likelihood_max: 8, ranking: 9, band: 'M5', label: 'Moderate' },
  { severity_min: 11, severity_max: 25, likelihood_min: 8.1, likelihood_max: 10, ranking: 10, band: 'M6', label: 'Moderate' },
  { severity_min: 26, severity_max: 50, likelihood_min: 0, likelihood_max: 2, ranking: 11, band: 'L3', label: 'Low' },
  { severity_min: 26, severity_max: 50, likelihood_min: 2.1, likelihood_max: 4, ranking: 12, band: 'L4', label: 'Low' },
  { severity_min: 26, severity_max: 50, likelihood_min: 4.1, likelihood_max: 6, ranking: 13, band: 'M5', label: 'Moderate' },
  { severity_min: 26, severity_max: 50, likelihood_min: 6.1, likelihood_max: 8, ranking: 14, band: 'M6', label: 'Moderate' },
  { severity_min: 26, severity_max: 50, likelihood_min: 8.1, likelihood_max: 10, ranking: 15, band: 'H7', label: 'High' },
  { severity_min: 51, severity_max: 75, likelihood_min: 0, likelihood_max: 2, ranking: 16, band: 'L4', label: 'Low' },
  { severity_min: 51, severity_max: 75, likelihood_min: 2.1, likelihood_max: 4, ranking: 17, band: 'M5', label: 'Moderate' },
  { severity_min: 51, severity_max: 75, likelihood_min: 4.1, likelihood_max: 6, ranking: 18, band: 'M6', label: 'Moderate' },
  { severity_min: 51, severity_max: 75, likelihood_min: 6.1, likelihood_max: 8, ranking: 19, band: 'H7', label: 'High' },
  { severity_min: 51, severity_max: 75, likelihood_min: 8.1, likelihood_max: 10, ranking: 20, band: 'H8', label: 'High' },
  { severity_min: 76, severity_max: 100, likelihood_min: 0, likelihood_max: 2, ranking: 21, band: 'M5', label: 'Moderate' },
  { severity_min: 76, severity_max: 100, likelihood_min: 2.1, likelihood_max: 4, ranking: 22, band: 'M6', label: 'Moderate' },
  { severity_min: 76, severity_max: 100, likelihood_min: 4.1, likelihood_max: 6, ranking: 23, band: 'H7', label: 'High' },
  { severity_min: 76, severity_max: 100, likelihood_min: 6.1, likelihood_max: 8, ranking: 24, band: 'H8', label: 'High' },
  { severity_min: 76, severity_max: 100, likelihood_min: 8.1, likelihood_max: 10, ranking: 25, band: 'VH9', label: 'Very High' },
];

// The ten desk scores from sheet 14 with the band the workbook published for each.
const WORKBOOK_ROWS: [string, number, number, string, number][] = [
  ['Riverine & flash flood', 9, 50, 'H7', 15],
  ['Rain-induced landslide', 7, 40, 'M6', 14],
  ['Storm surge / wave action', 6, 20, 'L4', 8],
  ['Tropical cyclone (severe wind)', 8, 30, 'M6', 14],
  ['Earthquake (ground shaking)', 5, 20, 'L4', 8],
  ['Ground rupture (Philippine Fault)', 4, 20, 'L3', 7],
  ['Liquefaction', 5, 30, 'M5', 13],
  ['Tsunami', 2, 10, 'VL1', 1],
  ['Urban / structural fire (post-disaster)', 6, 20, 'L4', 8],
  ['Epidemic (post-disaster / dengue)', 6, 20, 'L4', 8],
];

describe('DDRiVE risk band — parity with v_ddrive_city_risk and the workbook', () => {
  it('reproduces the published band of every desk score in sheet 14', () => {
    for (const [event, likelihood, severity, band, ranking] of WORKBOOK_ROWS) {
      const got = riskBand(likelihood, severity, MATRIX);
      expect(got, event).not.toBeNull();
      expect(got!.band, event).toBe(band);
      expect(got!.ranking, event).toBe(ranking);
    }
  });

  it('every matrix band resolves for an in-range pair and null outside the matrix', () => {
    for (const m of MATRIX) {
      const mid = riskBand((m.likelihood_min + m.likelihood_max) / 2, (m.severity_min + m.severity_max) / 2, MATRIX);
      expect(mid?.ranking).toBe(m.ranking);
    }
    expect(riskBand(11, 101, MATRIX)).toBeNull();
  });

  it('hazardChip keeps meaning: not-assessed becomes no chip, classes shorten', () => {
    expect(hazardChip('Not assessed')).toBeNull();
    expect(hazardChip('Not indicated (CDRA Table 3)')).toBeNull();
    expect(hazardChip('Susceptible (CDRA Table 3)')).toBe('Susceptible');
    expect(hazardChip('Outside mapped rupture trace')).toBe('Outside mapped zone');
    expect(hazardChip('Within tsunami-inundation zone')).toBe('Inundation zone');
    expect(hazardChip('High (liquefaction-susceptible substrate)')).toBe('High');
  });
});
