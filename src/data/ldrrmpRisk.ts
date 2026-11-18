// Risk profile figures from the Ormoc City DRRM Ten-Year Plan 2023-2032 (GeoRisk PH exposure analysis, pp. 36-37).
// Copied as printed: Figure 9 (total potential damages per hazard).
export const LDRRMP_SOURCE = 'Ormoc City DRRM Ten-Year Plan 2023–2032, pp. 36–37 (GeoRisk PH analysis)';

/** Total potential damages per hazard, in billions of pesos (Figure 9). */
export const POTENTIAL_DAMAGES_BN: { hazard: string; billion: number }[] = [
  { hazard: 'Flood', billion: 222.4 },
  { hazard: 'Rain-induced landslides', billion: 205.5 },
  { hazard: 'Liquefaction', billion: 189.3 },
  { hazard: 'Tsunami', billion: 59 },
  { hazard: 'Storm surge', billion: 33.3 },
  { hazard: 'Earthquake-induced landslides', billion: 12 },
];

