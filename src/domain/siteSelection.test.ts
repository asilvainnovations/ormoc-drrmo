import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CITY_LIST, OPEN_AREAS } from '@/data/evacuationSites';
import { SITE_CRITERIA, openAreaCapacity, polygonLabelPoint } from './siteSelection';

type Feature = { properties: { psgc: string; name: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } };
const bgys = (JSON.parse(readFileSync('public/geo/ormoc-barangays.geojson', 'utf8')) as { features: Feature[] }).features;
const byPsgc = new Map(bgys.map((f) => [f.properties.psgc, f]));

// Ray casting over every ring of the barangay (holes count as outside).
function inside(f: Feature, x: number, y: number): boolean {
  const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
  return polys.some((rings) => rings.reduce((acc, ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] as [number, number]; const [xj, yj] = ring[j] as [number, number];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c ? !acc : acc;
  }, false));
}

describe('open-area capacity (Sphere 45 m², 30 m² with services outside)', () => {
  it('floors area divided by the site figure', () => {
    expect(openAreaCapacity(10_000)).toBe(222);
    expect(openAreaCapacity(10_000, true)).toBe(333);
  });
  it('is null when the area is not measured', () => {
    expect(openAreaCapacity(null)).toBeNull();
    expect(openAreaCapacity(0)).toBeNull();
    expect(openAreaCapacity(Number.NaN)).toBeNull();
  });
});

describe('site criteria', () => {
  it('each criterion has a unique key and a reference', () => {
    expect(new Set(SITE_CRITERIA.map((c) => c.key)).size).toBe(SITE_CRITERIA.length);
    for (const c of SITE_CRITERIA) expect(c.ref.length).toBeGreaterThan(0);
  });
});

describe('City list of evacuation centres', () => {
  it('codes follow the inventory pattern and are unique', () => {
    for (const c of CITY_LIST) expect(c.code).toMatch(/^[A-Z][A-Z0-9-]{1,30}$/);
    expect(new Set(CITY_LIST.map((c) => c.code)).size).toBe(CITY_LIST.length);
  });
  it('every point is inside Ormoc and, except the flagged Danhug point, inside its own barangay', () => {
    for (const c of CITY_LIST) {
      const f = byPsgc.get(c.psgc);
      expect(f, c.code).toBeDefined();
      expect(bgys.some((b) => inside(b, c.lng, c.lat)), `${c.code} inside Ormoc`).toBe(true);
      if (c.code !== 'EC-DANHUG-01') expect(inside(f!, c.lng, c.lat), `${c.code} in ${f!.properties.name}`).toBe(true);
    }
  });
  it('the seed file carries the same codes and points', () => {
    const sql = readFileSync('supabase/seed/operational/10_city_evacuation_centers.sql', 'utf8');
    for (const c of CITY_LIST) {
      expect(sql).toContain(`'${c.code}'`);
      expect(sql).toContain(`'${c.psgc}', ${c.lat}`);
    }
  });
});

describe('candidate open areas', () => {
  it('ids are unique and every mapped candidate has a known barangay', () => {
    expect(new Set(OPEN_AREAS.map((a) => a.id)).size).toBe(OPEN_AREAS.length);
    for (const a of OPEN_AREAS) if (a.psgc) expect(byPsgc.has(a.psgc), a.id).toBe(true);
  });
  it('every candidate states its basis and at least one caution', () => {
    for (const a of OPEN_AREAS) { expect(a.basis.length, a.id).toBeGreaterThan(20); expect(a.cautions.length, a.id).toBeGreaterThan(0); }
  });
  it('lists the seven storage facilities of the 10-Year Plan', () => {
    expect(OPEN_AREAS.filter((a) => a.role === 'logistics')).toHaveLength(7);
  });
  it('places a label point inside the barangay for a simple polygon', () => {
    const sq = { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] };
    expect(polygonLabelPoint(sq)).toEqual([1, 1]);
  });
});
