// Resource request templates (1.25.0): the usual asks in a disaster, so a request is a few taps and a number, not a paragraph.
// Items and units are working defaults for the form; the quantity and who needs it are what the duty officer supplies.

export interface RequestItem { label: string; unit: string }
export const REQUEST_GROUPS: { title: string; items: RequestItem[] }[] = [
  { title: 'Water and food', items: [{ label: 'Drinking water', unit: 'litres' }, { label: 'Food packs', unit: 'packs' }, { label: 'Rice', unit: 'kg' }, { label: 'Hot meals', unit: 'servings' }] },
  { title: 'Shelter and relief', items: [{ label: 'Tents', unit: 'units' }, { label: 'Blankets', unit: 'pcs' }, { label: 'Sleeping mats', unit: 'pcs' }, { label: 'Tarpaulins', unit: 'pcs' }, { label: 'Hygiene kits', unit: 'kits' }] },
  { title: 'Health', items: [{ label: 'Ambulance', unit: 'units' }, { label: 'Medical team', unit: 'teams' }, { label: 'Medical supplies', unit: 'kits' }] },
  { title: 'Rescue', items: [{ label: 'Rescue team', unit: 'teams' }, { label: 'Rescue boat', unit: 'units' }, { label: 'Life vests', unit: 'pcs' }, { label: 'Chainsaw', unit: 'units' }] },
  { title: 'Logistics', items: [{ label: 'Fuel', unit: 'litres' }, { label: 'Generator set', unit: 'units' }, { label: 'Dump truck', unit: 'units' }, { label: 'Backhoe', unit: 'units' }, { label: 'Light tower', unit: 'units' }] },
];
export const REQUESTER_CHIPS = ['Incident Commander', 'CHO', 'CSWDO', 'BFP', 'PNP', 'City Engineer', 'CDRRMO'];

export type NeededBy = 'now' | '2h' | '6h' | 'today' | 'tomorrow';
export const NEEDED_BY: { value: NeededBy; label: string }[] = [
  { value: 'now', label: 'Now' }, { value: '2h', label: 'Within 2 h' }, { value: '6h', label: 'Within 6 h' }, { value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' },
];

/** The needed-by time as an ISO string. "Today" is 6 PM Manila (UTC+8, no daylight saving); "Tomorrow" is 6 PM the next day. */
export function neededByIso(v: NeededBy, now = new Date()): string {
  const h = 3600_000;
  if (v === 'now') return now.toISOString();
  if (v === '2h') return new Date(now.getTime() + 2 * h).toISOString();
  if (v === '6h') return new Date(now.getTime() + 6 * h).toISOString();
  const manila = new Date(now.getTime() + 8 * h);
  const day = Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate() + (v === 'tomorrow' ? 1 : 0), 18, 0, 0) - 8 * h;
  return new Date(Math.max(day, now.getTime())).toISOString();
}
