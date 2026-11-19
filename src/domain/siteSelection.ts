// Evacuation site selection (1.26.0): criteria for choosing open areas and camp sites, and the capacity arithmetic for
// an open area. Each criterion keeps its own source. The Ormoc criteria come from the City's own disaster record
// (1991 flash flood, the December 2014 storm-surge transfers, the 2017 earthquake). Screening against these criteria
// flags what the CDRRMO, CPDO, City Engineer and CSWDO must check in the field; it never designates or certifies a site.
// No hazard threshold is invented here: hazard classes come from the City's sheets and the agencies' geohazard maps.

export type CriterionSource = 'ra12076' | 'ra10821' | 'jmc' | 'sphere' | 'local';
export const CRITERION_SOURCE: Record<CriterionSource, string> = {
  ra12076: 'RA 12076 (Ligtas Pinoy Centers Act), Sec. 4',
  ra10821: 'RA 10821 (Children\'s Emergency Relief and Protection Act)',
  jmc: 'DSWD-DILG-DOH-DepEd JMC No. 02, s. 2021 (CCCM)',
  sphere: 'Sphere Handbook (2018), Shelter and settlement standard 2',
  local: 'Ormoc City disaster record (CDRRMO; DRRM 10-Year Plan 2023–2032)',
};

export interface SiteCriterion { key: string; group: 'hazard' | 'space' | 'services' | 'access' | 'protection' | 'tenure'; text: string; source: CriterionSource; ref: string }

/** Checks for a possible open area or camp site. Order: hazard first, then space, services, access, protection, tenure. */
export const SITE_CRITERIA: SiteCriterion[] = [
  { key: 'geohazard', group: 'hazard', text: 'Outside danger zones on the MGB, PHIVOLCS and PAGASA geohazard maps; central to the community and not likely to be isolated.', source: 'ra12076', ref: 'Sec. 4(a)' },
  { key: 'rivers', group: 'hazard', text: 'Away from the Anilao and Malbasag river corridors and other flash-flood paths (5 Nov 1991, Tropical Storm Thelma/Uring).', source: 'local', ref: '1991 flash flood' },
  { key: 'surge', group: 'hazard', text: 'Away from the Ormoc Bay shoreline for typhoons: in December 2014 the City moved 260 families out of three centres when storm surges of 2.7–3.7 m were forecast.', source: 'local', ref: 'Typhoon Ruby/Hagupit, Dec 2014' },
  { key: 'seismic', group: 'hazard', text: 'For earthquakes: open ground clear of buildings, walls and slopes; uplands near the 6 Jul 2017 rupture (Tongonan, Danao) need a geologist\'s check. The 2017 Lake Danao tent site was judged unsafe and moved to the Dolores centre.', source: 'local', ref: 'M6.5 earthquake, Jul 2017' },
  { key: 'drainage', group: 'hazard', text: 'Gently sloping ground that drains; not low-lying or marshy; not below steep slopes.', source: 'sphere', ref: 'Standard 2, guidance notes' },
  { key: 'area', group: 'space', text: 'Total site area of 45 m² per person (30 m² where kitchens, schools and health services are outside the site); covered living space 3.5 m² per person.', source: 'sphere', ref: 'Standards 2 and 3' },
  { key: 'water', group: 'services', text: 'Safe water within 500 m; room for toilets, bathing and laundry by sex, with accessible units; waste segregation area.', source: 'jmc', ref: 'VII, WASH' },
  { key: 'facilities', group: 'services', text: 'Space for a kitchen, health station, isolation area, breastfeeding room, storage and standby power.', source: 'ra12076', ref: 'Sec. 4(c)' },
  { key: 'access', group: 'access', text: 'Reachable by road in all weather by trucks and ambulances; the route screened on this map and confirmed by field teams.', source: 'jmc', ref: 'Camp set-up' },
  { key: 'protection', group: 'protection', text: 'Lighting, security, separate toilets by sex, child- and women-friendly spaces; persons with disability and older persons near services.', source: 'jmc', ref: 'Protection; VII' },
  { key: 'schools', group: 'protection', text: 'Schools and child development centres only when no other place is available; open spaces and gyms before classrooms; as brief as possible, with a written report to DepEd and DILG if use will exceed 15 days.', source: 'ra10821', ref: 'Sec. 5' },
  { key: 'tenure', group: 'tenure', text: 'Public land or a written agreement with the owner (as with the City–Robinsons Land MOA, Dec 2023); the use stays a proposal until the CDRRMC endorses it.', source: 'local', ref: 'City practice' },
];

export const SPHERE_SITE_M2 = 45;
export const SPHERE_SITE_M2_SERVICES_OUTSIDE = 30;

/** Persons an open area can hold at the Sphere site-area figure. Null when the area is not measured. */
export function openAreaCapacity(areaM2: number | null, servicesOutside = false): number | null {
  if (areaM2 === null || !Number.isFinite(areaM2) || areaM2 <= 0) return null;
  return Math.floor(areaM2 / (servicesOutside ? SPHERE_SITE_M2_SERVICES_OUTSIDE : SPHERE_SITE_M2));
}

/** An approximate label point for a barangay polygon: the area centroid of its largest ring (MultiPolygon-safe). */
export function polygonLabelPoint(geometry: { type: string; coordinates: unknown }): [number, number] | null {
  const rings: number[][][] = geometry.type === 'Polygon' ? [(geometry.coordinates as number[][][])[0]!]
    : geometry.type === 'MultiPolygon' ? (geometry.coordinates as number[][][][]).map((p) => p[0]!) : [];
  let best: { a: number; x: number; y: number } | null = null;
  for (const ring of rings) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i] as [number, number];
      const [x1, y1] = ring[i + 1] as [number, number];
      const f = x0 * y1 - x1 * y0;
      a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
    }
    if (a === 0) continue;
    const area = Math.abs(a / 2);
    if (!best || area > best.a) best = { a: area, x: cx / (3 * a), y: cy / (3 * a) };
  }
  return best ? [best.x, best.y] : null;
}
