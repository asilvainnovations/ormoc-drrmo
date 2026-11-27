/** Contingency plan templates (1.33.0), following the NDRRMC-OCD Contingency Planning Guidebook (as of February 2020).
 *
 *  One workbook per plan, a sheet per CP Form: Forms 1, 2, 3A or 3B, 4A, 4B, 5, then 6, 7 and 8 for every cluster the plan
 *  seats (Guidebook p. 19: "All Response Clusters specified in CP Form 5 will have the corresponding CP Form 6"), 9, 10, 11,
 *  Chapter IV (activation, deactivation, non-activation) and an annex on families staying together and the CCCM anchors.
 *  Column headings are the Guidebook's blank-form wording. Values the Guidebook computes are formulas: the Form 1 average
 *  and rank, the Form 4A/4B totals, the Form 8 gap (need minus have, never below zero) and all of Form 9.
 *
 *  MODE fills only what it holds: the plan's hazards and activation set, the clusters and their lead offices, the EOC
 *  point and roster designees, the barangays by CSWD district and the City evacuation centres. Ratings, scenarios,
 *  populations, resources and costs are left blank for the planners: MODE never invents them. Counts only; no names of
 *  affected persons (RA 10173). The plan is approved by the CDRRMC Chairperson as a living document (Guidebook p. 27). */
import type { XlsxCell, XlsxSheet } from '@/lib/xlsx';
import type {
  Barangay, ContingencyPlan, CpActivationItem, EocDesignation, EocPosition, EvacuationCentre, GeoReferencePoint, Hazard, Office, ResponseCluster,
} from '@/types';
import { FAMILY_UNITY_RULES } from './echo';
import { MODULE_HEADING, MODULE_ORDER } from './scenarios';

export interface CpInput {
  plan: ContingencyPlan;
  hazards: Hazard[];
  items: CpActivationItem[];          // this plan's activation items
  clusters: ResponseCluster[];
  offices: Office[];
  positions: EocPosition[];
  designations: EocDesignation[];
  eocPoint: GeoReferencePoint | null;
  barangays: Barangay[];
  centres: EvacuationCentre[];
  districts: { code: string; coordinatorTitle: string; barangays: readonly string[] }[];
  today: string;
}

/** Human-induced hazards use CP Form 3B (Most likely / Best / Worst); natural hazards use 3A (Bad / Worse / Worst). */
export const HUMAN_INDUCED = new Set(['industrial']);
export const usesForm3B = (p: Pick<ContingencyPlan, 'hazard_code'>) => HUMAN_INDUCED.has(p.hazard_code ?? '');

const SOURCE = 'NDRRMC-OCD Contingency Planning Guidebook (Feb 2020)';
const PRIVACY = 'Counts only. No names of affected persons, evacuees, patients or informants (RA 10173).';
/** Rows left for the planners to fill in each table. */
export const BLANK_ROWS = 8;

/** Excel column letter, 0 → A. Up to 26 columns (the writer's limit). */
const col = (i: number) => String.fromCharCode(65 + i);
const quote = (name: string) => `'${name.replace(/'/g, "''")}'`;

function header(title: string, plan: ContingencyPlan, form: string, page: string): XlsxCell[][] {
  return [[`${form}: ${title}`], [`${plan.code} · ${plan.title}`], [`${SOURCE}, ${page}. Proposed draft for the CDRRMC; edit freely.`], []];
}

/** The clusters the plan seats (lead, on or standby), in the clusters' order. */
export function planClusters(i: Pick<CpInput, 'items' | 'clusters'>): { cluster: ResponseCluster; state: CpActivationItem['state']; note: string | null }[] {
  return i.items.filter((x) => x.item_kind === 'cluster')
    .map((x) => ({ cluster: i.clusters.find((c) => c.code === x.item_code), state: x.state, note: x.note }))
    .filter((x): x is { cluster: ResponseCluster; state: CpActivationItem['state']; note: string | null } => !!x.cluster)
    .sort((a, b) => a.cluster.sort - b.cluster.sort);
}

/** Sheet names for a cluster's Forms 6, 7 and 8. */
export const clusterSheet = (form: 6 | 7 | 8, code: string) => `CP Form ${form} ${code}`;

