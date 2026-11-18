// Flood intelligence logic: the barangay watch list and the benefit-cost screen for flood measures.
//
// Nothing here sets a rainfall, river or warning threshold. The watch list orders barangays by the DDRiVE flood
// class they already carry and the basis the person picks. The screen is plain discounted arithmetic over figures
// the planner types in; it ships with no cost or benefit numbers of its own, so it cannot pass an invented value
// off as evidence. It is a screening aid for ranking options, not an appraisal.
import { classify } from '@/features/eoc/map/themes';

// ------------------------------------------------------------------ watch list
export type FloodClass = 'Very high' | 'High' | 'Moderate' | 'Low' | 'Not indicated' | 'Not assessed' | 'Other';
export const FLOOD_CLASSES: FloodClass[] = ['Very high', 'High', 'Moderate', 'Low'];
const CLASS_RANK: Record<string, number> = { 'Very high': 0, High: 1, Moderate: 2, Low: 3, 'Not indicated': 4, 'Not assessed': 5, Other: 6 };

export interface FloodRow {
  psgc: string; name: string; cls: FloodClass;
  exposedPop: number | null; exposurePct: number | null; pop2024: number | null; priority: number | null;
}

/** DDRiVE text to one of the flood classes. A blank is "Not assessed", never "Low". */
export function floodClassOf(text: string | null | undefined): FloodClass {
  // A mixed range such as "Low–High (mixed classes)" counts at its highest class, so the barangay is never understated.
  const range = /(?:very high|high|moderate|low)[^–-]*[–-]\s*(very high|high|moderate|low)/i.exec(text ?? '');
  const c = classify(range ? range[1] : text);
  return (c in CLASS_RANK ? c : 'Other') as FloodClass;
}

export type WatchBasis = 'exposed' | 'share' | 'priority';
export const WATCH_BASIS: { value: WatchBasis; label: string; tip: string }[] = [
  { value: 'exposed', label: 'People exposed', tip: 'Most people living in flood-prone area first' },
  { value: 'share', label: 'Share of barangay', tip: 'Highest share of the barangay population in flood-prone area first' },
  { value: 'priority', label: 'Proposed priority', tip: 'DDRiVE proposed priority rank, 1 first (pending validation)' },
];

/** Barangays at or above `minClass`, ordered by class, then the chosen basis, then name. Unknown figures sort last. */
export function watchList(rows: FloodRow[], minClass: FloodClass, basis: WatchBasis): FloodRow[] {
  const limit = CLASS_RANK[minClass] ?? 1;
  const num = (v: number | null, desc: boolean) => (v == null ? Number.POSITIVE_INFINITY : desc ? -v : v);
  const key = (r: FloodRow) => basis === 'exposed' ? num(r.exposedPop, true) : basis === 'share' ? num(r.exposurePct, true) : num(r.priority, false);
  return rows.filter((r) => (CLASS_RANK[r.cls] ?? 9) <= limit)
    .sort((a, b) => (CLASS_RANK[a.cls]! - CLASS_RANK[b.cls]!) || (key(a) - key(b)) || a.name.localeCompare(b.name));
}

export function classCounts(rows: FloodRow[]): { cls: FloodClass; barangays: number; people: number; unknown: number }[] {
  const out = new Map<FloodClass, { cls: FloodClass; barangays: number; people: number; unknown: number }>();
  for (const r of rows) {
    const o = out.get(r.cls) ?? { cls: r.cls, barangays: 0, people: 0, unknown: 0 };
    o.barangays += 1;
    if (r.exposedPop == null) o.unknown += 1; else o.people += r.exposedPop;
    out.set(r.cls, o);
  }
  return [...out.values()].sort((a, b) => CLASS_RANK[a.cls]! - CLASS_RANK[b.cls]!);
}

