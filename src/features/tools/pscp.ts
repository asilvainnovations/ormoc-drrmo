// Public Service Continuity Plan (PSCP) workbench model.
// Basis: CSC Memorandum Circular No. 2, s. 2021 (every agency formulates a PSCP) and the NDRRMC–OCD
// PSCP Guidebook (essential functions, business impact analysis, risk assessment, continuity
// strategies, activation, testing and maintenance), with ISO 22301 terms: maximum tolerable period of
// disruption (MTPD), recovery time objective (RTO) and recovery point objective (RPO).
// IAT links: A3.4 (PSCP prepared), B2.7 (alternate EOC), B7.6 (readiness self-check).

export interface CmtMember { role: string; position: string; alternate: string }
export interface EssentialFunction {
  id: string; name: string; owner: string; priority: 1 | 2 | 3;      // 1 mission-critical, 2 essential, 3 deferrable
  mtpdHours: number | null; rtoHours: number | null; rpoHours: number | null; minStaff: number | null;
  dependencies: string; impact: { life: number; legal: number; service: number; financial: number };
}
export interface RiskItem { id: string; hazard: string; likelihood: number; impact: number; treatment: string }
export interface Succession { position: string; first: string; second: string; third: string }
export interface Delegation { authority: string; delegate: string; conditions: string; limits: string }
export interface VitalRecord { record: string; location: string; backup: string; custodian: string }
export interface Site { kind: 'primary' | 'alternate'; name: string; address: string; readiness: 'hot' | 'warm' | 'cold'; capacity: string; notes: string }
export interface Phase { id: string; name: string; trigger: string; steps: { text: string; done: boolean }[] }
export interface Pscp {
  office: string; scope: string; policy: string; version: string; approvedBy: string; reviewDate: string;
  team: CmtMember[]; functions: EssentialFunction[]; risks: RiskItem[]; sites: Site[];
  succession: Succession[]; delegations: Delegation[]; records: VitalRecord[]; phases: Phase[];
  testing: { lastTest: string; nextTest: string; exerciseType: string; notes: string };
}

const fid = (n: number) => `F${n}`;
const ef = (n: number, name: string, owner: string, priority: 1 | 2 | 3, mtpd: number, rto: number, rpo: number, staff: number, deps: string, life: number, legal: number, service: number): EssentialFunction =>
  ({ id: fid(n), name, owner, priority, mtpdHours: mtpd, rtoHours: rto, rpoHours: rpo, minStaff: staff, dependencies: deps, impact: { life, legal, service, financial: 2 } });

