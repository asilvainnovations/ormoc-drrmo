// Geo-COP layers (ADR-015, SOP 6-GIS-01). KML, KMZ and GeoJSON are read on the device and turned into GeoJSON,
// so the map never runs a file it was given and the server only stores data. Coordinates stay in EPSG:4326.
import { unzipSync, strFromU8 } from 'fflate';

export type Position = [number, number] | [number, number, number];
export type Geometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'LineString'; coordinates: Position[] }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'GeometryCollection'; geometries: Geometry[] };
export interface Feature { type: 'Feature'; id?: string; geometry: Geometry; properties: Record<string, string> }
export interface FeatureCollection { type: 'FeatureCollection'; features: Feature[] }

export interface ParsedLayer {
  geojson: FeatureCollection;
  featureCount: number;
  bbox: [number, number, number, number] | null;   // west, south, east, north
  /** What was dropped or doubtful, in plain words (shown before upload). */
  warnings: string[];
}

const MAX_FEATURES = 20_000;

/** "lon,lat[,alt] lon,lat …" → positions. Throws on a value that is not a coordinate. */
export function parseCoordinates(text: string): Position[] {
  return text.trim().split(/\s+/).filter(Boolean).map((tuple) => {
    const n = tuple.split(',').map(Number);
    const [lng, lat, alt] = n;
    if (n.length < 2 || !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lat!) > 90 || Math.abs(lng!) > 180) {
      throw new Error(`"${tuple.slice(0, 40)}" is not a longitude,latitude pair`);
    }
    return alt !== undefined && Number.isFinite(alt) ? [lng!, lat!, alt] : [lng!, lat!];
  });
}

const local = (el: Element) => el.localName;
const kids = (el: Element, name: string) => Array.from(el.children).filter((c) => local(c) === name);
const kid = (el: Element, name: string) => kids(el, name)[0];
const text = (el: Element | undefined) => (el?.textContent ?? '').trim();

/** Description text without markup: KML descriptions are often HTML, and we never render that HTML. */
function plain(s: string): string {
  if (!s) return '';
  const doc = new DOMParser().parseFromString(`<body>${s}</body>`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000);
}

function geometryOf(el: Element): Geometry | null {
  switch (local(el)) {
    case 'Point': {
      const c = parseCoordinates(text(kid(el, 'coordinates')));
      return c.length ? { type: 'Point', coordinates: c[0]! } : null;
    }
    case 'LineString': {
      const c = parseCoordinates(text(kid(el, 'coordinates')));
      return c.length >= 2 ? { type: 'LineString', coordinates: c } : null;
    }
    case 'LinearRing': return null;
    case 'Polygon': {
      const ring = (b: Element | undefined) => {
        const r = b && kid(b, 'LinearRing');
        return r ? parseCoordinates(text(kid(r, 'coordinates'))) : [];
      };
      const outer = ring(kid(el, 'outerBoundaryIs'));
      if (outer.length < 4) return null;
      return { type: 'Polygon', coordinates: [outer, ...kids(el, 'innerBoundaryIs').map(ring).filter((r) => r.length >= 4)] };
    }
    case 'MultiGeometry': {
      const parts = Array.from(el.children).map(geometryOf).filter((g): g is Geometry => g !== null);
      if (parts.length === 0) return null;
      return parts.length === 1 ? parts[0]! : { type: 'GeometryCollection', geometries: parts };
    }
    default: return null;
  }
}

const GEOMETRY_TAGS = ['Point', 'LineString', 'Polygon', 'MultiGeometry'];

/** KML text → GeoJSON. Placemarks without a usable geometry are skipped and counted in the warnings. */
export function kmlToGeoJson(kml: string): ParsedLayer {
  const doc = new DOMParser().parseFromString(kml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This file is not valid KML.');
  if (doc.documentElement.localName !== 'kml') throw new Error('This file is not KML: it has no <kml> root.');
  const features: Feature[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  const marks = Array.from(doc.getElementsByTagNameNS('*', 'Placemark'));
  for (const pm of marks) {
    if (features.length >= MAX_FEATURES) { warnings.push(`Only the first ${MAX_FEATURES} features were read.`); break; }
    const gEl = Array.from(pm.children).find((c) => GEOMETRY_TAGS.includes(local(c)));
    let geometry: Geometry | null = null;
    try { geometry = gEl ? geometryOf(gEl) : null; } catch (e) { warnings.push(`${text(kid(pm, 'name')) || 'A placemark'}: ${(e as Error).message}.`); }
    if (!geometry) { skipped++; continue; }
    const properties: Record<string, string> = {};
    const name = text(kid(pm, 'name'));
    if (name) properties.name = name.slice(0, 200);
    const desc = plain(text(kid(pm, 'description')));
    if (desc) properties.description = desc;
    const ext = kid(pm, 'ExtendedData');
    if (ext) {
      for (const d of kids(ext, 'Data')) {
        const k = d.getAttribute('name');
        if (k && Object.keys(properties).length < 50) properties[k.slice(0, 60)] = text(kid(d, 'value')).slice(0, 500);
      }
    }
    const id = pm.getAttribute('id');
    features.push({ type: 'Feature', ...(id ? { id } : {}), geometry, properties });
  }
  if (skipped) warnings.push(`${skipped} placemark${skipped === 1 ? '' : 's'} had no point, line or area and ${skipped === 1 ? 'was' : 'were'} left out.`);
  if (marks.length === 0) warnings.push('The file has no placemarks.');
  const geojson: FeatureCollection = { type: 'FeatureCollection', features };
  return { geojson, featureCount: features.length, bbox: bboxOf(geojson), warnings };
}

/** KMZ (zipped KML) → the KML inside it (doc.kml, or the first .kml file). */
export function kmzToKml(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes, { filter: (f) => f.name.toLowerCase().endsWith('.kml') }); } catch { throw new Error('This KMZ file could not be opened.'); }
  const names = Object.keys(files);
  const main = names.find((n) => n.toLowerCase() === 'doc.kml') ?? names[0];
  if (!main) throw new Error('This KMZ file has no KML inside it.');
  return strFromU8(files[main]!);
}

