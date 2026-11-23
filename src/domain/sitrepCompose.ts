// SitRep lifeline and COP fields (1.31.0): structured data is stored in the existing lifelines_status text column.
// JSON v1 is backward-compatible with earlier plain-text lifeline notes; no database migration is required.
import type { BarangayCondition, EocLevel } from '@/types';
import { LEVEL_INFO } from './eoc';

export type Lifeline = 'power' | 'water' | 'comms' | 'roads';
export type LifelineState = 'normal' | 'partial' | 'out' | 'unknown';
export const LIFELINES: { key: Lifeline; label: string }[] = [
  { key: 'power', label: 'Power' }, { key: 'water', label: 'Water supply' }, { key: 'comms', label: 'Communications' }, { key: 'roads', label: 'Roads and bridges' },
];
export const LIFELINE_STATES: { value: LifelineState; label: string }[] = [
  { value: 'normal', label: 'Normal' }, { value: 'partial', label: 'Partly out' }, { value: 'out', label: 'Out' }, { value: 'unknown', label: 'Unknown' },
];
const STATE_WORD: Record<LifelineState, string> = { normal: 'normal', partial: 'partly out', out: 'out', unknown: 'status not yet known' };

export const COP_STATUS_OPTIONS = [
  { value: 'normal', label: 'Normal / Operational' },
  { value: 'limited', label: 'Limited / Partially operational' },
  { value: 'disrupted', label: 'Disrupted / Suspended' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'not_reported', label: 'Not reported' },
] as const;
export type CopStatus = typeof COP_STATUS_OPTIONS[number]['value'];
export interface CopField { status?: CopStatus; value?: string; note?: string }
export interface SitrepCopData {
  version: 1;
  lifelines: Record<string, CopField>;
  transport: Record<string, CopField>;
  connectivity: Record<string, CopField>;
  fuel: Record<string, CopField>;
  health: Record<string, CopField>;
  recovery: Record<string, CopField>;
  weather: Record<string, CopField>;
  generalNotes: string;
}
export const COP_GROUPS = {
  lifelines: [
    ['energy', 'Energy — power and fuel'], ['water', 'Water — drinking water and irrigation'],
    ['telecom', 'Telecommunications — cellular, internet and radio'], ['transport', 'Transportation — roads, bridges, port and air access'],
    ['health', 'Healthcare — hospitals, RHUs and EMS'], ['food', 'Food and agriculture — markets, rice, fisheries and landing centres'],
    ['safety', 'Public safety — PNP, BFP and rescue services'], ['government', 'Government continuity — City Hall, barangays and EOC'],
    ['education', 'Education — schools and evacuation-centre use'], ['logistics', 'Logistics and supply chain — warehouses, trucking and shipping'],
  ] as [string, string][],
  transport: [
    ['road_tacloban', 'Ormoc–Tacloban national road'], ['road_baybay', 'Ormoc–Baybay national road'], ['road_kananga', 'Ormoc–Kananga national road'],
    ['port_ormoc', 'Ormoc Port'], ['port_fastcraft', 'Fastcraft services to Cebu'], ['port_roro', 'RoRo services'], ['port_cargo', 'Cargo operations'],
    ['air_tacloban', 'Access to Tacloban Airport'], ['air_hlz', 'Helicopter landing zones'],
  ] as [string, string][],
  connectivity: [
    ['link_cebu', 'Ormoc ↔ Cebu'], ['link_tacloban', 'Ormoc ↔ Tacloban'], ['link_baybay', 'Ormoc ↔ Baybay'],
    ['link_kananga', 'Ormoc ↔ Kananga'], ['link_northern_leyte', 'Ormoc ↔ Northern Leyte'],
  ] as [string, string][],
  fuel: [
    ['diesel', 'Diesel availability'], ['gasoline', 'Gasoline availability'], ['lpg', 'LPG availability'],
    ['fuel_stations', 'Fuel stations operational (e.g. 8 of 12)'],
  ] as [string, string][],
  health: [
    ['hospitals', 'Hospitals operational (x / total)'], ['rhus', 'RHUs operational (x / total)'],
    ['bed_occupancy', 'Bed occupancy (%)'], ['medical_teams', 'Medical teams deployed'],
    ['medicines', 'Essential medicines availability'],
  ] as [string, string][],
  recovery: [
    ['power_restoration', 'Power restoration (%)'], ['water_restoration', 'Water restoration (%)'],
    ['roads_cleared', 'Roads cleared (%)'], ['evacuees_returned', 'Evacuees returned (%)'],
    ['schools_reopened', 'Schools reopened (%)'],
  ] as [string, string][],
  weather: [
    ['pagasa_summary', 'PAGASA weather summary'], ['heat_index', 'Heat index advisory'], ['rainfall', 'Rainfall advisory'],
    ['river', 'River monitoring'], ['dam', 'Dam monitoring'], ['drought', 'Drought status / DroughtCaster'],
  ] as [string, string][],
} as const;