/** A starting draft for the CDRRMO. Every figure is a proposal to validate with the office. */
export function starterPscp(): Pscp {
  return {
    office: 'City Disaster Risk Reduction and Management Office (CDRRMO) and City EOC, Ormoc City',
    scope: 'Essential functions of the CDRRMO and the City EOC during any disruption of people, premises, power, ICT or suppliers, whatever the cause.',
    policy: 'The CDRRMO keeps its mission-essential functions running, or restores them within their recovery time objectives, during and after any disruption, so that warning, coordination and response for the people of Ormoc never stop.',
    version: 'Draft 0.1', approvedBy: '', reviewDate: '',
    team: [
      { role: 'Continuity Management Team Leader', position: 'CDRRMO Head', alternate: 'Operations and Warning Division Chief' },
      { role: 'Operations continuity', position: 'Operations and Warning Division Chief', alternate: 'Senior duty officer' },
      { role: 'Planning and information', position: 'Research and Planning Division Chief', alternate: 'GIS / information officer' },
      { role: 'Logistics, sites and facilities', position: 'Administration and Training Division Chief', alternate: 'Supply officer' },
      { role: 'ICT and communications', position: 'City ICT focal person', alternate: 'Radio operator lead' },
      { role: 'Public information', position: 'Designated PIO', alternate: 'City Information Office focal' },
    ],
    functions: [
      ef(1, '24/7 hazard monitoring and warning dissemination (Operations Center)', 'Operations and Warning', 1, 2, 1, 0.5, 2, 'Power, radio, internet, PAGASA/PHIVOLCS feeds, SMS/ECBS', 5, 4, 5),
      ef(2, 'EOC activation and multi-agency coordination', 'CDRRMO Head / EOC Manager', 1, 4, 2, 1, 6, 'EOC or alternate EOC, radio net, contact directory', 5, 4, 5),
      ef(3, 'Emergency response dispatch (SAR, EMS) and incident command support', 'Operations and Warning', 1, 1, 0.5, 0.5, 4, 'Vehicles, fuel, radios, hotline', 5, 3, 5),
      ef(4, 'Situation reports to RDRRMC 8 / OCD and the City Mayor', 'Research and Planning', 2, 12, 6, 2, 2, 'Internet or radio, report templates, barangay reports', 2, 4, 4),
      ef(5, 'Evacuation and relief coordination with CSWDO and barangays', 'Operations / CSWDO', 1, 6, 3, 2, 4, 'EC list, stock inventory, transport', 5, 3, 5),
      ef(6, 'LDRRMF and QRF disbursement, emergency procurement', 'Administration / City Budget and Accounting', 2, 48, 24, 24, 2, 'Treasury, accounting system, signatories', 3, 5, 3),
      ef(7, 'Records, data and ICT systems (including this platform)', 'Research and Planning / ICT', 2, 24, 8, 4, 1, 'Cloud service, backups, devices', 2, 4, 3),
      ef(8, 'Training, IEC and routine administration', 'Administration and Training', 3, 336, 168, 72, 1, 'Office space, staff', 1, 2, 2),
    ],
    risks: [
      { id: 'R1', hazard: 'Tropical cyclone (wind, storm surge on Ormoc Bay)', likelihood: 5, impact: 5, treatment: '' },
      { id: 'R2', hazard: 'Flash flood (Anilao–Malbasag)', likelihood: 4, impact: 5, treatment: '' },
      { id: 'R3', hazard: 'Earthquake (Philippine Fault, Leyte segment)', likelihood: 3, impact: 5, treatment: '' },
      { id: 'R4', hazard: 'Rain-induced landslide (upland barangays)', likelihood: 4, impact: 3, treatment: '' },
      { id: 'R5', hazard: 'Extended power outage', likelihood: 4, impact: 4, treatment: '' },
      { id: 'R6', hazard: 'ICT or internet failure, cyberattack', likelihood: 3, impact: 4, treatment: '' },
      { id: 'R7', hazard: 'Epidemic or pandemic (staff absence)', likelihood: 2, impact: 4, treatment: '' },
      { id: 'R8', hazard: 'Fire at the CDRRMO / EOC building', likelihood: 2, impact: 5, treatment: '' },
    ],
    sites: [
      { kind: 'primary', name: 'City EOC / CDRRMO Operations Center', address: '', readiness: 'hot', capacity: '', notes: '' },
      { kind: 'alternate', name: 'Alternate EOC (to be designated)', address: '', readiness: 'warm', capacity: '', notes: 'Outside flood, surge, landslide and liquefaction zones (IAT B2.1, B2.7)' },
    ],
    succession: [
      { position: 'CDRRMO Head', first: 'Operations and Warning Division Chief', second: 'Research and Planning Division Chief', third: 'Administration and Training Division Chief' },
      { position: 'EOC Manager', first: '', second: '', third: '' },
    ],
    delegations: [
      { authority: 'Recommend EOC level changes and activate staff call-out', delegate: 'Senior duty officer', conditions: 'CDRRMO Head and EOC Manager unreachable for 30 minutes during a warning', limits: 'Until the Head or Manager resumes' },
      { authority: 'Sign SitReps and requests to RDRRMC 8', delegate: 'Research and Planning Division Chief', conditions: 'Head unavailable', limits: 'Reports only; no fund commitments' },
    ],
    records: [
      { record: 'Contact directory (CDRRMC, agencies, 85 barangays)', location: 'Platform; printed copy at the EOC', backup: 'Printed copy at the alternate EOC; offline copy on duty phones', custodian: 'Operations Center' },
      { record: 'Contingency plans, PSCP, Manual of Operations', location: 'Platform Library', backup: 'Printed set at the alternate EOC', custodian: 'Research and Planning' },
      { record: 'Logbook, SitReps, incident records', location: 'Platform', backup: 'Daily export; paper logbook during outages', custodian: 'Operations Center' },
      { record: 'Financial and procurement records (LDRRMF/QRF)', location: 'Accounting / Treasury', backup: 'Scanned copies in the Vault', custodian: 'Administration' },
    ],
    phases: [
      { id: 'alert', name: 'Alert and notification', trigger: 'A disruption, or a warning that one is likely, affects people, premises, power, ICT or suppliers.', steps: [
        { text: 'Confirm the disruption and its likely duration', done: false }, { text: 'Notify the Continuity Management Team Leader and members', done: false },
        { text: 'Check staff accountability and safety', done: false }, { text: 'Decide whether to activate the PSCP; log the decision and time', done: false }] },
      { id: 'activation', name: 'Activation and relocation', trigger: 'Team Leader activates the PSCP.', steps: [
        { text: 'Notify staff, the City Mayor, partner offices and RDRRMC 8', done: false }, { text: 'Move mission-critical staff to the alternate site if the primary is unusable', done: false },
        { text: 'Bring vital records and kits; confirm communications at the alternate site', done: false }, { text: 'Apply orders of succession and delegations if leaders are unavailable', done: false }] },
      { id: 'operations', name: 'Continuity operations', trigger: 'Alternate arrangements are working.', steps: [
        { text: 'Run functions in priority order; meet each recovery time objective', done: false }, { text: 'Track staffing, fatigue and supplies', done: false },
        { text: 'Report status to the Mayor and RDRRMC 8 on schedule', done: false }] },
      { id: 'reconstitution', name: 'Reconstitution', trigger: 'The primary site and systems are safe and restored.', steps: [
        { text: 'Inspect and certify the primary site safe', done: false }, { text: 'Return staff, records and equipment; restore data to the recovery point', done: false },
        { text: 'Hold an after-action review and update this plan', done: false }] },
    ],
    testing: { lastTest: '', nextTest: '', exerciseType: 'Tabletop, then functional relocation drill to the alternate EOC', notes: '' },
  };
}