function validGeometry(g: unknown): g is Geometry {
  if (!g || typeof g !== 'object') return false;
  const t = (g as { type?: string }).type;
  return ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection'].includes(t ?? '');
}

/** A GeoJSON file → a FeatureCollection, keeping only features with a geometry and flat text properties. */
export function readGeoJson(textIn: string): ParsedLayer {
  let data: unknown;
  try { data = JSON.parse(textIn); } catch { throw new Error('This file is not valid GeoJSON.'); }
  const d = data as { type?: string; features?: unknown[]; geometry?: unknown };
  const raw = d.type === 'FeatureCollection' && Array.isArray(d.features) ? d.features
    : d.type === 'Feature' ? [d] : validGeometry(d) ? [{ type: 'Feature', geometry: d, properties: {} }] : null;
  if (!raw) throw new Error('This file is not GeoJSON: expected a FeatureCollection.');
  const warnings: string[] = [];
  const features: Feature[] = [];
  for (const f of raw.slice(0, MAX_FEATURES)) {
    const ff = f as { geometry?: unknown; properties?: Record<string, unknown>; id?: unknown };
    if (!validGeometry(ff.geometry)) continue;
    const properties: Record<string, string> = {};
    for (const [k, v] of Object.entries(ff.properties ?? {}).slice(0, 50)) {
      if (v === null || v === undefined) continue;
      properties[k.slice(0, 60)] = (typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 500);
    }
    features.push({ type: 'Feature', ...(ff.id !== undefined ? { id: String(ff.id) } : {}), geometry: ff.geometry, properties });
  }
  if (raw.length > MAX_FEATURES) warnings.push(`Only the first ${MAX_FEATURES} features were read.`);
  if (features.length < Math.min(raw.length, MAX_FEATURES)) warnings.push(`${Math.min(raw.length, MAX_FEATURES) - features.length} features had no geometry and were left out.`);
  const geojson: FeatureCollection = { type: 'FeatureCollection', features };
  const bbox = bboxOf(geojson);
  if (bbox && (Math.abs(bbox[0]) > 180 || Math.abs(bbox[1]) > 90 || Math.abs(bbox[2]) > 180 || Math.abs(bbox[3]) > 90)) {
    throw new Error('The coordinates are not longitude and latitude. Export the layer in EPSG:4326 (WGS 84) and try again.');
  }
  return { geojson, featureCount: features.length, bbox, warnings };
}

/** Read a picked file by its extension. */
export async function parseLayerFile(file: File): Promise<ParsedLayer> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'kml') return kmlToGeoJson(await file.text());
  if (ext === 'kmz') return kmlToGeoJson(kmzToKml(new Uint8Array(await file.arrayBuffer())));
  if (ext === 'geojson' || ext === 'json') return readGeoJson(await file.text());
  throw new Error('Choose a KML, KMZ or GeoJSON file.');
}

function eachPosition(g: unknown, fn: (p: number[]) => void): void {
  const geom = g as { type: string; coordinates?: unknown; geometries?: unknown[] };
  if (geom.type === 'GeometryCollection') { (geom.geometries ?? []).forEach((x) => eachPosition(x, fn)); return; }
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') fn(c as number[]);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(geom.coordinates);
}

export function bboxOf(fc: FeatureCollection): [number, number, number, number] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const f of fc.features) eachPosition(f.geometry, ([x, y]) => {
    if (x! < w) w = x!; if (x! > e) e = x!; if (y! < s) s = y!; if (y! > n) n = y!;
  });
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

/** The first point in a parsed layer, for recording a reference point (EOC-GIS-REF) from a KML placemark. */
export function firstPoint(layer: ParsedLayer): { name: string; lat: number; lng: number; altitude: number | null } | null {
  const f = layer.geojson.features.find((x) => x.geometry.type === 'Point');
  if (!f || f.geometry.type !== 'Point') return null;
  const [lng, lat, alt] = f.geometry.coordinates;
  return { name: f.properties.name ?? '', lat, lng, altitude: alt ?? null };
}
