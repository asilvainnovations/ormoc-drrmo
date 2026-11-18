// Routine logbook entries as short forms. The same kinds of event come up again and again in an activation, so each one
// is a template: pick chips, type little, and the entry text is written in a fixed, searchable shape. Nothing here needs
// a database change: the result is an ordinary logbook line with its category. No names of affected persons.
import type { LogCategory } from '@/types';

export type FieldKind = 'chips' | 'text' | 'number' | 'barangay' | 'time';
export interface LogField { key: string; label: string; kind: FieldKind; options?: string[]; required?: boolean; placeholder?: string }
export interface LogTemplate { id: string; label: string; hint: string; category: LogCategory; fields: LogField[]; render: (v: Record<string, string>) => string }

const has = (s: string | undefined) => !!s && s.trim() !== '';
const part = (label: string, s: string | undefined) => (has(s) ? ` ${label}${s!.trim()}` : '');
const end = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

export const LOG_TEMPLATES: LogTemplate[] = [
  { id: 'warning', label: 'Warning received', hint: 'A bulletin or advisory from an agency', category: 'warning',
    fields: [
      { key: 'source', label: 'From', kind: 'chips', required: true, options: ['PAGASA', 'PHIVOLCS', 'MGB', 'NDRRMC / OCD', 'DILG', 'River gauge', 'Other'] },
      { key: 'hazard', label: 'Hazard', kind: 'chips', required: true, options: ['Tropical cyclone', 'Heavy rain', 'Flood', 'Landslide', 'Earthquake', 'Tsunami', 'Storm surge', 'Other'] },
      { key: 'product', label: 'Bulletin or advisory no.', kind: 'text', placeholder: 'e.g. 5' },
      { key: 'area', label: 'Area covered', kind: 'text', placeholder: 'e.g. Leyte, Ormoc Bay' },
      { key: 'until', label: 'Valid until', kind: 'time' },
    ],
    render: (v) => end(`Warning received: ${v.hazard} from ${v.source}${part('No. ', v.product).replace(' No. ', ' · No. ')}${has(v.area) ? ` · Area: ${v.area!.trim()}` : ''}${has(v.until) ? ` · Valid until ${v.until}` : ''}`) },
  { id: 'decision', label: 'Decision made', hint: 'Something the EOC or the Mayor decided', category: 'decision',
    fields: [
      { key: 'decision', label: 'Decision', kind: 'chips', required: true, options: ['Raise EOC level', 'Pre-emptive evacuation', 'Class suspension', 'Work suspension', 'Road closure', 'Request assistance', 'Stand down', 'Other'] },
      { key: 'detail', label: 'Details', kind: 'text', placeholder: 'Where, who, from when' },
      { key: 'by', label: 'Decided by (position)', kind: 'text', required: true, placeholder: 'e.g. City Mayor, EOC Manager' },
    ],
    render: (v) => end(`Decision: ${v.decision}${has(v.detail) ? ` — ${v.detail!.trim()}` : ''}. Decided by ${v.by!.trim()}`) },
  { id: 'advisory', label: 'Advisory sent', hint: 'A message went out to the public or responders', category: 'warning',
    fields: [
      { key: 'channel', label: 'Channel', kind: 'chips', required: true, options: ['SMS', 'Radio', 'Social media', 'Siren', 'Loudspeaker', 'Barangay captains', 'Phone call'] },
      { key: 'to', label: 'To', kind: 'chips', required: true, options: ['All barangays', 'Affected barangays', 'Responders', 'General public'] },
      { key: 'gist', label: 'What it said', kind: 'text', required: true, placeholder: 'One line' },
    ],
    render: (v) => end(`Advisory sent via ${v.channel} to ${v.to!.toLowerCase()}: ${v.gist!.trim()}`) },
  { id: 'barangay', label: 'Barangay contact', hint: 'Heard from a barangay', category: 'report',
    fields: [
      { key: 'barangay', label: 'Barangay', kind: 'barangay', required: true },
      { key: 'condition', label: 'Condition', kind: 'chips', required: true, options: ['Normal', 'Monitoring', 'Affected', 'Isolated', 'Evacuating'] },
      { key: 'families', label: 'Families evacuated', kind: 'number' },
      { key: 'persons', label: 'Persons evacuated', kind: 'number' },
      { key: 'need', label: 'Needs', kind: 'text', placeholder: 'e.g. boats, food packs' },
    ],
    render: (v) => end(`Barangay ${v.barangay}: ${v.condition!.toLowerCase()}${has(v.families) || has(v.persons) ? ` · evacuated ${has(v.families) ? `${v.families} families` : ''}${has(v.families) && has(v.persons) ? ' / ' : ''}${has(v.persons) ? `${v.persons} persons` : ''}` : ''}${has(v.need) ? ` · Needs: ${v.need!.trim()}` : ''}`) },
  { id: 'request', label: 'Resource requested', hint: 'Someone asked for equipment or supplies', category: 'request',
    fields: [
      { key: 'item', label: 'What', kind: 'text', required: true, placeholder: 'e.g. rubber boats' },
      { key: 'qty', label: 'How many', kind: 'number', required: true },
      { key: 'for', label: 'For (office or barangay)', kind: 'text', required: true },
      { key: 'priority', label: 'Priority', kind: 'chips', required: true, options: ['Life safety', 'Urgent', 'Routine'] },
    ],
    render: (v) => end(`Resource requested: ${v.qty} ${v.item!.trim()} for ${v.for!.trim()}. Priority: ${v.priority!.toLowerCase()}`) },
  { id: 'resource', label: 'Resource moved', hint: 'A team or equipment moved or changed status', category: 'resource',
    fields: [
      { key: 'action', label: 'What happened', kind: 'chips', required: true, options: ['Dispatched', 'Arrived', 'Returned', 'Out of service'] },
      { key: 'what', label: 'Team or equipment', kind: 'text', required: true, placeholder: 'e.g. Rescue Team 2, Truck 3' },
      { key: 'from', label: 'From', kind: 'text' },
      { key: 'to', label: 'To', kind: 'text' },
    ],
    render: (v) => end(`${v.action}: ${v.what!.trim()}${part('from ', v.from)}${part('to ', v.to)}`) },
  { id: 'status', label: 'Road or facility status', hint: 'Roads, bridges, power, water, health, centres', category: 'report',
    fields: [
      { key: 'kind', label: 'What', kind: 'chips', required: true, options: ['Road', 'Bridge', 'Power', 'Water', 'Telecom', 'Health facility', 'Evacuation centre'] },
      { key: 'where', label: 'Where', kind: 'text', required: true, placeholder: 'Name or location' },
      { key: 'state', label: 'Status', kind: 'chips', required: true, options: ['Passable', 'Limited', 'Closed', 'Damaged', 'Restored'] },
    ],
    render: (v) => end(`${v.kind} status: ${v.where!.trim()} is ${v.state!.toLowerCase()}`) },
  { id: 'situation', label: 'Situation check', hint: 'A routine look at how things stand', category: 'report',
    fields: [
      { key: 'trend', label: 'Overall', kind: 'chips', required: true, options: ['Stable', 'Improving', 'Worsening'] },
      { key: 'note', label: 'Note', kind: 'text', placeholder: 'Optional' },
    ],
    render: (v) => end(`Situation check: ${v.trend!.toLowerCase()}${has(v.note) ? ` — ${v.note!.trim()}` : ''}`) },
  { id: 'handover', label: 'Shift handover', hint: 'Duty officer changes over', category: 'general',
    fields: [
      { key: 'out', label: 'Outgoing', kind: 'text', required: true, placeholder: 'Name or position' },
      { key: 'in', label: 'Incoming', kind: 'text', required: true, placeholder: 'Name or position' },
      { key: 'open', label: 'Open items', kind: 'number' },
      { key: 'note', label: 'Note', kind: 'text', placeholder: 'Optional' },
    ],
    render: (v) => end(`Shift handover: ${v.out!.trim()} to ${v.in!.trim()}${has(v.open) ? ` · ${v.open} open items` : ''}${has(v.note) ? ` · ${v.note!.trim()}` : ''}`) },
];

export const templateById = (id: string) => LOG_TEMPLATES.find((t) => t.id === id);
export const missingFields = (t: LogTemplate, v: Record<string, string>) => t.fields.filter((f) => f.required && !has(v[f.key]));
export const renderLog = (t: LogTemplate, v: Record<string, string>) => t.render(v);