const emptyGroup = (): Record<string, CopField> => ({});
export function emptySitrepCop(): SitrepCopData {
  return { version: 1, lifelines: emptyGroup(), transport: emptyGroup(), connectivity: emptyGroup(), fuel: emptyGroup(), health: emptyGroup(), recovery: emptyGroup(), weather: emptyGroup(), generalNotes: '' };
}
export function parseSitrepCop(value: string | null): SitrepCopData {
  if (value?.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value) as Partial<SitrepCopData>;
      if (parsed.version === 1) return { ...emptySitrepCop(), ...parsed,
        lifelines: parsed.lifelines ?? {}, transport: parsed.transport ?? {}, connectivity: parsed.connectivity ?? {},
        fuel: parsed.fuel ?? {}, health: parsed.health ?? {}, recovery: parsed.recovery ?? {}, weather: parsed.weather ?? {},
        generalNotes: parsed.generalNotes ?? '' };
    } catch { /* legacy free text below */ }
  }
  // Migrate the four earlier chip values into the new structured representation when opened and saved.
  const legacy = parseLifelines(value);
  const data = emptySitrepCop();
  for (const [key, status] of Object.entries(legacy.state)) {
    data.lifelines[key] = { status: status === 'normal' ? 'normal' : status === 'unknown' ? 'unknown' : 'disrupted', note: '' };
  }
  data.generalNotes = legacy.note;
  return data;
}
export function sitrepCopText(data: SitrepCopData): string {
  const hasData = Object.values(data).some((v) => typeof v === 'string' ? !!v.trim() : Object.keys(v as object).length > 0);
  return hasData ? JSON.stringify(data) : '';
}

/** Legacy text formatter retained for older callers and saved records. */
export function lifelinesText(s: Partial<Record<Lifeline, LifelineState>>, note = ''): string {
  const parts = LIFELINES.filter((l) => s[l.key]).map((l) => `${l.label}: ${STATE_WORD[s[l.key]!] }.`);
  if (note.trim()) parts.push(note.trim());
  return parts.join(' ');
}
export function parseLifelines(text: string | null): { state: Partial<Record<Lifeline, LifelineState>>; note: string } {
  const state: Partial<Record<Lifeline, LifelineState>> = {}; let rest = text ?? '';
  for (const l of LIFELINES) for (const st of Object.keys(STATE_WORD) as LifelineState[]) {
    const sentence = `${l.label}: ${STATE_WORD[st]}.`;
    if (rest.includes(sentence)) { state[l.key] = st; rest = rest.replace(sentence, ''); }
  }
  return { state, note: rest.replace(/\s+/g, ' ').trim() };
}

