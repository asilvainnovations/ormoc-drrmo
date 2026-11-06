// Coordinates for people and for map apps. No map tiles are loaded inside the app: the CSP
// stays as it is, and maps open in the phone's own app or a new tab (ADR-011, ADR-015).

/** "11.013896° N, 124.604287° E" (6 decimals is about 0.1 m). */
export function fmtLatLng(lat: number, lng: number, decimals = 6): string {
  return `${Math.abs(lat).toFixed(decimals)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(decimals)}° ${lng >= 0 ? 'E' : 'W'}`;
}

/** One coordinate in degrees, minutes and seconds: 11°00′50.0″ N. */
export function toDms(value: number, axis: 'lat' | 'lng'): string {
  const hemi = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
  // Work in tenths of a second so rounding never shows 60.0″.
  const tenths = Math.round(Math.abs(value) * 36000);
  const deg = Math.floor(tenths / 36000);
  const min = Math.floor((tenths % 36000) / 600);
  const sec = (tenths % 600) / 10;
  return `${deg}°${String(min).padStart(2, '0')}′${sec.toFixed(1).padStart(4, '0')}″ ${hemi}`;
}

export const fmtDms = (lat: number, lng: number) => `${toDms(lat, 'lat')}, ${toDms(lng, 'lng')}`;

/** Plain "lat, lng" for pasting into a radio log, SMS or another app. */
export const plainLatLng = (lat: number, lng: number) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

const q = (lat: number, lng: number) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

export const googleMapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${q(lat, lng)}`;
export const googleDirectionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${q(lat, lng)}`;
export const osmUrl = (lat: number, lng: number) =>
  `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=18/${lat.toFixed(6)}/${lng.toFixed(6)}`;
/** Opens the phone's map app (Android and most map apps). Works without a connection if the app has offline maps. */
export const geoUri = (lat: number, lng: number, label: string) =>
  `geo:${q(lat, lng)}?q=${q(lat, lng)}(${encodeURIComponent(label)})`;

export interface KmlPoint { id: string | null; name: string | null; lat: number; lng: number; alt: number | null }

/** Reads the Point placemarks of a KML file. Enough for the files this app ships; not a full KML parser. */
export function kmlPoints(kml: string): KmlPoint[] {
  const out: KmlPoint[] = [];
  for (const m of kml.matchAll(/<Placemark\b([^>]*)>([\s\S]*?)<\/Placemark>/g)) {
    const attrs = m[1] ?? '', body = m[2] ?? '';
    const coords = /<Point\b[^>]*>[\s\S]*?<coordinates>\s*([^<]+?)\s*<\/coordinates>/.exec(body)?.[1];
    if (!coords) continue;
    const [lng, lat, alt] = coords.split(',').map((x) => Number(x.trim()));
    if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      id: /\bid="([^"]*)"/.exec(attrs)?.[1] ?? null,
      name: /<name>([\s\S]*?)<\/name>/.exec(body)?.[1]?.trim() ?? null,
      lat, lng, alt: alt !== undefined && Number.isFinite(alt) ? alt : null,
    });
  }
  return out;
}

/** True if the point lies inside Ormoc City's rough bounding box (a guard against swapped lat/lng). */
export const inOrmoc = (lat: number, lng: number) => lat > 10.85 && lat < 11.3 && lng > 124.5 && lng < 124.9;
