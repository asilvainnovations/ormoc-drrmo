/** EOC modules activated by contingency scenario (1.33.0).
 *
 *  The picture is Figure 1.7 of the Manual (Consolidated Draft 1.0, Chapter 1): which EOC modules each contingency
 *  plan seats. The data is cp_activation_items (operational file 06); an activation copies it into activation_clusters
 *  through activate_contingency_plan() and set_eoc_level() (migration 20261128004000). FIGURE_1_7 below transcribes
 *  the figure so a test can hold the seed to it, cell by cell. Proposed until the CDRRMC adopts each plan. */
import type { ActivationCluster, ContingencyPlan, CpActivationItem, EocLevel, EocSection, ResponseCluster } from '@/types';

export const MODULE_ORDER = ['operations', 'planning', 'pdra_aa_desk', 'logistics', 'finance_admin', 'cluster_desks', 'barangay_liaison',
  'building_assessment_mdm'] as const;
export type ModuleCode = (typeof MODULE_ORDER)[number];

/** Column headings as the figure prints them. */
export const MODULE_HEADING: Record<ModuleCode, string> = {
  operations: 'Operations', planning: 'Planning (situation)', pdra_aa_desk: 'PDRA and AA desk', logistics: 'Logistics',
  finance_admin: 'Finance and Admin', cluster_desks: 'Cluster desks', barangay_liaison: 'Barangay Liaison Desk',
  building_assessment_mdm: 'Building assessment and MDM',
};

/** A cell of Figure 1.7: switched on, "Lead clusters" (only the clusters that lead are seated), or not used. */
export type FigureCell = 'on' | 'lead' | 'off';

/** Figure 1.7 rows in the figure's order: plan code and the row label the figure prints. */
export const SCENARIO_ROWS: { code: string; label: string }[] = [
  { code: 'CP-FLOOD-LUNOP', label: 'Typhoon with flood and storm surge' },
  { code: 'CP-FLASHFLOOD', label: 'Flash flood (Anilao–Malbasag)' },
  { code: 'CP-EARTHQUAKE', label: 'Earthquake (Philippine Fault)' },
  { code: 'CP-LANDSLIDE', label: 'Landslide (uplands)' },
  { code: 'CP-DROUGHT', label: 'El Niño / drought' },
  { code: 'CP-DISEASE', label: 'Disease outbreak' },
  { code: 'CP-INDUSTRIAL', label: 'Industrial or geothermal incident, fire, event' },
];

const row = (cells: string): Record<ModuleCode, FigureCell> => {
  const v = cells.split(' ') as FigureCell[];
  return Object.fromEntries(MODULE_ORDER.map((m, i) => [m, v[i]!])) as Record<ModuleCode, FigureCell>;
};
/** Transcribed from Figure 1.7. Columns in MODULE_ORDER. */
export const FIGURE_1_7: Record<string, Record<ModuleCode, FigureCell>> = {
  'CP-FLOOD-LUNOP': row('on on on on on on on off'),
  'CP-FLASHFLOOD': row('on on off on off lead off off'),
  'CP-EARTHQUAKE': row('on on off on on on on on'),
  'CP-LANDSLIDE': row('on on off on off lead off off'),
  'CP-DROUGHT': row('off on off off off lead off off'),
  'CP-DISEASE': row('off on off on on lead off off'),
  'CP-INDUSTRIAL': row('on on off off off lead off off'),
};

/** A plan's row of the figure, from its activation items. */
export function planRow(items: readonly Pick<CpActivationItem, 'plan_id' | 'item_kind' | 'item_code' | 'state'>[], planId: string): Record<ModuleCode, FigureCell> {
  const out = Object.fromEntries(MODULE_ORDER.map((m) => [m, 'off'])) as Record<ModuleCode, FigureCell>;
  for (const i of items) {
    if (i.plan_id !== planId || i.item_kind !== 'module' || !(MODULE_ORDER as readonly string[]).includes(i.item_code)) continue;
    out[i.item_code as ModuleCode] = i.state === 'lead' ? 'lead' : i.state === 'on' ? 'on' : 'off';
  }
  return out;
}