export interface ComposeInput {
  level: EocLevel; hazardName: string | null; hasActivation: boolean; periodStart: string; periodEnd: string; totalBarangays: number;
  latest: { barangay_psgc: string; condition: BarangayCondition; families_evacuated: number | null; persons_evacuated: number | null }[];
  names: Map<string, string>;
  camps: { centresOpen: number; persons: number; families: number; overCapacity: number };
  openRequests: { quantity: number; unit: string; item: string; requesting_party: string; priority: string }[];
  deliveredInPeriod: { quantity: number; unit: string; item: string; requesting_party: string }[];
  log: { occurred_at: string; entry: string; category: string }[];
}
export interface ComposedSitrep {
  report_type: 'pre_disaster' | 'during_disaster'; incident_type: string | null; affected_barangays: number; evacuated_families: number; evacuated_persons: number;
  situation: string; actions_taken: string | null; needs: string | null; assistance_provided: string | null;
}
const HIT = new Set<BarangayCondition>(['affected', 'isolated', 'evacuating']);
const ACTION_CATEGORIES = new Set(['decision', 'warning', 'request', 'resource', 'level_change']);
const hhmm = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const list = (xs: string[], max = 6) => (xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} and ${xs.length - max} more`);
export function composeSitrep(i: ComposeInput): ComposedSitrep {
  const hit = i.latest.filter((r) => HIT.has(r.condition));
  const isolated = i.latest.filter((r) => r.condition === 'isolated');
  const nm = (r: { barangay_psgc: string }) => i.names.get(r.barangay_psgc) ?? r.barangay_psgc;
  const fam = i.latest.reduce((s, r) => s + (r.families_evacuated ?? 0), 0);
  const per = i.latest.reduce((s, r) => s + (r.persons_evacuated ?? 0), 0);
  const uncounted = i.latest.filter((r) => r.condition !== 'normal' && (r.families_evacuated === null || r.persons_evacuated === null)).length;
  const lines = [`As of ${hhmm(i.periodEnd)}, the EOC is at ${LEVEL_INFO[i.level].name} level${i.hazardName ? ` for ${i.hazardName.toLowerCase()}` : ''}.`];
  lines.push(`${i.latest.length} of ${i.totalBarangays} barangays have reported.` + (hit.length ? ` ${hit.length} ${hit.length === 1 ? 'is' : 'are'} affected: ${list(hit.map(nm))}.` : ' None reports being affected.') + (isolated.length ? ` Isolated: ${list(isolated.map(nm))}.` : ''));
  lines.push(per || fam ? `${per.toLocaleString('en-PH')} persons (${fam.toLocaleString('en-PH')} families) are evacuated outside centres.${uncounted ? ` ${uncounted} barangay${uncounted > 1 ? 's have' : ' has'} not reported counts.` : ''}` : (uncounted ? `Evacuation counts not yet reported by ${uncounted} barangay${uncounted > 1 ? 's' : ''}.` : ''));
  if (i.camps.centresOpen) lines.push(`Inside evacuation centres: ${i.camps.persons.toLocaleString('en-PH')} persons (${i.camps.families.toLocaleString('en-PH')} families) in ${i.camps.centresOpen} open centre${i.camps.centresOpen > 1 ? 's' : ''}${i.camps.overCapacity ? `, ${i.camps.overCapacity} over capacity` : ''}.`);
  const acts = i.log.filter((l) => ACTION_CATEGORIES.has(l.category)).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).map((l) => `- ${hhmm(l.occurred_at)} ${l.entry}`);
  const needs = [...i.openRequests].sort((a, b) => Number(b.priority === 'life_safety') - Number(a.priority === 'life_safety')).map((r) => `- ${r.quantity} ${r.unit} ${r.item} for ${r.requesting_party}${r.priority === 'life_safety' ? ' (life safety)' : r.priority === 'urgent' ? ' (urgent)' : ''}`);
  const given = i.deliveredInPeriod.map((r) => `- ${r.quantity} ${r.unit} ${r.item} to ${r.requesting_party}`);
  return { report_type: i.hasActivation ? 'during_disaster' : 'pre_disaster', incident_type: i.hazardName, affected_barangays: hit.length, evacuated_families: fam, evacuated_persons: per,
    situation: lines.filter(Boolean).join(' '), actions_taken: acts.length ? acts.join('\n') : null, needs: needs.length ? needs.join('\n') : null, assistance_provided: given.length ? given.join('\n') : null };
}
