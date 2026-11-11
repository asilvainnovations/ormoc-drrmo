// Basemap set-up shared by the Geo-COP map and the Hazard maps page (ADR-015, ADR-028).
import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
// Bundle the worker with the app (same origin), so the Content-Security-Policy needs no blob: worker.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { Protocol } from 'pmtiles';
import { layers as basemapLayers, namedFlavor } from '@protomaps/basemaps';
import { env } from '@/lib/env';

// Ormoc City: the EOC reference point the City shared (6 Nov 2026) is the default centre.
export const ORMOC: [number, number] = [124.6043, 11.0139];
let protocolAdded = false;
/** Register the PMTiles protocol and the worker once per page load. */
export function ensureProtocol() {
  if (protocolAdded) return;
  maplibregl.setWorkerUrl(workerUrl); maplibregl.addProtocol('pmtiles', new Protocol().tile); protocolAdded = true;
}

/** A design token as a colour MapLibre can read ("r g b" → "rgb(r,g,b)"). */
export const token = (name: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return v ? `rgb(${v.split(/\s+/).join(',')})` : '#888';
};
// 1.11: follow the theme the person chose (Light, Dark or System; see components/theme-provider.tsx).
export const dark = () => {
  const c = document.documentElement.classList;
  if (c.contains('dark')) return true;
  if (c.contains('light')) return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

export function baseStyle(): StyleSpecification {
  const base = env.basemapBase;
  const flavor = dark() ? 'dark' : 'light';
  return {
    version: 8,
    glyphs: `${base}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${base}/sprites/v4/${flavor}`,
    sources: { protomaps: { type: 'vector', url: `pmtiles://${base}/ormoc.pmtiles`, attribution: '© OpenStreetMap contributors' } },
    layers: basemapLayers('protomaps', namedFlavor(flavor), { lang: 'en' }),
  };
}

/** Without the City basemap: a plain background, so points and layers still show and nothing else is fetched. */
export function plainStyle(): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': token('sunken') } }] };
}

/** Is the City's PMTiles file there? Reads its first bytes once (the file starts with "PMTiles"). */
export async function basemapReady(): Promise<string | null> {
  if (!env.basemapBase) return 'The basemap address is not set.';
  if (!navigator.onLine) return 'The basemap needs a connection.';
  try {
    const r = await fetch(`${env.basemapBase}/ormoc.pmtiles`, { headers: { Range: 'bytes=0-6' } });
    if (!r.ok) return 'The City basemap has not been uploaded yet.';
    const magic = new TextDecoder().decode(new Uint8Array(await r.arrayBuffer()).slice(0, 7));
    return magic === 'PMTiles' ? null : 'The basemap file is not a PMTiles file.';
  } catch { return 'The City basemap could not be reached.'; }
}

