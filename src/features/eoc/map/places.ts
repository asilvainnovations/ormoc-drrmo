// Nearest EOC places to a point on the Hazard maps page (straight-line distance, not the road route).
import { distance, type LngLat } from './geodesy';

export interface PlacePoint { id: string; name: string; kind: string; lat: number; lng: number; status: string }
/** The nearest places to a point, closest first. */
export function nearest(p: LngLat, places: PlacePoint[], n = 5) {
  return places.map((x) => ({ ...x, km: distance(p, [x.lng, x.lat]) / 1000 })).sort((a, b) => a.km - b.km).slice(0, n);
}

/** GeoAnalyticsPH (DOST-PHIVOLCS GeoRiskPH): barangay-level hazard, exposure and population analysis. */
export const GEOANALYTICS_URL = 'https://geoanalytics.georisk.gov.ph/';