/** Plain text for a message or the logbook. Rainfall is context the person read from PAGASA, never used to rank. */
export function watchText(list: FloodRow[], note: { rain24: string; rain72: string; product: string; at: string }): string {
  const ctx = [note.rain24 && `24-hour rainfall ${note.rain24} mm`, note.rain72 && `72-hour ${note.rain72} mm`, note.product && `source: ${note.product}`, note.at && `as of ${note.at}`].filter(Boolean).join('; ');
  const head = `Flood watch list (DDRiVE flood class; a reference ranking, not a warning)${ctx ? ` | ${ctx}` : ''}`;
  const lines = list.map((r, i) => `${i + 1}. ${r.name} | ${r.cls}${r.exposedPop != null ? ` | ${r.exposedPop.toLocaleString('en-PH')} exposed` : ''}${r.exposurePct != null ? ` (${r.exposurePct.toFixed(1)}%)` : ''}`);
  return [head, ...lines].join('\n');
}

// ------------------------------------------------------------------ benefit-cost screen
export type MeasureType = 'nbs' | 'hybrid' | 'grey';
export const MEASURE_TYPE: Record<MeasureType, string> = { nbs: 'Nature-based', hybrid: 'Hybrid', grey: 'Grey' };

export interface Assumptions {
  /** Assets exposed to flooding, PHP million. */ assets: number;
  /** Share of those assets damaged in a typical flood event, 0 to 1. */ damage: number;
  /** Damaging flood events per year. */ events: number;
  /** Years the measure is assessed over. */ horizon: number;
  /** Annual discount rate, 0 to 1. */ discount: number;
  /** Yearly operation and maintenance as a share of capital cost, 0 to 1. */ om: number;
}
export interface Measure {
  id: string; name: string; type: MeasureType;
  /** Capital cost, PHP million. */ capital: number;
  /** Share of expected flood damage this measure prevents, 0 to 1. */ reduction: number;
  /** Other yearly economic benefit, PHP million (2nd dividend). */ economic: number;
  /** Yearly social and environmental benefit, PHP million (3rd dividend). */ social: number;
}
export interface MeasureResult {
  measure: Measure; avoided: number; economic: number; social: number; benefits: number; cost: number; bcr: number | null; npv: number;
}

/** Present value of 1 per year for n years. */
export function annuity(rate: number, years: number): number {
  const n = Math.max(0, Math.floor(years));
  return rate === 0 ? n : (1 - (1 + rate) ** -n) / rate;
}

export function screenMeasure(a: Assumptions, m: Measure): MeasureResult {
  const A = annuity(a.discount, a.horizon);
  const avoided = a.assets * a.damage * a.events * m.reduction * A;
  const economic = m.economic * A;
  const social = m.social * A;
  const benefits = avoided + economic + social;
  const cost = m.capital + m.capital * a.om * A;
  return { measure: m, avoided, economic, social, benefits, cost, bcr: cost > 0 ? benefits / cost : null, npv: benefits - cost };
}

/** Measures with a cost entered, best BCR first. */
export function screenAll(a: Assumptions, ms: Measure[]): MeasureResult[] {
  return ms.filter((m) => m.capital > 0).map((m) => screenMeasure(a, m)).sort((x, y) => (y.bcr ?? -1) - (x.bcr ?? -1));
}

/** Lean of the top three by BCR: more grey than nature-based = grey-led; any hybrid or a mix = hybrid; else nature-first. */
export function leadStrategy(results: MeasureResult[]): { key: 'nbs' | 'hybrid' | 'grey'; label: string } | null {
  const top = results.slice(0, 3).map((r) => r.measure.type);
  if (!top.length) return null;
  const nbs = top.filter((t) => t === 'nbs').length, grey = top.filter((t) => t === 'grey').length;
  if (grey > nbs) return { key: 'grey', label: 'Grey-led' };
  if (top.includes('hybrid') || (nbs > 0 && grey > 0)) return { key: 'hybrid', label: 'Hybrid' };
  return { key: 'nbs', label: 'Nature-based first' };
}

/** Which assumptions are still blank, so the screen can say what it needs instead of showing zeros. */
export function missingAssumptions(a: Assumptions): string[] {
  const out: string[] = [];
  if (!(a.assets > 0)) out.push('assets exposed');
  if (!(a.damage > 0)) out.push('damage share');
  if (!(a.events > 0)) out.push('events per year');
  if (!(a.horizon > 0)) out.push('years');
  return out;
}
