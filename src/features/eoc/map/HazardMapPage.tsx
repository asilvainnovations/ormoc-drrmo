// EOC → Hazard maps (ADR-028): the City's official hazard sheets over the barangays, with the QGIS tools the EOC
// uses — layers, opacity and order, categorised barangay colouring, identify, measure, coordinates, exposure summary
// and a PNG export that carries title, sources and accuracy. Barangay-level analysis is GeoAnalyticsPH, embedded. Sheets are pictures fitted to their own grid: read them
// at barangay level, never for a site decision. Nothing here sets a hazard threshold.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowDown, ArrowUp, ChevronDown, Crosshair, Download, ExternalLink, Info, LocateFixed, Ruler, Square } from 'lucide-react';
import { db } from '@/lib/db';
import { Badge, Button, ButtonAnchor, Checkbox, Notice, PageHeader, Section, Select, Tabs } from '@/components/ui';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { tip } from '@/components/Tooltip';
import { EOC_TABS } from '../labels';
import { ORMOC, basemapReady, baseStyle, ensureProtocol, plainStyle, token } from './base';
import { HAZARD_MAPS, type HazardMap } from './hazardMaps';
import { classOf, exposureSummary, rawValue, THEMES, type ThemeData, type ThemeKey } from './themes';
import { fmtArea, fmtDistance, pathLength, polygonArea, toUtm51, type LngLat } from './geodesy';
import { identifyAt } from './identify';
import { GEOANALYTICS_URL, nearest } from './places';
import { POINT_KIND, POINT_STATUS } from '../labels';

type Tool = 'identify' | 'distance' | 'area';
type BgyFeature = { type: 'Feature'; properties: { psgc: string; name: string; area_km2: number }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } };
interface Identified { lngLat: LngLat; barangay: { psgc: string; name: string; area_km2: number } | null; sheets: { map: HazardMap; value: string }[] }

const BGY_URL = '/geo/ormoc-barangays.geojson';
const FAMILY_LABEL: Record<HazardMap['family'], string> = { hydromet: 'Hydrometeorological hazards', geologic: 'Geological hazards' };