export const riskScore = (r: RiskItem) => r.likelihood * r.impact;
export const riskBand = (score: number) => (score >= 15 ? 'High' : score >= 8 ? 'Medium' : 'Low');

/** Problems a reviewer would raise. Empty when the draft is internally consistent. */
export function pscpChecks(p: Pscp): string[] {
  const out: string[] = [];
  for (const f of p.functions) {
    if (f.mtpdHours == null || f.rtoHours == null) out.push(`${f.name}: set both the MTPD and the RTO.`);
    else if (f.rtoHours > f.mtpdHours) out.push(`${f.name}: the RTO (${f.rtoHours} h) is longer than the MTPD (${f.mtpdHours} h). Recovery must come before the disruption becomes intolerable.`);
    if (f.priority === 1 && (f.minStaff ?? 0) < 1) out.push(`${f.name}: a mission-critical function needs a minimum staff number.`);
  }
  if (!p.sites.some((s) => s.kind === 'alternate' && s.address.trim())) out.push('Designate an alternate site with an address (IAT B2.7).');
  for (const s of p.succession) if (!s.first.trim() || !s.second.trim()) out.push(`Orders of succession for ${s.position || 'a position'} need at least two successors.`);
  if (!p.team.every((m) => m.position.trim())) out.push('Every Continuity Management Team role needs a position.');
  for (const r of p.risks) if (riskScore(r) >= 15 && !r.treatment.trim()) out.push(`${r.hazard}: high risk without a treatment.`);
  if (!p.testing.nextTest) out.push('Schedule the next test or exercise.');
  return out;
}

