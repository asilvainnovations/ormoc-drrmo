/**
 * Printed City cartographic sheets for the MODE reference-map gallery.
 *
 * These are high-resolution static map images, not georeferenced raster layers.
 * Interactive overlays continue to use HAZARD_MAPS and the existing
 * public/geo/ormoc-barangays.geojson boundary dataset.
 */
export type ReferenceMapGroup = 'Hydrometeorological' | 'Geological' | 'Terrain' | 'Administrative' | 'Land use';

export interface CityReferenceMap {
  id: string;
  title: string;
  group: ReferenceMapGroup;
  file: string;
  href: string;
  description: string;
  caution: string;
}

const base = '/geo/hazard/reference/';

export const CITY_REFERENCE_MAPS: ReadonlyArray<CityReferenceMap> = [
  { id: 'flood', title: 'Flood Hazard Map', group: 'Hydrometeorological', file: 'ormoc-flood.webp', href: `${base}ormoc-flood.webp`, description: 'City flood susceptibility reference map.', caution: 'Use with current PAGASA bulletins and validated barangay exposure records.' },
  { id: 'rain-induced-landslide', title: 'Rain-Induced Landslide Hazard Map', group: 'Geological', file: 'ormoc-rain-induced-landslide.webp', href: `${base}ormoc-rain-induced-landslide.webp`, description: 'Rain-induced landslide susceptibility reference.', caution: 'Not a site-specific slope stability assessment.' },
  { id: 'earthquake-induced-landslide', title: 'Earthquake-Induced Landslide Hazard Map', group: 'Geological', file: 'ormoc-earthquake-induced-landslide.webp', href: `${base}ormoc-earthquake-induced-landslide.webp`, description: 'Earthquake-induced landslide susceptibility reference.', caution: 'Not a site-specific geotechnical assessment.' },
  { id: 'landslide-susceptibility', title: 'Landslide Susceptibility Map', group: 'Geological', file: 'ormoc-landslide-susceptibility.webp', href: `${base}ormoc-landslide-susceptibility.webp`, description: 'City landslide susceptibility reference map.', caution: 'Observe the original map legend, scale, date and limitations.' },
  { id: 'liquefaction', title: 'Liquefaction Hazard Map', group: 'Geological', file: 'ormoc-liquefaction.webp', href: `${base}ormoc-liquefaction.webp`, description: 'Liquefaction hazard reference map.', caution: 'The source map itself notes that it is not for site-specific evaluation.' },
  { id: 'ground-shaking', title: 'Ground Shaking Hazard Map', group: 'Geological', file: 'ormoc-ground-shaking.webp', href: `${base}ormoc-ground-shaking.webp`, description: 'PHIVOLCS ground-shaking reference map.', caution: 'Refer to the issuing agency for current technical interpretation.' },
  { id: 'ground-rupture', title: 'Ground Rupture Hazard Map', group: 'Geological', file: 'ormoc-ground-rupture.webp', href: `${base}ormoc-ground-rupture.webp`, description: 'Ground rupture and active fault reference map.', caution: 'Do not use for parcel-level fault setback determination.' },
  { id: 'tsunami', title: 'Tsunami Hazard Map', group: 'Hydrometeorological', file: 'ormoc-tsunami.webp', href: `${base}ormoc-tsunami.webp`, description: 'Tsunami inundation reference map.', caution: 'Follow official PHIVOLCS tsunami information and warnings.' },
  { id: 'storm-surge-1', title: 'Storm Surge Advisory 1 — 2 metres', group: 'Hydrometeorological', file: 'ormoc-storm-surge-advisory-1.webp', href: `${base}ormoc-storm-surge-advisory-1.webp`, description: 'Storm surge scenario map at 2 metres.', caution: 'Scenario reference only; not a live advisory.' },
  { id: 'storm-surge-2', title: 'Storm Surge Advisory 2 — 3 metres', group: 'Hydrometeorological', file: 'ormoc-storm-surge-advisory-2.webp', href: `${base}ormoc-storm-surge-advisory-2.webp`, description: 'Storm surge scenario map at 3 metres.', caution: 'Scenario reference only; not a live advisory.' },
  { id: 'storm-surge-3', title: 'Storm Surge Advisory 3 — 4 metres', group: 'Hydrometeorological', file: 'ormoc-storm-surge-advisory-3.webp', href: `${base}ormoc-storm-surge-advisory-3.webp`, description: 'Storm surge scenario map at 4 metres.', caution: 'Scenario reference only; not a live advisory.' },
  { id: 'storm-surge-4', title: 'Storm Surge Advisory 4 — 5 metres', group: 'Hydrometeorological', file: 'ormoc-storm-surge-advisory-4.webp', href: `${base}ormoc-storm-surge-advisory-4.webp`, description: 'Storm surge scenario map at 5 metres.', caution: 'Scenario reference only; not a live advisory.' },
  { id: 'slope', title: 'Slope Map', group: 'Terrain', file: 'ormoc-slope.webp', href: `${base}ormoc-slope.webp`, description: 'City terrain slope reference map.', caution: 'Retain the source map scale and legend when interpreting slope classes.' },
  { id: 'topography', title: 'Topographic Map', group: 'Terrain', file: 'ormoc-topography.webp', href: `${base}ormoc-topography.webp`, description: 'City topographic reference map.', caution: 'Reference only; verify coordinates and elevation against authoritative survey data.' },
  { id: 'political-boundary', title: 'Political Boundary Map', group: 'Administrative', file: 'ormoc-political-boundary.webp', href: `${base}ormoc-political-boundary.webp`, description: 'City political and barangay boundary reference map.', caution: 'The existing 85-feature GeoJSON remains the operational spatial boundary source.' },
  { id: 'zoning', title: 'Zoning Map', group: 'Land use', file: 'ormoc-zoning.webp', href: `${base}ormoc-zoning.webp`, description: 'City zoning and land-use reference map.', caution: 'Confirm current zoning with the City Planning and Development Office.' },
] as const;

export const CITY_REFERENCE_MAP_GROUPS: ReadonlyArray<ReferenceMapGroup> = [
  'Hydrometeorological', 'Geological', 'Terrain', 'Administrative', 'Land use',
];
