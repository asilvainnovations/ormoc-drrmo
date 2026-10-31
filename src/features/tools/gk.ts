// Gawad KALASAG Seal for Local DRRM Councils and Offices (LDRRMCOs): readiness self-check.
//
// What is public about the Seal, and how this tool uses it:
//  - The NDRRMC confers the Seal through the OCD; it is the performance assessment of LGUs under
//    Sections 11 and 12 of RA 10121, and participation in it is an SGLG Disaster Preparedness indicator.
//  - Six criteria, weighted: Structure 25%, Competency 35%, Management Systems 15%,
//    Enabling Policies 5%, Knowledge Management and Advocacy 10%, Partnership and Participation 10%
//    (9, 12, 3, 1, 2 and 2 indicators).
//  - Indicators are rated 0 to 3; the weighted mean gives the adjectival rating:
//    2.50-3.00 Beyond Compliant, 1.50-2.49 Fully Compliant.
// The indicator wording below is this platform's, grounded in RA 10121, JMC 2014-1 and the IAT. It is
// NOT the OCD toolkit text. Use it to prepare; score the official toolkit for the actual submission.
export interface GkIndicator { id: string; text: string; mov: string; iat: string[] }
export interface GkCriterion { id: string; name: string; weight: number; indicators: GkIndicator[] }

export const GK_CRITERIA: GkCriterion[] = [
  { id: 'S', name: 'Structure', weight: 0.25, indicators: [
    { id: 'S1', text: 'CDRRMC organized with the membership required by RA 10121 Sec. 11, including CSO and private-sector representatives', mov: 'EO constituting the CDRRMC; list of members', iat: ['A1.2'] },
    { id: 'S2', text: 'CDRRMC meets at least quarterly, with minutes and resolutions on file', mov: 'Notices, attendance, minutes, resolutions', iat: ['A1.3'] },
    { id: 'S3', text: 'CDRRMO established by ordinance as a regular office', mov: 'Ordinance; organizational chart', iat: ['A1.1'] },
    { id: 'S4', text: 'CDRRMO Head in a permanent plantilla position, filled by a qualified appointee', mov: 'Appointment; plantilla', iat: ['A2.2'] },
    { id: 'S5', text: 'CDRRMO divisions per JMC 2014-1: Administration and Training, Research and Planning, Operations and Warning', mov: 'Organizational chart; office orders', iat: ['A2.1'] },
    { id: 'S6', text: 'Minimum plantilla positions created and filled', mov: 'Plantilla; staffing list', iat: ['A2.3'] },
    { id: 'S7', text: '24/7 Operations Center with a duty roster and handover', mov: 'Roster; logbook; handover forms', iat: ['A2.5', 'B4.3'] },
    { id: 'S8', text: 'Organized, trained and equipped response teams (SAR, EMS) and an ICS roster', mov: 'Team rosters; certificates; equipment inventory', iat: ['A8.1', 'A8.2', 'A8.3'] },
    { id: 'S9', text: 'BDRRMCs organized and functional across the 85 barangays', mov: 'Functionality assessment; support plan', iat: ['A7.3'] },
  ] },
  { id: 'C', name: 'Competency', weight: 0.35, indicators: [
    { id: 'C1', text: 'Local DRRM Plan current and approved by the Sanggunian', mov: 'LDRRMP; SP resolution', iat: ['A3.1'] },
    { id: 'C2', text: 'Annual LDRRMF Investment Plan approved and consistent with the LDRRMP', mov: 'LDRRMFIP; approval', iat: ['A3.5'] },
    { id: 'C3', text: 'Hazard maps and a Climate and Disaster Risk Assessment with exposure data', mov: 'Maps; CDRA report', iat: ['A5.1', 'A5.2'] },
    { id: 'C4', text: 'Hazard-specific contingency plans, tested', mov: 'Contingency plans; exercise reports', iat: ['A3.3'] },
    { id: 'C5', text: 'Public Service Continuity Plan for the CDRRMO and essential City services', mov: 'PSCP; test record', iat: ['A3.4'] },
    { id: 'C6', text: 'Early warning systems operational for priority hazards', mov: 'EWS inventory; test logs', iat: ['A6.1', 'A6.3'] },
    { id: 'C7', text: 'Warning thresholds tied to actions, including pre-emptive evacuation', mov: 'Warning-to-action matrix; evacuation plan', iat: ['A6.2', 'A3.6'] },
    { id: 'C8', text: 'Evacuation centers meet minimum standards; relief stocks prepositioned', mov: 'EC inventory and assessment; stock records', iat: ['A7.4', 'A7.5'] },
    { id: 'C9', text: 'Pre-disaster risk assessment done before forecast hazards, with anticipatory actions', mov: 'PDRA records; AA checklist', iat: ['A8.6', 'A8.8'] },
    { id: 'C10', text: 'Annual training program for City personnel, BDRRMCs, schools and communities', mov: 'Training plan; attendance; certificates', iat: ['A7.1', 'A2.6'] },
    { id: 'C11', text: 'Regular drills and exercises, including EOC activation', mov: 'NSED reports; exercise reports; AARs', iat: ['A7.2', 'B7.3'] },
    { id: 'C12', text: 'Rehabilitation and recovery capacity (PDNA team, recovery framework)', mov: 'PDNA team; recovery plans', iat: ['A9.1', 'A9.2'] },
  ] },
  { id: 'M', name: 'Management Systems', weight: 0.15, indicators: [
    { id: 'M1', text: 'LDRRMF of at least 5%, with the 70/30 split, and use reported and posted', mov: 'Budget; utilization reports; FDP posting', iat: ['A4.1', 'A4.2', 'A10.5'] },
    { id: 'M2', text: 'DRRM information and database system, including disaster history and records', mov: 'Database; incident and SitRep records', iat: ['A5.4', 'A5.7'] },
    { id: 'M3', text: 'Monitoring and evaluation of the LDRRMP, and regular reporting to OCD and DILG', mov: 'M&E report; submitted reports', iat: ['A10.4', 'A10.3'] },
  ] },
  { id: 'P', name: 'Enabling Policies', weight: 0.05, indicators: [
    { id: 'P1', text: 'DRRM-related policies recommended by the CDRRMC and enacted (for example evacuation, zoning, no-build zones)', mov: 'Ordinances; EOs; CDRRMC resolutions', iat: ['A1.5'] },
  ] },
  { id: 'K', name: 'Knowledge Management and Advocacy', weight: 0.1, indicators: [
    { id: 'K1', text: 'Public information and education on hazards and preparedness, in the local language', mov: 'IEC plan; materials; reach data', iat: ['A6.6', 'A6.4'] },
    { id: 'K2', text: 'Lessons documented and used: after-action reviews and knowledge products', mov: 'AARs; improvement plans; publications', iat: ['A10.6', 'B7.4'] },
  ] },
  { id: 'R', name: 'Partnership and Participation', weight: 0.1, indicators: [
    { id: 'R1', text: 'Mutual aid and partnership agreements with LGUs, CSOs, the private sector and academe', mov: 'MOAs; MOUs', iat: ['A10.1', 'A10.2'] },
    { id: 'R2', text: 'Volunteers and communities take part, including vulnerable groups', mov: 'Volunteer registry; inclusive plans', iat: ['A2.8', 'A7.6'] },
  ] },
];

