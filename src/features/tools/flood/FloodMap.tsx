// Flood map: the City's flood sheet under the 85 barangays, each coloured by its DDRiVE flood class. Click a barangay
// to select it. Loaded lazily (the map library is large). Sheets are pictures fitted to their own grid: read them at
// barangay level, never for a site decision.
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ORMOC, basemapReady, baseStyle, ensureProtocol, plainStyle, token } from '@/features/eoc/map/base';
import { HAZARD_MAPS } from '@/features/eoc/map/hazardMaps';
import { CLASS_STYLE } from '@/features/eoc/map/themes';
import { Notice } from '@/components/ui';
import { Slider } from '@/components/ui/slider';
import { tip } from '@/components/Tooltip';
import clsx from 'clsx';
import type { FloodClass, FloodRow } from '@/domain/floodScreen';

const BGY_URL = '/geo/ormoc-barangays.geojson';
const SHEETS = HAZARD_MAPS.filter((h) => h.code === 'flood' || h.code === 'storm_surge');
type Feature = { type: 'Feature'; properties: { psgc: string; name: string }; geometry: unknown };

export default function FloodMap({ rows, selected, onSelect }: { rows: FloodRow[]; selected: string | null; onSelect: (psgc: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [hasBase, setHasBase] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [bgy, setBgy] = useState<Feature[] | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({ flood: true });
  const [opacity, setOpacity] = useState(70);
  const pick = useRef(onSelect);
  pick.current = onSelect;

  useEffect(() => {
    fetch(BGY_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((g: { features: Feature[] }) => setBgy(g.features))
      .catch(() => setProblem('The barangay boundaries could not be loaded. Open this page once while online so they are kept for offline use.'));
  }, []);
  useEffect(() => { void basemapReady().then((p) => setHasBase(p === null)); }, []);

  useEffect(() => {
    if (!box.current || hasBase === null) return;
    ensureProtocol();
    const m = new maplibregl.Map({ container: box.current, style: hasBase ? baseStyle() : plainStyle(), center: ORMOC, zoom: 10.4, attributionControl: { compact: true }, cooperativeGestures: true });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      for (const hm of [...SHEETS].reverse()) {
        m.addSource(`hz-${hm.code}`, { type: 'image', url: hm.file, coordinates: hm.corners });
        m.addLayer({ id: `hz-${hm.code}`, type: 'raster', source: `hz-${hm.code}`, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.7, 'raster-fade-duration': 0 } });
      }
      m.addSource('bgy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never, promoteId: 'psgc' });
      m.addLayer({ id: 'bgy-fill', type: 'fill', source: 'bgy', paint: { 'fill-color': token('sunken'), 'fill-opacity': 0.45 } });
      m.addLayer({ id: 'bgy-line', type: 'line', source: 'bgy', paint: { 'line-color': token('ink'), 'line-width': 0.8, 'line-opacity': 0.7 } });
      m.addLayer({ id: 'bgy-pick', type: 'line', source: 'bgy', filter: ['==', ['get', 'psgc'], ''], paint: { 'line-color': token('focus'), 'line-width': 3 } });
      if (hasBase) m.addLayer({ id: 'bgy-label', type: 'symbol', source: 'bgy', minzoom: 12, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
        paint: { 'text-color': token('ink'), 'text-halo-color': token('surface'), 'text-halo-width': 1.5 } });
      setReady(true);
    });
    m.on('click', (e: MapMouseEvent) => {
      const f = m.queryRenderedFeatures([e.point.x, e.point.y], { layers: ['bgy-fill'] })[0];
      pick.current(f ? String((f.properties as { psgc: string }).psgc) : null);
    });
    m.on('mouseenter', 'bgy-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'bgy-fill', () => { m.getCanvas().style.cursor = ''; });
    map.current = m;
    return () => { m.remove(); map.current = null; setReady(false); };
  }, [hasBase]);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => map.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => { if (ready && bgy) (map.current!.getSource('bgy') as GeoJSONSource).setData({ type: 'FeatureCollection', features: bgy } as never); }, [ready, bgy]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const hm of SHEETS) {
      m.setLayoutProperty(`hz-${hm.code}`, 'visibility', on[hm.code] ? 'visible' : 'none');
      m.setPaintProperty(`hz-${hm.code}`, 'raster-opacity', opacity / 100);
    }
  }, [ready, on, opacity]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !bgy) return;
    const byPsgc = new Map(rows.map((r) => [r.psgc, r.cls]));
    const match: unknown[] = ['match', ['get', 'psgc']];
    for (const f of bgy) match.push(f.properties.psgc, CLASS_STYLE[byPsgc.get(f.properties.psgc) ?? 'Not assessed']?.color ?? CLASS_STYLE['Not assessed']!.color);
    match.push(CLASS_STYLE['Not assessed']!.color);
    m.setPaintProperty('bgy-fill', 'fill-color', match as never);
    // With a sheet showing, the barangays turn see-through so the sheet reads through.
    m.setPaintProperty('bgy-fill', 'fill-opacity', Object.values(on).some(Boolean) ? 0.28 : 0.6);
  }, [ready, bgy, rows, on]);
  useEffect(() => { if (ready) map.current!.setFilter('bgy-pick', ['==', ['get', 'psgc'], selected ?? '']); }, [ready, selected]);

  const legend: FloodClass[] = ['Very high', 'High', 'Moderate', 'Low', 'Not indicated', 'Not assessed'];
  return (
    <div className="space-y-2">
      {problem && <Notice tone="warn" title="Map">{problem}</Notice>}
      <div className="flex flex-wrap items-center gap-2">
        {SHEETS.map((h) => (
          <button key={h.code} type="button" aria-pressed={!!on[h.code]} onClick={() => setOn((o) => ({ ...o, [h.code]: !o[h.code] }))} {...tip(`${h.title}: ${h.source}`)}
            className={clsx('min-h-tap rounded-full border px-4 text-sm font-bold', on[h.code] ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:border-sky')}>
            {h.code === 'flood' ? 'Flood sheet' : 'Storm surge sheet'}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted" {...tip('How strongly the City sheet shows over the map')}>Sheet opacity
          <Slider className="w-32" min={10} max={100} step={5} value={[opacity]} onValueChange={(v) => setOpacity(v[0] ?? 70)} aria-label="Sheet opacity" />
        </label>
      </div>
      <div ref={box} role="img" aria-label="Map of Ormoc barangays coloured by flood class" className="h-[28rem] w-full overflow-hidden rounded-control border border-line bg-sunken lg:h-[34rem]" />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Barangay colours">
        {legend.map((c) => <li key={c} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-line" style={{ background: CLASS_STYLE[c]?.color }} aria-hidden />{c}</li>)}
      </ul>
    </div>
  );
}
