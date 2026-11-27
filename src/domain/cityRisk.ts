// City risk picture (1.35.0): the UNDRR Quick Risk Estimation (QRE) matrix as the City configured it, an explanation of
// each hazard's rank computed from its own figures, and the integrated risk register.
//
// Source: Ormoc City Barangay-Level Hazards Assessment (DDRiVE workbook, 9 Nov 2026), sheets 12_QRE_Assumptions,
// 13_QRE_Risk_Matrix and 14_QRE_Scoring. Method as written there:
//   severity = (likelihood − response measures) × 10, negative values clamp to the lowest band;
//   total vulnerability = mean of the four exposure ratings × 100/10 (reported beside the rank, not inside it);
//   rank = the cell of the 5×5 matrix where the severity band meets the likelihood band (VL1 … VH9).
// Desk scores, pending the QRE workshop. Decision support, never a trigger.
import type { ContingencyPlan, DdriveBarangayProfile, DdriveCityRisk, DdriveFlood, DdriveHazards, DdriveRiskMatrixRow } from '@/types';
import { hazardChip } from './ddrive';

export type Band = [min: number, max: number];
/** Distinct bands from the matrix rows, in order (likelihood low → high, severity low → high). */
export function bandsOf(matrix: DdriveRiskMatrixRow[]): { likelihood: Band[]; severity: Band[] } {
  const uniq = (xs: Band[]) => [...new Map(xs.map((b) => [`${b[0]}-${b[1]}`, b])).values()].sort((a, b) => a[0] - b[0]);
  return {
    likelihood: uniq(matrix.map((m) => [m.likelihood_min, m.likelihood_max])),
    severity: uniq(matrix.map((m) => [m.severity_min, m.severity_max])),
  };
}
/** Band index (0-based) for a value: the first band whose upper bound it does not exceed. */
export const bandIndex = (bands: Band[], v: number) => {
  const i = bands.findIndex((b) => v <= b[1]);
  return i === -1 ? bands.length - 1 : i;
};
export const cellOf = (matrix: DdriveRiskMatrixRow[], li: number, si: number) => {
  const { likelihood, severity } = bandsOf(matrix);
  const L = likelihood[li], S = severity[si];
  return L && S ? matrix.find((m) => m.likelihood_min === L[0] && m.severity_min === S[0]) ?? null : null;
};

/** QRE class from the band code: VL1–VL2 Very low, L3–L4 Low, M5–M6 Moderate, H7–H8 High, VH9 Very high. */
export type RiskClass = 'VL' | 'L' | 'M' | 'H' | 'VH';
export const riskClass = (band: string): RiskClass => (band.replace(/\d+$/, '') as RiskClass);
export const CLASS_LABEL: Record<RiskClass, string> = { VL: 'Very low', L: 'Low', M: 'Moderate', H: 'High', VH: 'Very high' };

/** "4-Some measures in place" → 4. Null when the wording carries no number. */
export const ratingOf = (label: string | null | undefined) => {
  const m = label?.match(/^\s*(\d+)/);
  return m ? Number(m[1]) : null;
};

export interface Explanation {
  likelihood: number; response: number | null; severity: number; computedSeverity: number | null;
  vulnerability: number | null; exposures: { label: string; rating: number | null }[];
  band: string; ranking: number; cls: RiskClass; steps: string[]; consistent: boolean;
}
const MAX_SCORE = 10;
export function explain(r: DdriveCityRisk, matrix: DdriveRiskMatrixRow[]): Explanation {
  const response = ratingOf(r.response_measures);
  const computedSeverity = response == null ? null : Math.max(0, (r.likelihood - response) * MAX_SCORE);
  const { likelihood, severity } = bandsOf(matrix);
  const L = likelihood[bandIndex(likelihood, r.likelihood)];
  const S = severity[bandIndex(severity, Math.max(r.severity, severity[0]?.[0] ?? 0))];
  const exposures = [
    { label: 'Infrastructure', rating: ratingOf(r.exposure_infrastructure) },
    { label: 'Productive sectors', rating: ratingOf(r.exposure_productive) },
    { label: 'Essential services', rating: ratingOf(r.exposure_essential) },
    { label: 'People and social', rating: ratingOf(r.exposure_human) },
  ];
  const cls = riskClass(r.band);
  const steps = [
    `Likelihood ${r.likelihood} of 10, from the City's disaster record 1991–2022.`,
    response == null ? `Response measures: ${r.response_measures ?? 'not rated'}.`
      : `Response measures ${response} of 10 (${(r.response_measures ?? '').replace(/^\d+-/, '').toLowerCase()}).`,
    response == null ? `Severity ${r.severity}, as scored.`
      : `Severity = (${r.likelihood} − ${response}) × 10 = ${computedSeverity}: the part of the likelihood that the City's measures do not yet cover.`,
    `Severity ${r.severity} falls in the ${S?.[0] ?? '?'}–${S?.[1] ?? '?'} band and likelihood ${r.likelihood} in the ${L?.[0] ?? '?'}–${L?.[1] ?? '?'} band: cell ${r.ranking} of 25, ${r.band} (${CLASS_LABEL[cls].toLowerCase()}).`,
  ];
  return {
    likelihood: r.likelihood, response, severity: r.severity, computedSeverity, vulnerability: r.vulnerability_rating, exposures,
    band: r.band, ranking: r.ranking, cls, steps, consistent: computedSeverity == null || computedSeverity === r.severity,
  };
}