export const GK_RATING = [
  { value: 0, label: '0 None', detail: 'Not in place' },
  { value: 1, label: '1 Partial', detail: 'Started, incomplete or not approved' },
  { value: 2, label: '2 Compliant', detail: 'Meets the requirement, with means of verification' },
  { value: 3, label: '3 Beyond', detail: 'Exceeds it: tested, improved, innovative' },
] as const;

export type GkScores = Record<string, number | null>;

/** Criterion averages, the weighted mean over criteria with at least one rated indicator, and the band. */
export function gkResult(scores: GkScores) {
  const perCriterion = GK_CRITERIA.map((c) => {
    const vals = c.indicators.map((i) => scores[i.id]).filter((v): v is number => typeof v === 'number');
    return { id: c.id, name: c.name, weight: c.weight, rated: vals.length, total: c.indicators.length, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
  const scored = perCriterion.filter((c) => c.mean !== null);
  const w = scored.reduce((a, c) => a + c.weight, 0);
  const mean = w ? scored.reduce((a, c) => a + c.weight * (c.mean as number), 0) / w : null;
  const complete = perCriterion.every((c) => c.rated === c.total);
  return { perCriterion, mean, complete, band: gkBand(mean) };
}

export function gkBand(mean: number | null): 'Beyond Compliant' | 'Fully Compliant' | 'Below Fully Compliant' | null {
  if (mean === null) return null;
  const m = Math.round(mean * 100) / 100;      // ratings are reported to two decimals
  return m >= 2.5 ? 'Beyond Compliant' : m >= 1.5 ? 'Fully Compliant' : 'Below Fully Compliant';
}

/**
 * Suggest a 0-3 rating from IAT scores (0-4): IAT 0 -> 0; 1-2 (initial, developing) -> 1;
 * 3 (compliant, approved and in use) -> 2; 4 (tested and improved) -> 3. Several IAT indicators
 * are averaged, then rounded down, so the suggestion never overstates.
 */
export function suggestFromIat(iatScores: (number | null | undefined)[]): number | null {
  const map = (s: number): number => (s <= 0 ? 0 : s <= 2 ? 1 : s === 3 ? 2 : 3);
  const vals = iatScores.filter((s): s is number => typeof s === 'number').map(map);
  if (!vals.length) return null;
  return Math.floor(vals.reduce((a, b) => a + b, 0) / vals.length);
}
