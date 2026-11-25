import type { ProtocolCategory } from '@/types';
// 1.29.0: Title Case for every group heading (house style for section and subsection titles).
export const CATEGORY: Record<ProtocolCategory, string> = {
  daily_operations: 'Daily Operations', warning: 'Warning and Public Information', eoc: 'EOC Activation and Response Operations',
  anticipatory_action: 'Anticipatory Action', council: 'CDRRMC Secretariat', reporting: 'Reporting and Situational Awareness', recovery: 'Recovery and PDNA (Ch.5)',
  governance: 'Governance and the CDRRMC', workforce: 'EOC Workforce and Designations', budget: 'LDRRMF Budget Cycle and Risk Financing (Ch.6)',
  response_clusters: 'Contingency Plan Activation and Response Clusters', geospatial: 'Geo-COP and Maps',
  risk_information: 'Risk Information and Critical Facilities (Ch.3)', risk_planning: 'CDRA, DRRM Planning and Barangay Plans (Ch.3)',
  contingency_planning: 'Contingency Planning (Ch.3)', continuity: 'Public Service Continuity and Lifelines',
  learning: 'Monitoring, Evaluation and Learning (Ch.7)', partnerships: 'Partnerships and Mutual Aid (Ch.8)',
  capacity: 'Capacity Development and Community Resilience (Ch.9)', sustainability: 'Institutional Sustainability and Recognition (Ch.10)',
};

/** Workflows are the office's management cycles (ADR-016); protocols are the operational procedures. */
export const WORKFLOW_CATEGORIES: ProtocolCategory[] = ['council', 'governance', 'workforce', 'budget', 'response_clusters',
  'geospatial', 'risk_information', 'risk_planning', 'contingency_planning', 'continuity', 'learning', 'partnerships', 'capacity', 'sustainability'];
/** Mirrors the kind set by migration 20261108002000: incident protocols vs management workflows. The template's own
 *  kind wins (1.29.0: SOP 7-04 is a protocol in a workflow category; SOP 5-01 is a workflow in a protocol one). */
export const isWorkflow = (c: ProtocolCategory) => WORKFLOW_CATEGORIES.includes(c);
export const templateIsWorkflow = (t: { kind?: 'protocol' | 'workflow'; category: ProtocolCategory }) =>
  t.kind ? t.kind === 'workflow' : isWorkflow(t.category);
export const KIND_LABEL = { protocol: 'Protocol (point of action)', workflow: 'Workflow (management cycle)' } as const;

export const FORM_STATUS: Record<'draft' | 'approved' | 'retired', string> = { draft: 'Draft', approved: 'Approved', retired: 'Retired' };

/** The four DRRM thematic areas (RA 10121 Sec. 3; NDRRMP 2020–2030 thematic pillars). Each category sits under one area.
 *
 *  1.29.0 (ADR-046) review against the references:
 *  - NDRRMP 2020–2030 Pillar 3 is "Disaster Response and Early Recovery": Outcome 13 (response operations: ICS on
 *    site, information and reporting, pre-developed response plans and protocols, partnerships for humanitarian
 *    logistics, relief), Outcome 14 (forecast-based early action) and Outcome 15 (SitReps, RDANA). So EOC activation
 *    and response operations, anticipatory action, contingency plan activation and clusters, and reporting move here.
 *  - Ormoc City DRRM 10-Year Plan 2023–2032, Table 9: early warning systems, LDRRMF utilisation and risk financing
 *    under Prevention and Mitigation; strengthening the LDRRMC and LDRRMO, the operations center, simulation
 *    exercises and capacity building under Preparedness; ICS, forecast-based early action and CCCM under Response and
 *    Early Recovery; PDNA and recovery programmes under Rehabilitation and Recovery.
 *  - SOP 7-04 (after-action review) leaves Recovery for Monitoring, Evaluation and Learning under Preparedness. */
export type ThematicArea = 'prevention' | 'preparedness' | 'response' | 'recovery';
export const THEMATIC: { key: ThematicArea; label: string; short: string; about: string; categories: ProtocolCategory[] }[] = [
  { key: 'prevention', label: 'Disaster Prevention and Mitigation', short: 'Prevention and Mitigation',
    about: 'Avoid hazards or lessen their impacts before disasters occur: risk information and maps, risk-informed plans and budgets, risk financing and early warning systems.',
    categories: ['risk_information', 'risk_planning', 'geospatial', 'budget', 'warning'] },
  { key: 'preparedness', label: 'Disaster Preparedness', short: 'Preparedness',
    about: 'Build the capacity of institutions and communities to respond: the CDRRMC and CDRRMO, EOC designations and duty, contingency and continuity plans, partnerships, exercises and learning.',
    categories: ['governance', 'council', 'workforce', 'daily_operations', 'contingency_planning', 'continuity', 'partnerships', 'learning', 'capacity', 'sustainability'] },
  { key: 'response', label: 'Disaster Response and Early Recovery', short: 'Response and Early Recovery',
    about: 'Act before and during an event to save lives and meet basic needs: forecast-based early action, EOC activation, ICS interface, evacuation, resource requests, response clusters and SitReps.',
    categories: ['anticipatory_action', 'eoc', 'response_clusters', 'reporting'] },
  { key: 'recovery', label: 'Disaster Rehabilitation and Recovery', short: 'Rehabilitation and Recovery',
    about: 'Restore and improve affected communities: the pre-disaster recovery framework, PDNA, rebuilding, livelihoods and building back better.',
    categories: ['recovery'] },
];
export const thematicOf = (c: ProtocolCategory): ThematicArea => THEMATIC.find((t) => t.categories.includes(c))?.key ?? 'preparedness';
export const AREA_LABEL = Object.fromEntries(THEMATIC.map((t) => [t.key, t.label])) as Record<ThematicArea, string>;
export const AREA_SHORT = Object.fromEntries(THEMATIC.map((t) => [t.key, t.short])) as Record<ThematicArea, string>;

/** Where a form belongs (1.29.0): the thematic area of the steps that record on it, the most-used first.
 *  A form no step uses yet falls back to the area of its Manual chapter. STEP-RECORD is shared by every area. */
const CHAPTER_AREA: Record<string, ThematicArea> = {
  '1': 'preparedness', '2': 'preparedness', '3': 'prevention', '4': 'response', '5': 'recovery', '6': 'prevention', '7': 'preparedness', '8': 'preparedness', '9': 'preparedness', '10': 'preparedness',
};
export function chapterArea(docCode: string | null | undefined): ThematicArea | null {
  const m = docCode?.match(/(?:Chapter|Ch\.|Area)\s*(\d+)/i);
  const n = m?.[1];
  if (!n) return null;
  if (/^Area/i.test(docCode ?? '')) return n === '4' ? 'response' : n === '6' ? 'prevention' : null;
  return CHAPTER_AREA[n] ?? null;
}
export function formAreas(usedBy: ProtocolCategory[], docCode?: string | null): { primary: ThematicArea; also: ThematicArea[] } {
  const counts = new Map<ThematicArea, number>();
  for (const c of usedBy) { const a = thematicOf(c); counts.set(a, (counts.get(a) ?? 0) + 1); }
  const order = THEMATIC.map((t) => t.key);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0])).map(([a]) => a);
  const primary = ranked[0] ?? chapterArea(docCode) ?? 'preparedness';
  return { primary, also: ranked.filter((a) => a !== primary) };
}