export type LiveState = 'on' | 'lead' | 'standby' | 'stood_down' | 'off';

/** The modules of the current activation, as the server holds them. */
export function liveModules(items: readonly Pick<ActivationCluster, 'item_kind' | 'item_code' | 'state'>[]): Record<ModuleCode, LiveState> {
  const out = Object.fromEntries(MODULE_ORDER.map((m) => [m, 'off'])) as Record<ModuleCode, LiveState>;
  for (const i of items) if (i.item_kind === 'module' && (MODULE_ORDER as readonly string[]).includes(i.item_code)) out[i.item_code as ModuleCode] = i.state;
  return out;
}

/** The clusters of the current activation, grouped by state, in the clusters' own order. */
export function seatedClusters(items: readonly Pick<ActivationCluster, 'item_kind' | 'item_code' | 'state'>[], clusters: readonly Pick<ResponseCluster, 'code' | 'name' | 'sort'>[]) {
  const byCode = new Map(clusters.map((c) => [c.code, c]));
  const pick = (s: ActivationCluster['state']) => items.filter((i) => i.item_kind === 'cluster' && i.state === s)
    .map((i) => byCode.get(i.item_code) ?? { code: i.item_code, name: i.item_code, sort: 99 }).sort((a, b) => a.sort - b.sort);
  return { lead: pick('lead'), on: pick('on'), standby: pick('standby'), stoodDown: pick('stood_down') };
}

/** Plans that cover a hazard, adopted first; retired plans never. */
export function suggestPlans<P extends Pick<ContingencyPlan, 'code' | 'status' | 'hazard_code' | 'hazard_codes'>>(plans: readonly P[], hazard: string | null): P[] {
  if (!hazard) return [];
  const rank = { adopted: 0, draft: 1, expired: 2, to_prepare: 3, retired: 9 } as const;
  return plans.filter((p) => p.status !== 'retired' && (p.hazard_code === hazard || (p.hazard_codes ?? []).includes(hazard)))
    .sort((a, b) => rank[a.status] - rank[b.status] || a.code.localeCompare(b.code));
}

/** EOC roster sections staffed by the modules that are on (or lead). Command and command staff are always seated. */
export function activeSections(live: Record<ModuleCode, LiveState>): Set<EocSection> {
  const on = (m: ModuleCode) => live[m] === 'on' || live[m] === 'lead';
  const s = new Set<EocSection>(['command', 'command_staff']);
  if (on('operations')) s.add('operations');
  if (on('planning') || on('pdra_aa_desk')) s.add('planning');
  if (on('logistics')) s.add('logistics');
  if (on('finance_admin')) s.add('finance_admin');
  if (on('cluster_desks')) s.add('cluster_desk');
  if (on('barangay_liaison')) s.add('barangay_desk');
  return s;
}

/** True when the activation has a plan's module set (else the screens fall back to the level rule). */
export const hasModuleSet = (items: readonly Pick<ActivationCluster, 'item_kind'>[]) => items.some((i) => i.item_kind === 'module');

/** Plain words for a plan's status on the scenario screens. */
export function planStatusNote(p: Pick<ContingencyPlan, 'status' | 'adopted_ref' | 'valid_until'>, today: string): string {
  if (p.status === 'adopted') return `Adopted${p.adopted_ref ? ` (${p.adopted_ref})` : ''}${p.valid_until && p.valid_until < today ? '; past its validity date' : ''}.`;
  if (p.status === 'expired') return `Expired${p.valid_until ? ` on ${p.valid_until}` : ''}. Its activation set is used until a renewed plan is adopted. Gawad KALASAG counts only plans approved by the CDRRMC and adopted by the Sangguniang Panlungsod within the last three years.`;
  if (p.status === 'retired') return 'Retired. It cannot be activated.';
  return 'Not yet adopted. Its activation set is a proposal for the 1–4 December 2026 validation workshop.';
}

export const LEVEL_RANK: Record<EocLevel, number> = { white: 0, blue: 1, red: 2 };