/** Timeframe rows for Form 6: "D" is the hazard's occurrence; minutes or hours for short-lead hazards (Guidebook p. 44). */
export function timeframes(p: Pick<ContingencyPlan, 'hazard_code'>): string[] {
  const short = ['flash_flood', 'earthquake', 'tsunami', 'industrial', 'rain_landslide'].includes(p.hazard_code ?? '');
  return short ? ['D-6 hours', 'D-3 hours', 'D-1 hour', 'D', 'D+6 hours', 'D+1 day', 'D+3 days']
    : ['D-3 days', 'D-2 days', 'D-1 day', 'D', 'D+1 day', 'D+3 days', 'D+7 days'];
}

/** Proposed response activities that keep families together, by cluster and timeframe index. Edit or delete them. */
const FAMILY_ACTIVITIES: Record<string, [number, string, string][]> = {
  SRR: [[3, 'Evacuate and rescue families together; every child with a responsible adult; persons with disability and older persons with their carer (RA 10821 Sec. 4(d)).', 'CDRRMO rescue team, BFP, PNP']],
  CCCM: [
    [1, 'Prepare family bays in the open centres by CSWD district (household size × 3.5 m²); accessible ground-level bays for persons with disability and older persons with their carer.', 'CSWDO District Camp Coordinators'],
    [3, 'Register arrivals by family (DAFAC); one family, one bay; record the responsible adult of every child; separated children stay with their relative; refer unaccompanied children to the CSWDO.', 'CSWDO, Camp Management Team'],
    [4, 'When a centre is full, move whole families together to the next centre in the district and record where each went.', 'CSWDO, CDRRMO'],
  ],
  PROT: [[4, 'Run family tracing and reunification; no transfer of a child out of the camp without a social worker’s best-interest assessment (RA 10821 Sec. 6, 12).', 'CSWDO, WCPD']],
};

