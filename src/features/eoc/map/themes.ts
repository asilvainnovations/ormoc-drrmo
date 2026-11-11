// Barangay colouring ("categorised symbology" in QGIS terms) from the DDRiVE desk assessment (ADR-024, ADR-028).
// The DDRiVE workbook stores hazard findings as text ("Susceptible (CDRA Table 3 ...)", "High", "Not assessed").
// classify() maps that text to a short class without changing its meaning; the full text stays in the identify panel.
// A blank is "Not assessed", never "None" or "Low" (DDRiVE rule: a missing value is never zero).

import type { DdriveExposure, DdriveFlood, DdriveHazards, DdrivePriority } from '@/types';

export type ThemeKey = 'none' | 'flood' | 'rain_landslide' | 'eq_landslide' | 'liquefaction' | 'tsunami' | 'storm_surge' | 'ground_rupture' | 'priority' | 'population';

export interface ThemeDef { key: ThemeKey; label: string; tip: string }
export const THEMES: ThemeDef[] = [
  { key: 'none', label: 'No colouring', tip: 'Show the barangay outlines only' },
  { key: 'flood', label: 'Flood susceptibility', tip: 'DDRiVE sheet 04: flood class per barangay (GeoAnalyticsPH / MGB)' },
  { key: 'rain_landslide', label: 'Rain-induced landslide', tip: 'DDRiVE sheet 05, from CDRA Table 3' },
  { key: 'eq_landslide', label: 'Earthquake-induced landslide', tip: 'DDRiVE sheet 05, from CDRA Table 3' },
  { key: 'liquefaction', label: 'Liquefaction', tip: 'DDRiVE sheet 05, from CDRA Table 3' },
  { key: 'tsunami', label: 'Tsunami', tip: 'DDRiVE sheet 05: inside or outside the mapped inundation zone' },
  { key: 'storm_surge', label: 'Storm surge', tip: 'DDRiVE sheet 05, from CDRA Table 3' },
  { key: 'ground_rupture', label: 'Ground rupture', tip: 'DDRiVE sheet 05: inside or outside the mapped rupture zone' },
  { key: 'priority', label: 'Proposed priority rank', tip: 'DDRiVE sheet 08: proposed rank, pending validation' },
  { key: 'population', label: 'Population, 2024 POPCEN', tip: 'PSA 2024 census count per barangay (DDRiVE sheet 06)' },
];

/** Class order and colours. Hazard colours follow the City's printed hazard legends (an intentional exception
 *  to the token-only rule: they must match the official maps); "Not assessed" is neutral. */
export const CLASS_STYLE: Record<string, { color: string; rank: number }> = {
  'Very high': { color: '#B2181B', rank: 0 },
  High: { color: '#D7191B', rank: 1 },
  'Inside mapped zone': { color: '#D7191B', rank: 1 },
  'PEIS VIII or higher': { color: '#E8615F', rank: 1 },
  Susceptible: { color: '#F08A3E', rank: 2 },
  Moderate: { color: '#FDAE61', rank: 2 },
  Low: { color: '#FFE38A', rank: 3 },
  'Not indicated': { color: '#DCE6EE', rank: 4 },
  'Not assessed': { color: '#A3ADB8', rank: 5 },
  Other: { color: '#7F8C99', rank: 6 },
};

export function classify(text: string | null | undefined): string {
  const t = (text ?? '').trim().toLowerCase().replace(/[–—]/g, '-');
  if (!t || /^(not assessed|not available|not compiled|barangay-level class pending)/.test(t)) return 'Not assessed';
  // A range ("Moderate-High", "High-Very High") shows its upper class: the cautious reading.
  if (/^high-very high/.test(t)) return 'Very high';
  if (/^moderate-high/.test(t)) return 'High';
  if (t.startsWith('very high')) return 'Very high';
  if (t.startsWith('high')) return 'High';
  if (t.startsWith('moderate') || t.startsWith('medium')) return 'Moderate';
  if (t.startsWith('low')) return 'Low';
  if (t.startsWith('susceptible')) return 'Susceptible';
  if (t.startsWith('within') || t.startsWith('inside')) return 'Inside mapped zone';
  if (t.startsWith('peis viii')) return 'PEIS VIII or higher';
  if (t.startsWith('not indicated') || t.startsWith('outside') || t.startsWith('not susceptible')) return 'Not indicated';
  return 'Other';
}

export interface ThemeData {
  flood: Map<string, DdriveFlood>; hazards: Map<string, DdriveHazards>;
  priority: Map<string, DdrivePriority>; exposure: Map<string, DdriveExposure>;
}

/** The raw DDRiVE text (or number) a theme reads for one barangay. */
export function rawValue(key: ThemeKey, psgc: string, d: ThemeData): string | number | null {
  switch (key) {
    case 'flood': return d.flood.get(psgc)?.susceptibility_class ?? null;
    case 'priority': return d.priority.get(psgc)?.priority_rank ?? null;
    case 'population': return d.exposure.get(psgc)?.population_2024 ?? null;
    case 'none': return null;
    default: return (d.hazards.get(psgc)?.[key] as string | null | undefined) ?? null;
  }
}

/** Graduated classes for the numeric themes. */
export const PRIORITY_BREAKS: [number, string, string][] = [[10, 'Rank 1-10', '#B2181B'], [20, 'Rank 11-20', '#F08A3E'], [40, 'Rank 21-40', '#FFE38A'], [Infinity, 'Rank 41 and lower', '#DCE6EE']];
export const POP_BREAKS: [number, string, string][] = [[1000, 'Under 1,000', '#DCEEFB'], [3000, '1,000-2,999', '#9CC7E8'], [7000, '3,000-6,999', '#4F94CD'], [Infinity, '7,000 or more', '#1B4F86']];

export function classOf(key: ThemeKey, v: string | number | null): { label: string; color: string } {
  if (key === 'priority' || key === 'population') {
    if (typeof v !== 'number') return { label: 'Not assessed', color: CLASS_STYLE['Not assessed']!.color };
    const b = (key === 'priority' ? PRIORITY_BREAKS : POP_BREAKS).find(([max]) => v <= max)!;
    return { label: b[1], color: b[2] };
  }
  const label = classify(typeof v === 'number' ? String(v) : v);
  return { label, color: CLASS_STYLE[label]!.color };
}

/** Exposure summary (NOAH-style): barangays and 2024 population per class of the chosen theme. */
export function exposureSummary(key: ThemeKey, psgcs: string[], d: ThemeData) {
  const rows = new Map<string, { label: string; color: string; barangays: number; population: number; unknownPop: number }>();
  for (const p of psgcs) {
    const c = classOf(key, rawValue(key, p, d));
    const r = rows.get(c.label) ?? { ...c, barangays: 0, population: 0, unknownPop: 0 };
    r.barangays += 1;
    const pop = d.exposure.get(p)?.population_2024;
    if (typeof pop === 'number') r.population += pop; else r.unknownPop += 1;
    rows.set(c.label, r);
  }
  const order = (l: string) => CLASS_STYLE[l]?.rank ?? [...PRIORITY_BREAKS, ...POP_BREAKS].findIndex((b) => b[1] === l);
  return [...rows.values()].sort((a, b) => order(a.label) - order(b.label));
}