export default function HazardMapPage() {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [hasBase, setHasBase] = useState<boolean | null>(null);
  const [baseProblem, setBaseProblem] = useState<string | null>(null);
  const [bgy, setBgy] = useState<BgyFeature[] | null>(null);
  const [bgyProblem, setBgyProblem] = useState<string | null>(null);
  // Sheets: draw order (first = top) and per-sheet visibility and opacity.
  const [order, setOrder] = useState<string[]>(HAZARD_MAPS.map((m) => m.code));
  const [on, setOn] = useState<Record<string, boolean>>({ flood: true });
  const [opacity, setOpacity] = useState<Record<string, number>>({});
  const [theme, setTheme] = useState<ThemeKey>('none');
  const [tool, setTool] = useState<Tool>('identify');
  const [pts, setPts] = useState<LngLat[]>([]);
  const [found, setFound] = useState<Identified | null>(null);
  const [cursor, setCursor] = useState<LngLat | null>(null);
  const toolRef = useRef<Tool>(tool);
  toolRef.current = tool;

  const data = useLiveQuery(async (): Promise<ThemeData> => {
    const [flood, hazards, priority, exposure] = await Promise.all([db.ddrive_flood.toArray(), db.ddrive_hazards.toArray(), db.ddrive_priority.toArray(), db.ddrive_exposure.toArray()]);
    return { flood: new Map(flood.map((r) => [r.psgc, r])), hazards: new Map(hazards.map((r) => [r.psgc, r])),
      priority: new Map(priority.map((r) => [r.psgc, r])), exposure: new Map(exposure.map((r) => [r.psgc, r])) };
  }, []);

  const places = useLiveQuery(async () => (await db.geo_reference_points.toArray()).filter((x) => x.verification_status !== 'superseded')
    .map((x) => ({ id: x.id, name: x.name, kind: POINT_KIND[x.kind], lat: x.lat, lng: x.lng, status: POINT_STATUS[x.verification_status] })), []);
  const [locProblem, setLocProblem] = useState<string | null>(null);
  const [geoOpen, setGeoOpen] = useState(false);

  // ---------------------------------------------------------------- boundaries (static file, cached offline)
  useEffect(() => {
    fetch(BGY_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((g: { features: BgyFeature[] }) => setBgy(g.features))
      .catch(() => setBgyProblem('The barangay boundaries could not be loaded. Open this page once while online so they are kept for offline use.'));
  }, []);

  // ---------------------------------------------------------------- map set-up (once)
  useEffect(() => { void basemapReady().then((p) => { setBaseProblem(p); setHasBase(p === null); }); }, []);
  useEffect(() => {
    if (!box.current || hasBase === null) return;
    ensureProtocol();
    const m = new maplibregl.Map({ container: box.current, style: hasBase ? baseStyle() : plainStyle(), center: ORMOC, zoom: 10.6,
      attributionControl: { compact: true }, cooperativeGestures: true, canvasContextAttributes: { preserveDrawingBuffer: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    m.on('load', () => {
      // Sheets go in reverse order so the first in the list draws on top; all start hidden.
      for (const hm of [...HAZARD_MAPS].reverse()) {
        m.addSource(`hz-${hm.code}`, { type: 'image', url: hm.file, coordinates: hm.corners });
        m.addLayer({ id: `hz-${hm.code}`, type: 'raster', source: `hz-${hm.code}`, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.75, 'raster-fade-duration': 0 } });
      }
      m.addSource('bgy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never, promoteId: 'psgc' });
      m.addLayer({ id: 'bgy-fill', type: 'fill', source: 'bgy', paint: { 'fill-color': token('sunken'), 'fill-opacity': 0 } });
      m.addLayer({ id: 'bgy-line', type: 'line', source: 'bgy', paint: { 'line-color': token('ink'), 'line-width': 0.8, 'line-opacity': 0.7 } });
      m.addLayer({ id: 'bgy-pick', type: 'line', source: 'bgy', filter: ['==', ['get', 'psgc'], ''], paint: { 'line-color': token('focus'), 'line-width': 3 } });
      if (hasBase) m.addLayer({ id: 'bgy-label', type: 'symbol', source: 'bgy', minzoom: 12,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
        paint: { 'text-color': token('ink'), 'text-halo-color': token('surface'), 'text-halo-width': 1.5 } });
      m.addSource('measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never });
      m.addLayer({ id: 'measure-fill', type: 'fill', source: 'measure', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': token('action'), 'fill-opacity': 0.15 } });
      m.addLayer({ id: 'measure-line', type: 'line', source: 'measure', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': token('action'), 'line-width': 2.5, 'line-dasharray': [2, 1] } });
      m.addLayer({ id: 'measure-pt', type: 'circle', source: 'measure', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': token('action'), 'circle-radius': 5, 'circle-stroke-width': 2, 'circle-stroke-color': token('surface') } });
      setReady(true);
    });
    m.on('error', (e) => {
      const msg = String(e.error?.message ?? '');
      if (/pmtiles|404|Failed to fetch|NetworkError/i.test(msg)) setBaseProblem('Part of the map could not be read. Sheets you opened before still show offline.');
    });
    m.on('mousemove', (e) => setCursor([e.lngLat.lng, e.lngLat.lat]));
    m.on('click', (e: MapMouseEvent) => {
      const p: LngLat = [e.lngLat.lng, e.lngLat.lat];
      if (toolRef.current === 'identify') void identify(m, p, e.point);
      else setPts((cur) => [...cur, p]);
    });
    map.current = m;
    return () => { m.remove(); map.current = null; setReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBase]);

  const visible = useMemo(() => order.map((c) => HAZARD_MAPS.find((h) => h.code === c)!).filter((h) => on[h.code]), [order, on]);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  async function identify(m: maplibregl.Map, p: LngLat, point: { x: number; y: number }) {
    const f = m.queryRenderedFeatures([point.x, point.y], { layers: ['bgy-fill'] })[0];
    const barangay = f ? (f.properties as Identified['barangay']) : null;
    m.setFilter('bgy-pick', ['==', ['get', 'psgc'], barangay?.psgc ?? '']);
    const sheets = await identifyAt(p, visibleRef.current.length ? visibleRef.current : HAZARD_MAPS);
    setFound({ lngLat: p, barangay, sheets });
  }

  function locateMe() {
    setLocProblem(null);
    if (!navigator.geolocation) { setLocProblem('This device cannot share its location.'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const m = map.current;
      if (!m) return;
      const p: LngLat = [pos.coords.longitude, pos.coords.latitude];
      setTool('identify');
      m.flyTo({ center: p, zoom: 14 });
      m.once('moveend', () => void identify(m, p, m.project(p)));
    }, () => setLocProblem('The location could not be read. Allow location access, or click the map instead.'), { enableHighAccuracy: true, timeout: 15000 });
  }

  // ---------------------------------------------------------------- keep the map in step with the panel
  useEffect(() => { if (ready && bgy) (map.current!.getSource('bgy') as GeoJSONSource).setData({ type: 'FeatureCollection', features: bgy } as never); }, [ready, bgy]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const hm of HAZARD_MAPS) {
      m.setLayoutProperty(`hz-${hm.code}`, 'visibility', on[hm.code] ? 'visible' : 'none');
      m.setPaintProperty(`hz-${hm.code}`, 'raster-opacity', (opacity[hm.code] ?? 75) / 100);
    }
    // Draw order: move each sheet below the one listed before it (the first stays just under the boundaries).
    let above = 'bgy-fill';
    for (const code of order) { m.moveLayer(`hz-${code}`, above); above = `hz-${code}`; }
  }, [ready, on, opacity, order]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !bgy || !data) return;
    if (theme === 'none') { m.setPaintProperty('bgy-fill', 'fill-opacity', 0); return; }
    const match: unknown[] = ['match', ['get', 'psgc']];
    for (const f of bgy) match.push(f.properties.psgc, classOf(theme, rawValue(theme, f.properties.psgc, data)).color);
    match.push(token('sunken'));
    m.setPaintProperty('bgy-fill', 'fill-color', match as never);
    m.setPaintProperty('bgy-fill', 'fill-opacity', 0.6);
  }, [ready, theme, bgy, data]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const feats: unknown[] = pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }));
    if (pts.length > 1) feats.push({ type: 'Feature', properties: {}, geometry: tool === 'area' && pts.length > 2
      ? { type: 'Polygon', coordinates: [[...pts, pts[0]]] } : { type: 'LineString', coordinates: pts } });
    (m.getSource('measure') as GeoJSONSource).setData({ type: 'FeatureCollection', features: feats } as never);
  }, [ready, pts, tool]);
  useEffect(() => { setPts([]); }, [tool]);

  const summary = useMemo(() => (bgy && data && theme !== 'none' ? exposureSummary(theme, bgy.map((f) => f.properties.psgc), data) : []), [bgy, data, theme]);
  const measured = tool === 'distance' ? (pts.length > 1 ? fmtDistance(pathLength(pts)) : null)
    : tool === 'area' ? (pts.length > 2 ? `${fmtArea(polygonArea(pts))} (perimeter ${fmtDistance(pathLength([...pts, pts[0]!]))})` : null) : null;

  function zoomTo(psgc: string) {
    const f = bgy?.find((b) => b.properties.psgc === psgc);
    const m = map.current;
    if (!f || !m) return;
    const flat = JSON.stringify(f.geometry.coordinates).match(/-?\d+\.\d+/g)!.map(Number);
    const xs = flat.filter((_, i) => i % 2 === 0), ys = flat.filter((_, i) => i % 2 === 1);
    m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 40, maxZoom: 15 });
    m.setFilter('bgy-pick', ['==', ['get', 'psgc'], psgc]);
  }

  function move(code: string, d: -1 | 1) {
    setOrder((o) => { const i = o.indexOf(code), j = i + d; if (j < 0 || j >= o.length) return o; const n = [...o]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  }

  function exportPng() {
    const m = map.current;
    if (!m) return;
    const src = m.getCanvas();
    const pad = 16, head = 56, foot = 22 + 18 * Math.max(1, visible.length + (theme !== 'none' ? 1 : 0));
    const c = document.createElement('canvas');
    c.width = src.width + pad * 2; c.height = src.height + head + foot;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, pad, head);
    g.fillStyle = '#1F2A37'; g.font = 'bold 20px sans-serif';
    g.fillText('Ormoc City hazard map (MODE, EOC)', pad, 26);
    g.font = '13px sans-serif';
    g.fillText(`Printed ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}. Sheets are fitted pictures: for barangay-level awareness, not site decisions.`, pad, 46);
    let y = head + src.height + 20;
    for (const h of visible) { g.fillText(`${h.title}: ${h.source}. Fit error about ${h.accuracy_m} m.`, pad, y); y += 18; }
    if (theme !== 'none') g.fillText(`Barangay colouring: ${THEMES.find((t) => t.key === theme)!.label} (DDRiVE desk assessment, pending validation). Boundaries: OCHA COD-AB / PSA PSGC.`, pad, y);
    const a = document.createElement('a');
    a.download = `ormoc-hazard-map-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  }

  const families = (['hydromet', 'geologic'] as const).map((fam) => ({ fam, maps: order.map((c) => HAZARD_MAPS.find((h) => h.code === c)!).filter((h) => h.family === fam) }));
  const utm = cursor ? toUtm51(cursor[0], cursor[1]) : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Hazard Maps" subtitle="The City's official hazard sheets over the 85 barangays, with layer, identify, measure and export tools. Read them at barangay level: each sheet is a printed map fitted to its own grid." />
      <Tabs items={EOC_TABS} />
      {baseProblem && <Notice tone="info" title="Plain background">{baseProblem} The sheets and boundaries still show.</Notice>}
      {bgyProblem && <Notice tone="warn">{bgyProblem}</Notice>}

      <div className="grid gap-4 lg:grid-cols-[23rem_1fr]">
        <div className="space-y-4">
          <Section title="Hazard layers">
            <p className="text-sm text-muted">Tick a sheet to show it. The first in a group draws on top; use the arrows to change the order.</p>
            {families.map(({ fam, maps }) => (
              <Collapsible key={fam} defaultOpen className="mt-3">
                <CollapsibleTrigger className="flex min-h-tap w-full items-center justify-between rounded-control px-2 font-semibold text-ink hover:bg-sky-soft" {...tip(`Show or hide the ${FAMILY_LABEL[fam].toLowerCase()} list`)}>
                  {FAMILY_LABEL[fam]} <ChevronDown className="h-4 w-4" aria-hidden />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  {maps.map((h) => (
                    <div key={h.code} className="rounded-control border border-line p-3">
                      <Checkbox checked={!!on[h.code]} onChange={() => setOn((o) => ({ ...o, [h.code]: !o[h.code] }))}
                        tip={h.note ?? `${h.source}. Fit error about ${h.accuracy_m} m.`}>
                        <span className="font-medium">{h.title}</span>{h.mode === 'image' && <Badge tone="info" className="ml-2">As published</Badge>}
                      </Checkbox>
                      {on[h.code] && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-20 text-sm text-muted">Opacity</span>
                            <Slider value={[opacity[h.code] ?? 75]} min={10} max={100} step={5} thumbLabel={`Opacity of ${h.title}`} thumbTip="Drag to make the sheet more or less see-through"
                              onValueChange={([v]) => setOpacity((o) => ({ ...o, [h.code]: v! }))} />
                            <span className="w-10 text-right text-sm tabular-nums">{opacity[h.code] ?? 75}%</span>
                          </div>
                          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                            {h.legend.map((l) => <li key={l.label} className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-line" style={{ background: l.color }} aria-hidden />{l.label}</li>)}
                          </ul>
                          <p className="text-xs text-muted">{h.source}. Custodian: {h.custodian}. Scale {h.scale}; fit error about {h.accuracy_m} m.</p>
                          <div className="flex gap-2">
                            <Button variant="quiet" icon={ArrowUp} tip="Draw this sheet above the one listed before it" onClick={() => move(h.code, -1)}>Up</Button>
                            <Button variant="quiet" icon={ArrowDown} tip="Draw this sheet below the one listed after it" onClick={() => move(h.code, 1)}>Down</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </Section>

          <Section title="Barangay colouring">
            <Select value={theme} onChange={(e) => setTheme(e.target.value as ThemeKey)} aria-label="Barangay colouring" {...tip('Colour each barangay by a DDRiVE desk-assessment value')}>
              {THEMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
            {theme !== 'none' && (
              <>
                <p className="mt-2 text-xs text-muted">{THEMES.find((t) => t.key === theme)!.tip}. Desk assessment, pending validation; a blank is "Not assessed", never zero.</p>
                <Separator className="my-3" />
                <h3 className="text-sm font-semibold">Exposure summary</h3>
                <table className="mt-1 w-full text-sm">
                  <thead><tr className="text-left text-muted"><th className="py-1 font-normal">Class</th><th className="py-1 text-right font-normal">Barangays</th><th className="py-1 text-right font-normal">Population 2024</th></tr></thead>
                  <tbody>
                    {summary.map((r) => (
                      <tr key={r.label} className="border-t border-line">
                        <td className="py-1"><span className="mr-1.5 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: r.color }} aria-hidden />{r.label}</td>
                        <td className="py-1 text-right tabular-nums">{r.barangays}</td>
                        <td className="py-1 text-right tabular-nums">{r.population.toLocaleString('en-PH')}{r.unknownPop ? ` (+${r.unknownPop} not reported)` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <Separator className="my-3" />
            <Select defaultValue="" onChange={(e) => e.target.value && zoomTo(e.target.value)} aria-label="Zoom to a barangay" {...tip('Zoom the map to one barangay')}>
              <option value="">Zoom to a barangay…</option>
              {(bgy ?? []).slice().sort((a, b) => a.properties.name.localeCompare(b.properties.name)).map((f) => <option key={f.properties.psgc} value={f.properties.psgc}>{f.properties.name}</option>)}
            </Select>
          </Section>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Map tools">
            <Button variant={tool === 'identify' ? 'primary' : 'secondary'} icon={Info} aria-pressed={tool === 'identify'} tip="Click the map to see the barangay and the class of each shown sheet there" onClick={() => setTool('identify')}>Identify</Button>
            <Button variant={tool === 'distance' ? 'primary' : 'secondary'} icon={Ruler} aria-pressed={tool === 'distance'} tip="Click points on the map to measure a distance along the ground" onClick={() => setTool('distance')}>Distance</Button>
            <Button variant={tool === 'area' ? 'primary' : 'secondary'} icon={Square} aria-pressed={tool === 'area'} tip="Click three or more points to measure an area" onClick={() => setTool('area')}>Area</Button>
            <Button variant="secondary" icon={LocateFixed} tip="Show the hazards where you are now (uses this device's location; nothing is saved)" onClick={locateMe} disabled={!ready}>My location</Button>
            {tool !== 'identify' && pts.length > 0 && <Button variant="quiet" tip="Remove the measuring points" onClick={() => setPts([])}>Clear</Button>}
            <span className="flex-1" />
            <Button variant="secondary" icon={Download} tip="Save the current view as a PNG with title, sources and accuracy" onClick={exportPng} disabled={!ready}>Export PNG</Button>
          </div>
          <div ref={box} className="h-[65vh] min-h-[420px] w-full overflow-hidden rounded-card border border-line" role="application" aria-label="Hazard map of Ormoc City" />
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted" aria-live="polite">
            <span className="inline-flex items-center gap-1"><Crosshair className="h-4 w-4" aria-hidden />
              {cursor ? `${cursor[1].toFixed(5)}° N, ${cursor[0].toFixed(5)}° E · UTM 51N ${Math.round(utm!.e)} E, ${Math.round(utm!.n)} N` : 'Move over the map for coordinates'}</span>
            {measured && <span className="font-semibold text-ink">{tool === 'distance' ? 'Distance' : 'Area'}: {measured}</span>}
            {tool !== 'identify' && !measured && <span>Click the map to add points.</span>}
          </div>
          {locProblem && <Notice tone="warn">{locProblem}</Notice>}
          {found && tool === 'identify' && (
            <Section title={found.barangay ? `Barangay ${found.barangay.name}` : 'Outside the barangay boundaries'}>
              <p className="text-sm text-muted">{found.lngLat[1].toFixed(5)}° N, {found.lngLat[0].toFixed(5)}° E{found.barangay ? ` · PSGC ${found.barangay.psgc} · ${found.barangay.area_km2} km²` : ''}</p>
              {found.barangay && data && theme !== 'none' && (
                <p className="mt-1 text-sm">{THEMES.find((t) => t.key === theme)!.label}: <strong>{String(rawValue(theme, found.barangay.psgc, data) ?? 'Not assessed')}</strong></p>
              )}
              <ul className="mt-2 divide-y divide-line text-sm">
                {found.sheets.map(({ map: h, value }) => (
                  <li key={h.code} className="flex justify-between gap-3 py-1.5"><span>{h.title}</span><span className="text-right font-medium">{value === 'Not mapped here' || value === 'No class shown' || value.startsWith('Could') || value.startsWith('Not readable') ? value : `about ${value}`}</span></li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Read from the sheet colour at this point; good to the fit error of each sheet. Check the official map before a site decision.</p>
              <Separator className="my-3" />
              <h3 className="font-semibold">Nearest EOC places</h3>
              {places && places.length ? (
                <ul className="mt-1 divide-y divide-line text-sm">
                  {nearest(found.lngLat, places).map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span>{x.name} <span className="text-muted">({x.kind})</span></span>
                      <span className="flex items-center gap-2"><Badge tone={x.status === 'Field-verified' ? 'ok' : 'warn'}>{x.status}</Badge><span className="tabular-nums">{x.km.toFixed(1)} km</span></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">No reference points yet. Add them on the Map tab.</p>}
              <p className="mt-1 text-xs text-muted">Straight-line distance, not the road route.</p>
            </Section>
          )}
          <Section title="Barangay hazard assessment (GeoAnalyticsPH)">
            <p className="max-w-prose text-sm text-muted">GeoAnalyticsPH, from DOST-PHIVOLCS GeoRiskPH, gives the official barangay-level analysis: population prone and safe by sex and age, affected facilities and land area for each hazard. In its map choose Region VIII (Eastern Visayas), then the province, City of Ormoc and the barangay{found?.barangay ? <> (here: <strong className="text-ink">{found.barangay.name}</strong>)</> : ''}, pick a hazard and select Submit.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!geoOpen && <Button variant="secondary" tip="Load GeoAnalyticsPH inside this page (it uses data; it is a separate site)" onClick={() => setGeoOpen(true)}>Show GeoAnalyticsPH here</Button>}
              <ButtonAnchor href={GEOANALYTICS_URL} icon={ExternalLink} tip="Open GeoAnalyticsPH in a new tab">Open in a new tab</ButtonAnchor>
            </div>
            {geoOpen && (
              <>
                <iframe src={GEOANALYTICS_URL} title="GeoAnalyticsPH barangay hazard assessment" className="mt-3 h-[75vh] min-h-[520px] w-full rounded-card border border-line bg-surface"
                  allow="geolocation" referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />
                <p className="mt-2 text-xs text-muted">If the frame stays blank or asks you to sign in, GeoAnalyticsPH may not allow use inside another site: use Open in a new tab.</p>
              </>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
