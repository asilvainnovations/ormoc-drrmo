// What a City should be able to field, from the NDRRMC Disaster Preparedness Minimum Standards Vol. 2 (Equipment, p. 10: "all levels
// must purchase/own and maintain the minimum standards of equipment" for early warning and communication, responders kit and medical
// health) plus the evacuation-centre ambulance item (p. 16). It is a checklist to see gaps against, not a count the standard sets.
import type { Resource, ResourceCategory } from '@/types';

export interface StandardItem { key: string; label: string; match: RegExp; category: ResourceCategory; unit: string; ref: string }
export const DPMS_EQUIPMENT: StandardItem[] = [
  { key: 'generator', label: 'Generator set', match: /generator|genset/i, category: 'power', unit: 'units', ref: 'DPMS Vol. 2 p. 10' },
  { key: 'powerbank', label: 'Power banks', match: /power ?bank/i, category: 'power', unit: 'pcs', ref: 'DPMS Vol. 2 p. 10' },
  { key: 'solar', label: 'Solar or other alternative power', match: /solar|alternative (power|energy)/i, category: 'power', unit: 'units', ref: 'DPMS Vol. 2 p. 10' },
  { key: 'flashlight', label: 'Flashlights with batteries', match: /flash ?light|torch/i, category: 'rescue', unit: 'pcs', ref: 'DPMS Vol. 2 p. 10' },
  { key: 'vehicle', label: 'Vehicle (boat or van, by location)', match: /boat|van\b|truck|vehicle|pickup|ambulance|rescue vehicle/i, category: 'vehicle', unit: 'units', ref: 'DPMS Vol. 2 p. 10' },
  { key: 'telemetry', label: 'Telemetrics (rain and water-level gauges)', match: /telemetr|rain ?gauge|water.?level|arg\b|wlms/i, category: 'communications', unit: 'units', ref: 'DPMS Vol. 2 p. 10' },
  { key: 'warning', label: 'Warning devices (sirens, megaphones)', match: /siren|megaphone|loud ?hailer|warning (device|system)|public address/i, category: 'communications', unit: 'units', ref: 'DPMS Vol. 2 p. 10' },
  { key: 'ambulance', label: 'Ambulance with complete facilities', match: /ambulance/i, category: 'medical', unit: 'units', ref: 'DPMS Vol. 2 p. 16' },
];

export interface StandardRow { item: StandardItem; units: number; serviceable: number; lines: number }
/** Match recorded resources to the standard list. A resource may count under more than one line (an ambulance is also a vehicle). */
export function standardCoverage(resources: Pick<Resource, 'name' | 'quantity' | 'is_serviceable'>[], standard = DPMS_EQUIPMENT): StandardRow[] {
  return standard.map((item) => {
    const hits = resources.filter((r) => item.match.test(r.name));
    return { item, units: hits.reduce((s, r) => s + r.quantity, 0), serviceable: hits.filter((r) => r.is_serviceable).reduce((s, r) => s + r.quantity, 0), lines: hits.length };
  });
}

export interface CategorySummary { category: ResourceCategory; lines: number; units: number; notServiceable: number }
export function categorySummary(resources: Pick<Resource, 'category' | 'quantity' | 'is_serviceable'>[]): CategorySummary[] {
  const m = new Map<ResourceCategory, CategorySummary>();
  for (const r of resources) {
    const c = m.get(r.category) ?? { category: r.category, lines: 0, units: 0, notServiceable: 0 };
    c.lines += 1; c.units += r.quantity; if (!r.is_serviceable) c.notServiceable += 1;
    m.set(r.category, c);
  }
  return [...m.values()].sort((a, b) => b.lines - a.lines);
}
