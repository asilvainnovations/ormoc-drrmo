// GENERATED from the georeferencing run of 11 Nov 2026 (ADR-028). Do not edit coordinates by hand: re-run
// scripts/georef (see the ADR) if a sheet is replaced. Corners are WGS 84 [lng, lat]: top-left, top-right,
// bottom-right, bottom-left. Accuracy is the fit error against the sheet's own grid or the city outline.

export type HazardFamily = 'hydromet' | 'geologic';
export interface HazardMap {
  code: string; title: string; family: HazardFamily; mode: 'classified' | 'image'; file: string;
  corners: [[number, number], [number, number], [number, number], [number, number]];
  size: [number, number]; source: string; custodian: string; issued: string; scale: string;
  fit: string; accuracy_m: number; legend: { label: string; color: string }[]; note?: string;
}

export const HAZARD_MAPS: HazardMap[] = [
  {
    code: 'flood', title: "Flood susceptibility", family: 'hydromet', mode: 'classified', file: '/geo/hazard/flood.webp',
    corners: [[124.460639, 11.188276], [124.795918, 11.18645], [124.794358, 10.930124], [124.45937, 10.931907]],
    size: [1605, 1242], source: "MGB Region VIII flood hazard (unpublished, unofficial), mapped by CPDO-GIS; printed 22 Mar 2023", custodian: "City Planning and Development Office (CPDO), GIS",
    issued: '2023-03-22', scale: 'about 1:60,000', fit: "UTM 51N grid crosses (12)", accuracy_m: 6,
    legend: [{ label: "Very high", color: '#D7191B' }, { label: "High", color: '#FECA82' }, { label: "Moderate", color: '#C6E8AD' }, { label: "Low", color: '#2C83B9' }],
  },
  {
    code: 'rain_landslide', title: "Rain-induced landslide susceptibility", family: 'hydromet', mode: 'classified', file: '/geo/hazard/rain_landslide.webp',
    corners: [[124.46043, 11.188277], [124.795918, 11.18645], [124.794358, 10.930124], [124.459162, 10.931908]],
    size: [1606, 1242], source: "MGB Region VIII rain-induced landslide hazard (unpublished, unofficial), mapped by CPDO-GIS; printed 22 Mar 2023", custodian: "City Planning and Development Office (CPDO), GIS",
    issued: '2023-03-22', scale: 'about 1:60,000', fit: "UTM 51N grid crosses (12)", accuracy_m: 6,
    legend: [{ label: "Very high", color: '#D7191B' }, { label: "High", color: '#FDAE61' }, { label: "Moderate", color: '#ACDDA5' }, { label: "Low", color: '#FFFFBF' }, { label: "Debris fall", color: '#2C83B9' }],
  },
  {
    code: 'storm_surge', title: "Storm surge (Storm Surge Advisory 2)", family: 'hydromet', mode: 'classified', file: '/geo/hazard/storm_surge.webp',
    corners: [[124.460406, 11.187451], [124.795817, 11.185625], [124.794262, 10.930125], [124.459142, 10.931908]],
    size: [1606, 1238], source: "DOST Project NOAH storm surge hazard, SSA 2; mapped by CPDO-GIS; printed 22 Mar 2023", custodian: "City Planning and Development Office (CPDO), GIS",
    issued: '2023-03-22', scale: 'about 1:60,000', fit: "UTM 51N grid crosses (12)", accuracy_m: 5,
    legend: [{ label: "High", color: '#D7191B' }, { label: "Moderate", color: '#FFFFBF' }, { label: "Low", color: '#2C83B9' }],
  },
  {
    code: 'liquefaction', title: "Liquefaction susceptibility", family: 'geologic', mode: 'classified', file: '/geo/hazard/liquefaction.webp',
    corners: [[124.472777, 11.230167], [124.81703, 11.228197], [124.815006, 10.8887], [124.471149, 10.890611]],
    size: [2200, 2198], source: "READY Project liquefaction hazard map; PHIVOLCS-DOST 2007 data; revised Mar 2010; Luzon 1911 datum", custodian: "PHIVOLCS-DOST",
    issued: '2010-03-01', scale: '1:50,000', fit: "Luzon 1911 graticule crosses (14)", accuracy_m: 7,
    legend: [{ label: "High", color: '#FE0000' }, { label: "Moderate", color: '#AA66CD' }, { label: "Low", color: '#FFFF00' }],
    note: "Semi-detailed: for land use, emergency response and mitigation planning, not for site-specific evaluation.",
  },
  {
    code: 'eq_landslide', title: "Earthquake-induced landslide susceptibility", family: 'geologic', mode: 'classified', file: '/geo/hazard/eq_landslide.webp',
    corners: [[124.472777, 11.230203], [124.81703, 11.228191], [124.815006, 10.888653], [124.471149, 10.890607]],
    size: [2200, 2198], source: "READY Project earthquake-induced landslide hazard map; PHIVOLCS-DOST 2007 data; Luzon 1911 datum", custodian: "PHIVOLCS-DOST",
    issued: '2010-03-01', scale: '1:50,000', fit: "same printed layout as the ground rupture sheet", accuracy_m: 7,
    legend: [{ label: "High", color: '#FE0000' }, { label: "Moderate", color: '#AA66CD' }, { label: "Low", color: '#FFFF00' }],
  },
  {
    code: 'ground_rupture', title: "Ground rupture (active fault traces)", family: 'geologic', mode: 'classified', file: '/geo/hazard/ground_rupture.webp',
    corners: [[124.472777, 11.230203], [124.81703, 11.228191], [124.815006, 10.888653], [124.471149, 10.890607]],
    size: [2200, 2198], source: "READY Project ground rupture hazard map; PHIVOLCS-DOST 2007 data; revised Mar 2010; Luzon 1911 datum", custodian: "PHIVOLCS-DOST",
    issued: '2010-03-01', scale: '1:50,000', fit: "Luzon 1911 graticule crosses (14)", accuracy_m: 7,
    legend: [{ label: "Active fault (trace certain or approximate)", color: '#C80000' }],
    note: "The map recommends a buffer of at least 5 m on both sides of the fault trace or deformation zone.",
  },
  {
    code: 'shaking', title: "Ground shaking (PEIS)", family: 'geologic', mode: 'image', file: '/geo/hazard/shaking.webp',
    corners: [[124.451091, 11.254989], [124.898513, 11.253593], [124.896091, 10.843034], [124.44929, 10.844335]],
    size: [2200, 2032], source: "DOST-PHIVOLCS Ground Shaking Hazard Map of Ormoc City, Leyte, version 2 (GSH-2025-083738-02), August 2026", custodian: "PHIVOLCS-DOST",
    issued: '2026-08-01', scale: '1:60,000', fit: "fitted to the printed city boundary (affine)", accuracy_m: 79,
    legend: [{ label: "Intensity VIII or higher: very destructive to devastating", color: '#FF8080' }, { label: "Intensity VII: destructive", color: '#FFDFF4' }],
    note: "Shown as the published image: its colours are shaded over relief.",
  },
  {
    code: 'tsunami', title: "Tsunami inundation depth", family: 'geologic', mode: 'image', file: '/geo/hazard/tsunami.webp',
    corners: [[124.451982, 11.254996], [124.89858, 11.253586], [124.895273, 10.842787], [124.449295, 10.844102]],
    size: [2200, 2031], source: "DOST-PHIVOLCS Tsunami Hazard Map of Ormoc City, Leyte, version 3 (TSU-2023-083738-03), June 2024", custodian: "PHIVOLCS-DOST",
    issued: '2024-06-01', scale: '1:60,000', fit: "fitted to the printed city boundary (affine)", accuracy_m: 81,
    legend: [{ label: "Over 6 m", color: '#C97A7C' }, { label: "5 to 6 m", color: '#F08A8A' }, { label: "4 to under 5 m", color: '#D58EE6' }, { label: "3 to under 4 m", color: '#F7BDF0' }, { label: "2 to under 3 m", color: '#F9C98A' }, { label: "1 to under 2 m", color: '#F2EF6B' }, { label: "Under 1 m", color: '#FBF0D9' }],
    note: "Shown as the published image. Worst-case scenarios; a 2 m wave height is computed in Ormoc Bay.",
  },
];
