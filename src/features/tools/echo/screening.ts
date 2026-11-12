// ECHO evacuation intelligence (1.16.0, ADR-030): screening a centre or a route against the City's hazard sheets.
// The sheets are fitted pictures (ADR-028): a reading is "about", good to each sheet's fit error, and only at the
// barangay scale. Screening flags what to check with the field team; it never marks a site or a route as safe.
import { distance, type LngLat } from '@/features/eoc/map/geodesy';
import type { HazardMap } from '@/features/eoc/map/hazardMaps';

export type Severity = 'high' | 'moderate' | 'low' | 'none' | 'unknown';

/** How serious a sheet reading is, from the sheet's own legend wording. */
export function severity(m: HazardMap, value: string): Severity {
  if (value === 'Not mapped here' || value === 'No class shown') return 'none';
  if (/^(Could not|Not readable)/.test(value)) return 'unknown';
  if (m.code === 'tsunami') return 'high';                       // any inundation depth on the sheet
  if (/^(very high|high)$/i.test(value) || /^active fault/i.test(value) || /^intensity viii/i.test(value)) return 'high';
  if (/^moderate$/i.test(value) || /^intensity vii/i.test(value) || /^debris fall/i.test(value)) return 'moderate';
  if (/^low$/i.test(value)) return 'low';
  return 'moderate';
}

/** Points every `stepM` metres along a polyline (start and end included), for sampling the sheets. */
export function densify(pts: LngLat[], stepM = 50, maxPoints = 400): LngLat[] {
  if (pts.length < 2) return [...pts];
  const out: LngLat[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const d = distance(a, b);
    const n = Math.max(1, Math.ceil(d / stepM));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  if (out.length <= maxPoints) return out;
  const every = Math.ceil(out.length / maxPoints);
  return out.filter((_, i) => i % every === 0 || i === out.length - 1);
}

export interface RouteFinding { sheet: string; title: string; high: number; moderate: number; samples: number; firstHighAt: number | null }
/** Per sheet: how many sampled points of the route fall in high or moderate classes, and where the first high one is (metres). */
export function summariseRoute(samples: LngLat[], readings: { map: HazardMap; value: string }[][]): RouteFinding[] {
  const byCode = new Map<string, RouteFinding>();
  let along = 0;
  samples.forEach((p, i) => {
    if (i > 0) along += distance(samples[i - 1]!, p);
    for (const { map, value } of readings[i] ?? []) {
      const f = byCode.get(map.code) ?? { sheet: map.code, title: map.title, high: 0, moderate: 0, samples: 0, firstHighAt: null };
      const s = severity(map, value);
      f.samples++;
      if (s === 'high') { f.high++; if (f.firstHighAt === null) f.firstHighAt = Math.round(along); }
      if (s === 'moderate') f.moderate++;
      byCode.set(map.code, f);
    }
  });
  return [...byCode.values()].sort((a, b) => b.high - a.high || b.moderate - a.moderate);
}
