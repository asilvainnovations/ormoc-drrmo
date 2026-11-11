import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { cornersToPixel, distance, polygonArea, toUtm51 } from './geodesy';
import { HAZARD_MAPS } from './hazardMaps';
import { classify, classOf, exposureSummary, type ThemeData } from './themes';

describe('geodesy', () => {
  it('measures a degree of latitude at about 111 km', () => {
    expect(distance([124.6, 11], [124.6, 12]) / 1000).toBeCloseTo(111.2, 0);
  });
  it('computes the area of a small square near Ormoc', () => {
    const d = 0.01; // about 1.09 km by 1.11 km
    const a = polygonArea([[124.6, 11], [124.6 + d, 11], [124.6 + d, 11 + d], [124.6, 11 + d]]);
    expect(a / 1e6).toBeGreaterThan(1.18);
    expect(a / 1e6).toBeLessThan(1.24);
  });
  it('matches EPSG:32651 for the EOC reference point (pyproj, 11 Nov 2026)', () => {
    const { e, n } = toUtm51(124.6043, 11.0139);
    expect(e).toBeCloseTo(675273.1, 0);
    expect(n).toBeCloseTo(1217985.3, 0);
  });
  it('maps overlay corners back to the image corners', () => {
    const m = HAZARD_MAPS[0]!;
    const f = cornersToPixel(m.corners, m.size[0], m.size[1]);
    const [x, y] = f(m.corners[2]);
    expect(x).toBeCloseTo(m.size[0], 3);
    expect(y).toBeCloseTo(m.size[1], 3);
  });
});

describe('hazard map catalogue', () => {
  it('has a file, four corners around Ormoc and a legend for every map', () => {
    for (const m of HAZARD_MAPS) {
      expect(existsSync(`public${m.file}`), m.file).toBe(true);
      for (const [lng, lat] of m.corners) {
        expect(lng).toBeGreaterThan(124.3); expect(lng).toBeLessThan(125.0);
        expect(lat).toBeGreaterThan(10.7); expect(lat).toBeLessThan(11.4);
      }
      expect(m.legend.length).toBeGreaterThan(0);
      expect(m.accuracy_m).toBeLessThan(150);
    }
  });
  it('ships the 85 OCHA barangay polygons with PSGC codes', () => {
    const g = JSON.parse(readFileSync('public/geo/ormoc-barangays.geojson', 'utf8')) as { features: { properties: { psgc: string } }[] };
    expect(g.features).toHaveLength(85);
    expect(new Set(g.features.map((f) => f.properties.psgc)).size).toBe(85);
    expect(g.features.every((f) => /^08037380\d{2}$|^0803738\d{3}$/.test(f.properties.psgc))).toBe(true);
  });
});

describe('DDRiVE classes', () => {
  it.each([
    ['Susceptible (CDRA Table 3)', 'Susceptible'],
    ['Not available — source matrix truncated at Mabini', 'Not assessed'],
    ['Barangay-level class pending GIS extraction', 'Not assessed'],
    ['Outside mapped inundation extent (pending barangay GIS)', 'Not indicated'],
    ['Within tsunami-inundation zone, 1 to <3 m', 'Inside mapped zone'],
    ['Moderate–High', 'High'],
    ['High–Very High', 'Very high'],
    ['Low (mixed classes)', 'Low'],
    [null, 'Not assessed'],
  ])('%s -> %s', (t, c) => expect(classify(t)).toBe(c));

  it('never counts a missing population as zero', () => {
    const d: ThemeData = { flood: new Map(), hazards: new Map(), priority: new Map(), exposure: new Map([['1', { psgc: '1', population_2024: 500 } as never]]) };
    const s = exposureSummary('flood', ['1', '2'], d);
    expect(s).toEqual([{ label: 'Not assessed', color: classOf('flood', null).color, barangays: 2, population: 500, unknownPop: 1 }]);
  });
});

describe('identify on a sheet', () => {
  it('matches a legend colour and ignores transparent pixels', async () => {
    const { legendClass } = await import('./identify');
    const flood = HAZARD_MAPS.find((m) => m.code === 'flood')!;
    expect(legendClass([215, 25, 27, 255], flood)).toBe('Very high');
    expect(legendClass([254, 202, 130, 255], flood)).toBe('High');
    expect(legendClass([215, 25, 27, 0], flood)).toBeNull();
    expect(legendClass([20, 20, 20, 255], flood)).toBeNull();
  });
  it('places a point inside the sheet and refuses one outside it', async () => {
    const { pixelOf } = await import('./identify');
    const flood = HAZARD_MAPS.find((m) => m.code === 'flood')!;
    expect(pixelOf([124.6043, 11.0139], flood)).not.toBeNull();
    expect(pixelOf([125.5, 11.0], flood)).toBeNull();
  });
});

describe('identify on a published image', () => {
  it('does not read the pale sea as the palest tsunami class', async () => {
    const { legendClass } = await import('./identify');
    const tsu = HAZARD_MAPS.find((m) => m.code === 'tsunami')!;
    expect(legendClass([190, 225, 245, 255], tsu)).toBeNull();
    expect(legendClass([242, 239, 107, 255], tsu)).toBe('1 to under 2 m');
  });
});

describe('nearest EOC places', () => {
  it('sorts places by straight-line distance', async () => {
    const { nearest, GEOANALYTICS_URL } = await import('./places');
    const n = nearest([124.6043, 11.0139], [
      { id: 'far', name: 'Far', kind: 'Other', lat: 11.2, lng: 124.6, status: 'x' },
      { id: 'near', name: 'Near', kind: 'EOC', lat: 11.014, lng: 124.6045, status: 'x' }]);
    expect(n[0]!.id).toBe('near');
    expect(n[0]!.km).toBeLessThan(0.1);
    expect(GEOANALYTICS_URL.startsWith('https://geoanalytics.georisk.gov.ph')).toBe(true);
  });
});
