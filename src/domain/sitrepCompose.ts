// SitRep as a template (1.25.0): the report is composed from what the EOC already recorded (barangay reports, ECHO camp reports,
// requests and the logbook), so the person on duty reviews and corrects instead of writing from a blank page. Nothing here invents a
// figure: a count nobody reported stays blank, and every line comes from a record the EOC holds.
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

/** "Power: partly out. Water supply: normal. …" plus an optional note. Unset lifelines are left out, not reported as normal. */
export function lifelinesText(s: Partial<Record<Lifeline, LifelineState>>, note = ''): string {
  const parts = LIFELINES.filter((l) => s[l.key]).map((l) => `${l.label}: ${STATE_WORD[s[l.key]!]}.`);
  if (note.trim()) parts.push(note.trim());
  return parts.join(' ');
}
/** Read the chips back out of a saved lifelines text, so the editor can show what is already written. */
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
  lines.push(`${i.latest.length} of ${i.totalBarangays} barangays have reported.`
    + (hit.length ? ` ${hit.length} ${hit.length === 1 ? 'is' : 'are'} affected: ${list(hit.map(nm))}.` : ' None reports being affected.')
    + (isolated.length ? ` Isolated: ${list(isolated.map(nm))}.` : ''));
  lines.push(per || fam ? `${per.toLocaleString('en-PH')} persons (${fam.toLocaleString('en-PH')} families) are evacuated outside centres.${uncounted ? ` ${uncounted} barangay${uncounted > 1 ? 's have' : ' has'} not reported counts.` : ''}` : (uncounted ? `Evacuation counts not yet reported by ${uncounted} barangay${uncounted > 1 ? 's' : ''}.` : ''));
  if (i.camps.centresOpen) lines.push(`Inside evacuation centres: ${i.camps.persons.toLocaleString('en-PH')} persons (${i.camps.families.toLocaleString('en-PH')} families) in ${i.camps.centresOpen} open centre${i.camps.centresOpen > 1 ? 's' : ''}${i.camps.overCapacity ? `, ${i.camps.overCapacity} over capacity` : ''}.`);

  const acts = i.log.filter((l) => ACTION_CATEGORIES.has(l.category)).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).map((l) => `- ${hhmm(l.occurred_at)} ${l.entry}`);
  const needs = [...i.openRequests].sort((a, b) => Number(b.priority === 'life_safety') - Number(a.priority === 'life_safety'))
    .map((r) => `- ${r.quantity} ${r.unit} ${r.item} for ${r.requesting_party}${r.priority === 'life_safety' ? ' (life safety)' : r.priority === 'urgent' ? ' (urgent)' : ''}`);
  const given = i.deliveredInPeriod.map((r) => `- ${r.quantity} ${r.unit} ${r.item} to ${r.requesting_party}`);

  return {
    report_type: i.hasActivation ? 'during_disaster' : 'pre_disaster', incident_type: i.hazardName,
    affected_barangays: hit.length, evacuated_families: fam, evacuated_persons: per,
    situation: lines.filter(Boolean).join(' '),
    actions_taken: acts.length ? acts.join('\n') : null, needs: needs.length ? needs.join('\n') : null, assistance_provided: given.length ? given.join('\n') : null,
  };
}
