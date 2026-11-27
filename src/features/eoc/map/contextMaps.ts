// City context layers on the EOC map (1.34.1): slope, zoning and topography as georeferenced image overlays, like the
// hazard sheets (ADR-028). GENERATED from the fit of 28 Nov 2026: each CPDO-GIS sheet's printed UTM 51N ticks on the
// Luzon 1911 datum (the sheet says "Luzon (Philippines - Mindanao)"), converted to WGS 84 with EPSG's Philippine
// parameters (-133, -77, -51 m). The fit record is docs/adr/028-georef-fits.json. Each image is the map frame only,
// clipped to the City outline (400 m margin), sea and blank paper transparent. Reference, not survey: confirm zoning
// with CPDO and terrain with the City Engineer before any site decision.
import type { HazardMap } from './hazardMaps';

export type ContextMap = Omit<HazardMap, 'family' | 'mode'> & { group: 'Terrain' | 'Land use' };

export const CONTEXT_MAPS: ContextMap[] = [
  {
    code: 'slope', title: 'Slope', group: 'Terrain', file: '/geo/context/slope.webp',
    corners: [[124.470981, 11.192149], [124.791099, 11.190402], [124.789491, 10.925361], [124.469659, 10.927065]], size: [1800, 1462],
    source: 'Slope map, CPDO-GIS (slope data DA-DAR; Ormoc orthophoto 1997); printed 16 Dec 2014', custodian: 'City Planning and Development Office (CPDO), GIS',
    issued: '2014-12-16', scale: '1:30,000', fit: 'UTM 51N frame ticks (18), Luzon 1911', accuracy_m: 6.2,
    legend: [{ label: '0–3%', color: '#065779' }, { label: '3–8%', color: '#9d9a92' }, { label: '8–18%', color: '#018003' }, { label: '18–30%', color: '#87bdcb' }, { label: '30–50%', color: '#927755' }, { label: '50% and above', color: '#717c36' }],
    note: 'Slope classes in percent. Steeper classes raise landslide susceptibility; read with the rain- and earthquake-induced landslide sheets.',
  },
  {
    code: 'zoning', title: 'Zoning (poblacion)', group: 'Land use', file: '/geo/context/zoning.webp',
    corners: [[124.555061, 11.064829], [124.66324, 11.064252], [124.662774, 10.981458], [124.554626, 10.982029]], size: [2000, 1626],
    source: 'Zoning map, CPDO-GIS (land-use map approved 2001); printed 14 Mar 2017', custodian: 'City Planning and Development Office (CPDO), GIS',
    issued: '2017-03-14', scale: '1:10,000', fit: 'UTM 51N frame ticks (20), Luzon 1911', accuracy_m: 1.8,
    legend: [{ label: 'Commercial Zone II', color: '#fe0100' }, { label: 'Commercial Zone III', color: '#ff0021' }, { label: 'Institutional', color: '#0036c1' }, { label: 'Residential Zone I', color: '#fdff70' }, { label: 'Residential Zone II', color: '#fdd403' }, { label: 'Urban area', color: '#fdff52' }, { label: 'Utilities', color: '#a9a7a6' }, { label: 'Open space', color: '#6ad504' }],
    note: 'Covers the poblacion and its fringe only. Confirm the current zoning ordinance with CPDO.',
  },
  {
    code: 'topography', title: 'Topography (elevation)', group: 'Terrain', file: '/geo/context/topography.webp',
    corners: [[124.47601, 11.190835], [124.780779, 11.189175], [124.779196, 10.926862], [124.474698, 10.928482]], size: [1800, 1513],
    source: 'Topographic map, CPDO from NAMRIA topographic sheets 3852-I, 3852-IV, 3953-II and 3853-III', custodian: 'City Planning and Development Office (CPDO)',
    issued: '', scale: 'sheet scale as printed', fit: 'UTM 51N frame ticks (12), Luzon 1911', accuracy_m: 3.6,
    legend: [{ label: 'Lowland, 0–50 m', color: '#e8e7ee' }, { label: 'Foothills', color: '#a59380' }, { label: 'Uplands', color: '#415425' }, { label: 'Summits, to 1,300 m', color: '#095c0e' }],
    note: '50 m elevation classes with 20 m contours. Read exact elevations from the full sheet.',
  },
];