export function buildCpWorkbook(i: CpInput): XlsxSheet[] {
  const { plan } = i;
  const sheets: XlsxSheet[] = [];
  const cls = planClusters(i);
  const officeName = (id: string | null) => i.offices.find((o) => o.id === id)?.name ?? '';
  const hazardName = (code: string) => i.hazards.find((h) => h.code === code)?.name ?? code;
  const covers = [...new Set([plan.hazard_code, ...(plan.hazard_codes ?? [])].filter((x): x is string => !!x))];

  // ---------------------------------------------------------------- Guide
  sheets.push({ name: 'Guide', widths: [34, 100], rows: [
    [`Contingency plan template: ${plan.title}`], [`${plan.code}. Status in MODE: ${plan.status.replace('_', ' ')}${plan.adopted_ref ? ` (${plan.adopted_ref})` : ''}.`],
    [`Built ${i.today} from MODE, following the ${SOURCE}. Proposed draft for the CDRRMC; MODE never fills ratings, populations, resources or costs.`], [],
    ['Chapter / section', 'What to write, and the forms (Guidebook pages)'],
    ['I.A Introduction', 'Profile of the City: history, ecological profile, maps, disaggregated data, past disasters, CLUP, CDRA and the DRRM 10-Year Plan (p. 17).'],
    ['I.B Hazard analysis', 'CP Form 1 and a narrative (p. 17). One plan per hazard; secondary hazards go in the same plan (p. 12).'],
    ['I.C Hazard to plan for', `CP Form 2 (p. 17). This plan covers: ${covers.map(hazardName).join(', ') || 'to be set'}.`],
    ['I.D Scenario', `CP Form ${usesForm3B(plan) ? '3B' : '3A'} and CP Forms 4A and 4B, planned for the worst case (p. 18).`],
    ['II Goal and objectives', 'The end state, and SMARTER objectives: specific, measurable, attainable, realistic, time bound, extending, rewarding (p. 18).'],
    ['III.A Response clusters', 'CP Form 5; for each cluster an implementation plan with lead and members, scenario, objectives, roles, and CP Forms 6, 7 and 8; then CP Form 9 (pp. 19–20).'],
    ['III.B Emergency Operations Center', 'CP Form 10. The EOC must be free from exposure to the hazard’s projected impacts (p. 20).'],
    ['III.C Incident Command System', 'CP Form 11. ICS facilities free from worst-case exposure (p. 21).'],
    ['III.D Interoperability', 'A diagram of how the EOC, the IMT and the clusters work together (p. 22). The EOC and the incident command post are not co-located (NDRRMC Memorandum No. 131, s. 2018).'],
    ['IV Activation, deactivation, non-activation', 'Sheet "Chapter IV": triggers, the EOC modules and clusters this plan seats, and who decides (pp. 23–25).'],
    ['Annexes', 'Working Group (head, facilitator, secretariat, cluster representatives), maps, directory, policies (p. 26). Sheet "Annex Families": families stay together and the CCCM anchors.'],
    ['Approval', 'The Working Group endorses; the CDRRMC Chairperson approves by formal issuance, as a living document (p. 27). Gawad KALASAG counts plans approved by the CDRRMC and adopted by the Sangguniang Panlungsod within the last three years.'],
    ['Testing and updating', 'Test, evaluate and update continuously; the Working Group head leads exercises (pp. 26–27).'],
    [], ['Privacy', PRIVACY],
  ] });

  // ---------------------------------------------------------------- Form 1
  const f1Start = 6; const hz = [...i.hazards].sort((a, b) => a.sort - b.sort);
  const f1End = f1Start + hz.length - 1;
  sheets.push({ name: 'CP Form 1', widths: [34, 12, 28, 12, 28, 12, 8], rows: [
    ...header('Hazard Analysis', plan, 'CP Form 1', 'pp. 28–30'),
    ['HAZARD', 'PROBABILITY RATE', 'PROBABILITY REMARKS', 'IMPACT RATE', 'IMPACT REMARKS', 'AVERAGE (PROBABILITY + IMPACT ÷ 2)', 'RANK'],
    ...hz.map((h, k): XlsxCell[] => {
      const r = f1Start + k;
      return [h.name, null, null, null, null, { f: `IF(AND(ISNUMBER(B${r}),ISNUMBER(D${r})),(B${r}+D${r})/2,"")` },
        { f: `IF(ISNUMBER(F${r}),RANK(F${r},$F$${f1Start}:$F$${f1End}),"")` }];
    }),
    [], ['Rate by consensus of planners and experts, from historical data, hazard maps and REDAS. Rank 1 is the hazard to plan for. The scales are examples (p. 29).'],
    ['Probability: 1 Most unlikely, 2 Unlikely, 3 Likely, 4 Very likely, 5 Almost certain.'],
    ['Impact: 1 Negligible, 2 Minor, 3 Moderate, 4 Severe, 5 Devastating (casualties, damage, delay, as on p. 29).'],
  ] });

  // ---------------------------------------------------------------- Form 2
  sheets.push({ name: 'CP Form 2', widths: [36, 36, 36, 36], rows: [
    ...header('Anatomy of the Hazard', plan, 'CP Form 2', 'pp. 31–32'),
    ['HAZARD TO PLAN FOR', covers.map(hazardName).join(', ') || null],
    ['ROOT CAUSES', 'EARLY WARNING SIGNS', 'TRIGGERING FACTORS', 'EXISTING MITIGATING MEASURES'],
    ...Array.from({ length: BLANK_ROWS }, () => [null, null, null, null]),
    [], ['Use the hazard and risk maps and consult PAGASA, PHIVOLCS and MGB. Quote official warning products as issued; MODE sets no thresholds.'],
  ] });

  // ---------------------------------------------------------------- Form 3A / 3B
  const s3 = usesForm3B(plan);
  const particulars = ['General Description of Event', 'No. of Affected Individuals', 'No. of Dead', 'No. of Injured', 'No. of Missing',
    'EFFECTS: Communication', 'EFFECTS: Power/ Electricity', 'EFFECTS: Transportation', 'EFFECTS: Environment', 'EFFECTS: Response Capabilities',
    'EFFECTS: Government Trust', 'EFFECTS: Housing and evacuation (families displaced)', 'Others', 'Others'];
  sheets.push({ name: s3 ? 'CP Form 3B' : 'CP Form 3A', widths: [44, 34, 34, 34], rows: [
    ...header(s3 ? 'Scenario Generation for Human-Induced Hazard' : 'Scenario Generation for Natural Hazard', plan, s3 ? 'CP Form 3B' : 'CP Form 3A', 'pp. 33–37'),
    s3 ? ['PARTICULARS (CAN BE CUSTOMIZED)', 'MOST LIKELY (NORMAL ACTIVITIES)', 'BEST (WITH COUNTER-MEASURES)', 'WORST']
      : ['PARTICULARS (CAN BE CUSTOMIZED)', 'BAD', 'WORSE', 'WORST'],
    ...particulars.map((p) => [p, null, null, null]),
    [], ['The plan is written for the WORST case (p. 18). Fill only the rows the planners agree on (p. 35).'],
  ] });

  // ---------------------------------------------------------------- Forms 4A and 4B: barangays by CSWD district
  const districtOf = (b: Barangay) => b.district_id ?? null;
  const brgys = [...i.barangays].sort((a, b) => (districtOf(a) ?? 9) - (districtOf(b) ?? 9) || a.name.localeCompare(b.name));
  const area = (b: Barangay) => `${b.name}${districtOf(b) ? ` (CSWD District ${districtOf(b)})` : ''}`;
  const f4Start = 6; const f4End = f4Start + Math.max(brgys.length, 1) - 1;
  const sumRow = (label: string, from: number, to: number, cols: number, skip: number[] = []): XlsxCell[] =>
    [label, ...Array.from({ length: cols }, (_, k) => (skip.includes(k + 1) ? null : { f: `SUM(${col(k + 1)}${from}:${col(k + 1)}${to})` }))];
  sheets.push({ name: 'CP Form 4A', widths: [40, 18, 22, 22, 36], rows: [
    ...header('Affected Population', plan, 'CP Form 4A', 'pp. 38–39'),
    ['AREA/ LOCATION', 'NO. OF INDIVIDUALS AFFECTED', 'INSIDE EVACUATION CENTERS', 'OUTSIDE EVACUATION CENTERS', 'REASONS FOR DISPLACEMENT'],
    ...(brgys.length ? brgys.map((b) => [area(b), null, null, null, null]) : [['Barangays not loaded on this device', null, null, null, null]]),
    sumRow('TOTAL', f4Start, f4End, 4, [4]),
    [], ['Worst case. Outside evacuation centres: displaced families staying with relatives or host families (p. 39). Families are counted together.'],
  ] });
  const b4 = ['AREA/ LOCATION', 'AFFECTED M', 'AFFECTED F', 'INFANT 0-11 MO M', 'INFANT 0-11 MO F', 'CHILDREN 17 & BELOW M', 'CHILDREN 17 & BELOW F',
    'ADULT 18-59 M', 'ADULT 18-59 F', 'ELDERLY 60 & ABOVE M', 'ELDERLY 60 & ABOVE F', 'PWD M', 'PWD F', 'WITH SICKNESS M', 'WITH SICKNESS F', 'PREGNANT WOMAN', 'OTHERS'];
  sheets.push({ name: 'CP Form 4B', widths: [40, ...Array.from({ length: 16 }, () => 11)], rows: [
    ...header('Breakdown of Affected Population (optional)', plan, 'CP Form 4B', 'pp. 40–41'),
    b4,
    ...(brgys.length ? brgys.map((b) => [area(b), ...Array.from({ length: 16 }, () => null)]) : [['Barangays not loaded on this device', ...Array.from({ length: 16 }, () => null)]]),
    sumRow('TOTAL', f4Start, f4End, 16),
    [], ['Fill only when appropriate; estimates or percentages where data are missing (p. 41). The groups overlap: they need not add up to the total.'],
  ] });

  // ---------------------------------------------------------------- Form 5
  sheets.push({ name: 'CP Form 5', widths: [40, 30, 40, 14, 60], rows: [
    ...header('Cluster Identification', plan, 'CP Form 5', 'pp. 42–43'),
    ['RESPONSE CLUSTER', 'LEAD AGENCY/ OFFICE', 'MEMBER AGENCIES/ OFFICES', 'IN THIS PLAN', 'NOTE'],
    ...cls.map((c) => [c.cluster.name, officeName(c.cluster.lead_office_id) || c.cluster.national_lead || null, null,
      c.state === 'lead' ? 'Lead' : c.state === 'on' ? 'Activated' : 'On standby', c.note]),
    [], ['The clusters are the ones this plan seats in MODE; the City may organise its own clusters (p. 19). Add a Form 6, 7 and 8 for each.'],
  ] });

  // ---------------------------------------------------------------- Forms 6, 7, 8 per cluster
  const tf = timeframes(plan);
  const f8Start = 7; const f8End = f8Start + BLANK_ROWS - 1; const f8Total = f8End + 1;
  for (const c of cls) {
    const acts = FAMILY_ACTIVITIES[c.cluster.code] ?? [];
    sheets.push({ name: clusterSheet(6, c.cluster.code), widths: [16, 80, 36], rows: [
      ...header('Response Activities', plan, 'CP Form 6', 'pp. 44–45'),
      ['RESPONSE CLUSTER', c.cluster.name],
      ['TIMEFRAME', 'RESPONSE ACTIVITIES', 'RESPONSIBLE AGENCIES/ OFFICES'],
      ...tf.map((t, k) => { const a = acts.find(([idx]) => idx === k); return [t, a ? a[1] : null, a ? a[2] : null]; }),
      [], ['D is the hazard’s occurrence; D-N before, D+N after (p. 44). Activities prefilled for families staying together are proposals: edit or delete.'],
    ] });
    sheets.push({ name: clusterSheet(7, c.cluster.code), widths: [30, 36, 12, 40], rows: [
      ...header('Resource Inventory', plan, 'CP Form 7', 'pp. 46–47'),
      ['RESPONSE CLUSTER', c.cluster.name],
      ['AGENCY/ OFFICE', 'RESOURCE', 'QUANTITY', 'REMARKS'],
      ...Array.from({ length: BLANK_ROWS }, () => [null, null, null, null]),
      [], ['Personnel, teams, vehicles and major equipment only; no small tools or office supplies (p. 47). EOC → Resources holds the City inventory.'],
    ] });
    sheets.push({ name: clusterSheet(8, c.cluster.code), widths: [30, 10, 10, 12, 36, 18, 22], rows: [
      ...header('Resource Projection', plan, 'CP Form 8', 'pp. 48–49'),
      ['RESPONSE CLUSTER', c.cluster.name],
      ['RESOURCE', 'NEED', 'HAVE', 'GAPS (NEED – HAVE)', 'ACTIVITIES/ SOURCES TO FILL THE GAPS', 'COST ESTIMATES', 'SOURCE OF FUNDS'],
      ...Array.from({ length: BLANK_ROWS }, (_, k): XlsxCell[] => {
        const r = f8Start + k;
        return [null, null, null, { f: `IF(AND(ISNUMBER(B${r}),ISNUMBER(C${r})),MAX(0,B${r}-C${r}),"")` }, null, null, null];
      }),
      ['TOTAL', null, null, { f: `SUM(D${f8Start}:D${f8End})` }, null, { f: `SUM(F${f8Start}:F${f8End})` }, null],
      [], ['Need for the expected duration in Form 6, for the WORST case; have from Form 7 (p. 49). The gap is need minus have, never below zero.'],
    ] });
  }

  // ---------------------------------------------------------------- Form 9
  const f9Start = 6;
  sheets.push({ name: 'CP Form 9', widths: [40, 22, 22], rows: [
    ...header('Resource Gap Summary', plan, 'CP Form 9', 'pp. 50–51'),
    ['RESPONSE CLUSTER', 'TOTAL RESOURCE GAPS', 'TOTAL COST ESTIMATES'],
    ...cls.map((c) => [c.cluster.name, { f: `${quote(clusterSheet(8, c.cluster.code))}!D${f8Total}` }, { f: `${quote(clusterSheet(8, c.cluster.code))}!F${f8Total}` }]),
    ['TOTAL', { f: `SUM(B${f9Start}:B${f9Start + Math.max(cls.length, 1) - 1})` }, { f: `SUM(C${f9Start}:C${f9Start + Math.max(cls.length, 1) - 1})` }],
    [], ['Taken from each cluster’s Form 8 (p. 51).'],
  ] });

  // ---------------------------------------------------------------- Form 10
  const today = i.today;
  const live = (d: EocDesignation) => d.status === 'approved' && (d.valid_until === null || d.valid_until >= today);
  const names = (codes: string[]) => {
    const pos = i.positions.filter((p) => codes.includes(p.code));
    const ds = i.designations.filter((d) => live(d) && pos.some((p) => p.id === d.position_id)).sort((a, b) => a.rank - b.rank);
    return ds.map((d) => `${d.rank === 1 ? 'Primary' : 'Alternate'}: ${d.designee_position ?? officeName(d.office_id) ?? ''}`.trim()).join('; ') || null;
  };
  const pt = i.eocPoint;
  sheets.push({ name: 'CP Form 10', widths: [34, 60, 40], rows: [
    ...header('Emergency Operations Center', plan, 'CP Form 10', 'pp. 52–54'),
    ['LOCATION', pt ? `${pt.name}, ${pt.lat.toFixed(6)}° N, ${pt.lng.toFixed(6)}° E (${pt.verification_status.replace(/_/g, ' ')})` : null],
    ['CONTACT INFORMATION, PRIMARY', 'Landline / Mobile / Email Address / Social Media / Others'], ['CONTACT INFORMATION, ALTERNATE', 'Satellite Phone / Radio Frequency / Others'], [],
    ['POSITION (CUSTOMIZE AS APPROPRIATE)', 'NAMES AND AGENCY/ OFFICE/ ORGANIZATION (PRIMARY AND ALTERNATE)', 'CONTACT INFORMATION (PRIMARY AND ALTERNATE)'],
    ['EOC Manager', names(['EOC-MGR']), null],
    ['Operations Coordinator', names(['OPS-CHIEF']), null],
    ['Planning Coordinator', names(['PLAN-CHIEF', 'PLAN-SIT']), null],
    ['Logistics Coordinator', names(['LOG-CHIEF']), null],
    ['Finance/ Admin Coordinator', names(['FIN-CHIEF']), null],
    ['PDRA and Anticipatory Action Desk', names(['PLAN-PDRA']), null],
    ['Others', null, null],
    [], ['Names come from the EOC roster in MODE (approved designations). Name a primary and several alternates for each position (p. 53).'],
    ['The EOC must be free from exposure to this hazard’s projected impacts (p. 20); name the alternate EOC if the primary may be affected.'],
  ] });

  // ---------------------------------------------------------------- Form 11
  sheets.push({ name: 'CP Form 11', widths: [36, 60, 40], rows: [
    ...header('Incident Command System', plan, 'CP Form 11', 'pp. 55–57'),
    ['FACILITIES (CUSTOMIZE AS APPROPRIATE)', 'LOCATIONS'],
    ...['Incident Command Post', 'Staging Area', 'Base', 'Camp', 'Helispot', 'Helibase', 'Others'].map((f) => [f, null]), [],
    ['POSITION (CUSTOMIZE AS APPROPRIATE)', 'NAMES AND AGENCY/ OFFICE/ ORGANIZATION (PRIMARY AND ALTERNATE)', 'CONTACT INFORMATION (PRIMARY AND ALTERNATE)'],
    ...['Incident Commander', 'Public Information Officer', 'Liaison Officer', 'Safety Officer', 'Operations Section Chief', 'Planning Section Chief',
      'Logistics Section Chief', 'Finance/Admin Section Chief', 'Others'].map((p) => [p, null, null]),
    [], ['For the worst case consider single command, unified command, incident complex, single incident divided or area command (p. 57).'],
    ['ICS "Camp" is where responders rest, not an evacuation centre. ICS facilities stay free from worst-case exposure (p. 21).'],
  ] });

  // ---------------------------------------------------------------- Chapter IV
  const mods = i.items.filter((x) => x.item_kind === 'module');
  sheets.push({ name: 'Chapter IV', widths: [36, 18, 18, 60], rows: [
    ['Chapter IV: Activation, Deactivation and Non-Activation'], [`${plan.code} · ${plan.title}`], [`${SOURCE}, pp. 23–25; MOO Consolidated Draft 1.0, Figure 1.7 and Table 1.12.`], [],
    ['ACTIVATION TRIGGERS (proposed)', plan.activation_triggers ?? null], ['WARNING TIME', plan.warning_time ?? null], [],
    ['EOC MODULE', 'IN THIS PLAN', 'SEATED FROM', 'NOTE'],
    ...MODULE_ORDER.map((m) => {
      const it = mods.find((x) => x.item_code === m);
      return [MODULE_HEADING[m], it ? (it.state === 'lead' ? 'Lead clusters' : 'On') : '–', it ? it.min_level.toUpperCase() : null, it?.note ?? null];
    }), [],
    ['RESPONSE CLUSTER', 'IN THIS PLAN', 'SEATED FROM', 'NOTE'],
    ...cls.map((c) => [c.cluster.name, c.state === 'lead' ? 'Lead' : c.state === 'on' ? 'Activated' : 'On standby',
      i.items.find((x) => x.item_kind === 'cluster' && x.item_code === c.cluster.code)?.min_level.toUpperCase() ?? null, c.note]), [],
    ['WHO DECIDES', 'The Responsible Official (the Mayor, as CDRRMC Chair) approves EOC activation and activates the City’s clusters and IMT (NDRP; NDRRMC Memorandum No. 131, s. 2018, sec. 9.2). The EOC Manager records it in MODE with the authority.'],
    ['ACTIVATION PATH', 'PDRA on early warning signs, or RDANA where there is no warning; Blue or Red per the sample flow chart (p. 24). A State of Imminent Disaster under RA 12287 follows its own path (SOP GOV-05) and needs at least three days’ lead time.'],
    ['DEACTIVATION', 'The Incident Commander recommends; the Responsible Official directs deactivation; clusters for early recovery continue; the EOC returns to White (pp. 23–24).'],
    ['NON-ACTIVATION', 'If the hazard does not happen or no longer threatens, keep the plan as a continuing plan or fold it into the City’s overall plan (p. 23).'],
  ] });

  // ---------------------------------------------------------------- Annex: families together and the CCCM anchors
  const brgyDistrict = new Map(i.barangays.map((b) => [b.psgc, b.district_id ?? null]));
  const centresIn = (n: number) => i.centres.filter((c) => c.verification_status !== 'superseded' && c.verification_status !== 'training'
    && c.barangay_psgc && brgyDistrict.get(c.barangay_psgc) === n).map((c) => `${c.name} (${c.verification_status.replace(/_/g, ' ')})`).join('; ');
  sheets.push({ name: 'Annex Families', widths: [24, 48, 14, 70], rows: [
    ['Annex: Families Stay Together, and Where Camp Management Is Anchored'], [`${plan.code} · ${plan.title}`],
    ['RA 10821 Sec. 3(k), 4(d), 6, 12; DSWD-DILG-DOH-DepEd JMC No. 02, s. 2021; CPMS 2019; IASC Disability Guidelines 2019. Proposed for the 1–4 Dec 2026 validation.'], [],
    ['RULE', 'TEXT', null, 'BASIS'],
    ...FAMILY_UNITY_RULES.map((r) => [r.key, r.text, null, r.ref]), [],
    ['CSWD DISTRICT', 'DISTRICT CAMP COORDINATOR (POSITION)', 'BARANGAYS', 'CITY EVACUATION CENTRES IN THE DISTRICT (MODE INVENTORY)'],
    ...i.districts.map((d, k) => [d.code, d.coordinatorTitle, d.barangays.length, centresIn(k + 1) || 'None listed yet']), [],
    [PRIVACY],
  ] });
  return sheets;
}

/** A file name for the workbook: CP_TEMPLATE_<code>_<date>.xlsx */
export const cpFileName = (p: Pick<ContingencyPlan, 'code'>, today: string) => `CP_TEMPLATE_${p.code}_${today}.xlsx`;