/** What lowers the rank, in the method's own terms: more response measures, or fewer events. */
export function whatLowersIt(r: DdriveCityRisk): string {
  const response = ratingOf(r.response_measures);
  if (response == null) return 'Rate the response measures in the QRE workshop to see what lowers it.';
  if (response >= r.likelihood) return 'Response measures already match the likelihood; keep them in place and tested.';
  const up = Math.min(10, response + 1);
  return `Each step up in response measures lowers severity by 10: at ${up} of 10, severity would be ${Math.max(0, (r.likelihood - up) * MAX_SCORE)}.`;
}

// ------------------------------------------------------------------ integrated register
/** How each scored hazard links to the barangay layers, contingency plans and the Ten-Year Plan's damages. */
interface Link { key: RegExp; hazards: string[]; plans?: string[]; barangay?: 'flood' | keyof DdriveHazards | 'citywide'; damages?: string; trigger?: string }
const LINKS: Link[] = [
  { key: /flood/i, hazards: ['flood', 'flash_flood', 'tropical_cyclone'], barangay: 'flood', damages: 'Flood', trigger: 'Heavy rain or a tropical cyclone' },
  { key: /rain-induced landslide/i, hazards: ['rain_landslide'], barangay: 'rain_landslide', damages: 'Rain-induced landslides', trigger: 'Prolonged or intense rain' },
  { key: /storm surge/i, hazards: ['storm_surge'], barangay: 'storm_surge', damages: 'Storm surge', trigger: 'A tropical cyclone' },
  { key: /tropical cyclone/i, hazards: ['tropical_cyclone'], barangay: 'citywide' },
  { key: /ground shaking/i, hazards: ['earthquake'], barangay: 'citywide' },
  { key: /ground rupture/i, hazards: ['earthquake'], barangay: 'ground_rupture' },
  { key: /liquefaction/i, hazards: ['earthquake'], barangay: 'liquefaction', damages: 'Liquefaction', trigger: 'An earthquake' },
  { key: /tsunami/i, hazards: ['tsunami'], barangay: 'tsunami', damages: 'Tsunami', trigger: 'An offshore earthquake' },
  { key: /fire/i, hazards: [], trigger: 'Often follows an earthquake' },
  { key: /epidemic/i, hazards: [], plans: ['CP-DISEASE'], trigger: 'Often follows a typhoon or flood, in evacuation centres' },
];
const POSITIVE = new Set(['Susceptible', 'Inundation zone', 'High', 'Very high', 'Moderate', 'Very high (VIII+)']);

export interface RegisterEntry {
  risk: DdriveCityRisk; explanation: Explanation; lowers: string;
  plans: ContingencyPlan[]; damagesBn: number | null; trigger: string | null;
  barangays: { flagged: number; notAssessed: number; population: number | null; names: string[]; citywide: boolean } | null;
}
export function buildRegister(
  risks: DdriveCityRisk[], matrix: DdriveRiskMatrixRow[], plans: ContingencyPlan[],
  profiles: DdriveBarangayProfile[], hazards: DdriveHazards[], floods: DdriveFlood[], damages: { hazard: string; billion: number }[],
): RegisterEntry[] {
  const hz = new Map(hazards.map((h) => [h.psgc, h]));
  const fl = new Map(floods.map((f) => [f.psgc, f]));
  return [...risks].sort((a, b) => b.ranking - a.ranking || b.severity - a.severity).map((risk) => {
    const link = LINKS.find((l) => l.key.test(risk.hazard_event));
    const linkedPlans = plans.filter((p) => link && ((link.plans ?? []).includes(p.code)
      || (p.hazard_codes?.length ? p.hazard_codes : [p.hazard_code]).some((c) => c && link.hazards.includes(c))));
    let barangays: RegisterEntry['barangays'] = null;
    if (link?.barangay === 'citywide') barangays = { flagged: profiles.length, notAssessed: 0, population: sum(profiles.map((p) => p.population_2024)), names: [], citywide: true };
    else if (link?.barangay) {
      const col = link.barangay;
      const chip = (p: DdriveBarangayProfile) => col === 'flood' ? hazardChip(fl.get(p.psgc)?.susceptibility_class ?? null) : hazardChip((hz.get(p.psgc)?.[col] as string | null) ?? null);
      const flagged = profiles.filter((p) => { const c = chip(p); return !!c && POSITIVE.has(c); });
      barangays = {
        flagged: flagged.length, notAssessed: profiles.filter((p) => !chip(p) || chip(p) === 'Pending class').length,
        population: sum(flagged.map((p) => p.population_2024)), names: flagged.map((p) => p.name).sort(), citywide: false,
      };
    }
    return {
      risk, explanation: explain(risk, matrix), lowers: whatLowersIt(risk), plans: linkedPlans,
      damagesBn: link?.damages ? damages.find((d) => d.hazard === link.damages)?.billion ?? null : null,
      trigger: link?.trigger ?? null, barangays,
    };
  });
}
const sum = (xs: (number | null)[]) => (xs.some((x) => x == null) && xs.every((x) => x == null) ? null : xs.reduce<number>((a, x) => a + (x ?? 0), 0));