/** The plan as Markdown, for the Library or for printing. */
export function pscpMarkdown(p: Pscp): string {
  const row = (cells: (string | number | null)[]) => `| ${cells.map((c) => String(c ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')).join(' | ')} |`;
  const sorted = [...p.functions].sort((a, b) => a.priority - b.priority || (a.rtoHours ?? 0) - (b.rtoHours ?? 0));
  return [
    `# Public Service Continuity Plan: ${p.office}`, '',
    `${p.version}${p.approvedBy ? `, approved by ${p.approvedBy}` : ', for approval'}${p.reviewDate ? `. Next review ${p.reviewDate}` : ''}.`, '',
    '## 1. Policy and scope', '', p.policy, '', p.scope, '',
    '## 2. Continuity Management Team', '', row(['Role', 'Position', 'Alternate']), row(['---', '---', '---']), ...p.team.map((m) => row([m.role, m.position, m.alternate])), '',
    '## 3. Essential functions and business impact analysis', '',
    'Priority 1 is mission-critical. MTPD is the maximum tolerable period of disruption; RTO the recovery time objective; RPO the recovery point objective (hours).', '',
    row(['Priority', 'Function', 'Owner', 'MTPD', 'RTO', 'RPO', 'Min. staff', 'Dependencies']), row(['---', '---', '---', '---', '---', '---', '---', '---']),
    ...sorted.map((f) => row([f.priority, f.name, f.owner, f.mtpdHours, f.rtoHours, f.rpoHours, f.minStaff, f.dependencies])), '',
    '## 4. Risk assessment', '', row(['Hazard', 'Likelihood', 'Impact', 'Score', 'Level', 'Treatment']), row(['---', '---', '---', '---', '---', '---']),
    ...[...p.risks].sort((a, b) => riskScore(b) - riskScore(a)).map((r) => row([r.hazard, r.likelihood, r.impact, riskScore(r), riskBand(riskScore(r)), r.treatment])), '',
    '## 5. Continuity strategies', '', '### Sites', '', row(['Site', 'Name', 'Address', 'Readiness', 'Capacity', 'Notes']), row(['---', '---', '---', '---', '---', '---']),
    ...p.sites.map((s) => row([s.kind, s.name, s.address, s.readiness, s.capacity, s.notes])), '',
    '### Orders of succession', '', row(['Position', 'First', 'Second', 'Third']), row(['---', '---', '---', '---']), ...p.succession.map((s) => row([s.position, s.first, s.second, s.third])), '',
    '### Delegations of authority', '', row(['Authority', 'Delegate', 'When', 'Limits']), row(['---', '---', '---', '---']), ...p.delegations.map((d) => row([d.authority, d.delegate, d.conditions, d.limits])), '',
    '### Vital records', '', row(['Record', 'Location', 'Backup', 'Custodian']), row(['---', '---', '---', '---']), ...p.records.map((r) => row([r.record, r.location, r.backup, r.custodian])), '',
    '## 6. Activation', '', ...p.phases.flatMap((ph) => [`### ${ph.name}`, '', `Trigger: ${ph.trigger}`, '', ...ph.steps.map((s) => `- ${s.text}`), '']),
    '## 7. Testing and maintenance', '', `Last test: ${p.testing.lastTest || 'none recorded'}. Next test: ${p.testing.nextTest || 'not scheduled'}. Exercise: ${p.testing.exerciseType}.`, '', p.testing.notes, '',
    '_Basis: CSC MC No. 2, s. 2021; NDRRMC–OCD PSCP Guidebook; ISO 22301. Prepared with the Ormoc DRRM platform PSCP workbench._', '',
  ].join('\n');
}
