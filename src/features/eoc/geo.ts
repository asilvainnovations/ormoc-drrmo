// Geo-COP actions (ADR-015, EOC Module SOP 6-GIS-01). Points and layers are captured offline like any record;
// field verification, marking a layer official and superseding are authority edits (online).
import { db } from '@/lib/db';
import { queueUpload, save, updateOnline } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/lib/ids';
import type { ParsedLayer } from '@/domain/kml';
import type { GeoLayer, GeoLayerGroup, GeoPointKind, GeoReferencePoint } from '@/types';

export const layerCode = (title: string) =>
  (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^([^a-z])/, 'l-$1').slice(0, 41) || 'layer').padEnd(2, 'x');

const safeName = (n: string) => n.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);

export interface NewLayer {
  title: string; layer_group: GeoLayerGroup; source: string; custodian_office_id: string | null; issued_on: string | null;
  validation_status: 'reported' | 'preliminary' | 'field_verified'; access_class: 'internal' | 'restricted'; scale: string | null;
  update_frequency: string | null; note: string | null;
}

/** Save a layer's record, then queue its GeoJSON and the original file for upload to the private `geo` bucket. */
export async function addLayer(meta: NewLayer, parsed: ParsedLayer, original: File, userId: string | null): Promise<string> {
  const id = uuid();
  const base = safeName(original.name.replace(/\.[^.]+$/, '')) || 'layer';
  const storage_path = `${id}/${base}.geojson`;
  const original_path = `${id}/${safeName(original.name)}`;
  const row: GeoLayer & { _new: true } = {
    _new: true, id, code: layerCode(meta.title), ...meta, crs: 'EPSG:4326', storage_path, original_path, file_name: original.name,
    feature_count: parsed.featureCount, bbox: parsed.bbox, status: 'current', superseded_by: null, uploaded_by: userId, version: 1,
  };
  await save('geo_layers', row, `Map layer: ${meta.title}`);
  const gj = new File([JSON.stringify(parsed.geojson)], `${base}.geojson`, { type: 'application/geo+json' });
  await queueUpload(gj, storage_path, uuid(), 'geo');
  await queueUpload(original, original_path, uuid(), 'geo');
  return id;
}

const cache = new Map<string, unknown>();
/** The layer's GeoJSON: the copy still waiting on this device, or a five-minute signed link from the bucket. */
export async function loadLayer(l: GeoLayer): Promise<unknown> {
  if (!l.storage_path) throw new Error('This layer has no map data.');
  if (cache.has(l.id)) return cache.get(l.id);
  const waiting = await db.outbox.where('kind').equals('upload').filter((o) => o.path === l.storage_path).first();
  let text: string;
  if (waiting?.fileId) {
    const f = await db.files.get(waiting.fileId);
    if (!f) throw new Error('The layer file is no longer on this device.');
    text = await f.blob.text();
  } else {
    const { data, error } = await supabase.storage.from('geo').createSignedUrl(l.storage_path, 300);
    if (error || !data) throw new Error(navigator.onLine ? 'This layer is not available to your role, or its file has not arrived yet.' : 'Opening this layer needs a connection.');
    const res = await fetch(data.signedUrl);
    if (!res.ok) throw new Error('The layer file could not be read.');
    text = await res.text();
  }
  const gj = JSON.parse(text) as unknown;
  cache.set(l.id, gj);
  return gj;
}

export async function addPoint(p: { code: string; name: string; kind: GeoPointKind; lat: number; lng: number; altitude_m: number | null; source: string; note: string | null }, userId: string | null) {
  const row: GeoReferencePoint & { _new: true } = {
    _new: true, id: uuid(), ...p, verification_status: 'pending_field_validation', verified_by: null, verified_at: null,
    superseded_by: null, vault_document_id: null, created_by: userId, version: 1,
  };
  await save('geo_reference_points', row, `Reference point: ${p.name}`);
}

export const verifyPoint = (p: GeoReferencePoint) =>
  updateOnline('geo_reference_points', p, { verification_status: 'field_verified' }, 'Recording a field verification');
export const supersedePoint = (p: GeoReferencePoint) =>
  updateOnline('geo_reference_points', p, { verification_status: 'superseded' }, 'Superseding a point');
export const markOfficial = (l: GeoLayer) => updateOnline('geo_layers', l, { validation_status: 'official' }, 'Marking a layer official');
export const supersedeLayer = (l: GeoLayer) => updateOnline('geo_layers', l, { status: 'superseded' }, 'Superseding a layer');

/** "11.01389600057808" → number in range, or null. */
export function parseCoord(v: string, max: number): number | null {
  const n = Number(v.trim());
  return v.trim() !== '' && Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}
