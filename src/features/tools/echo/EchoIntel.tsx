// Tools → ECHO → Evacuation intelligence (1.16.0, ADR-030): the City's hazard sheets (ADR-028), barangay exposure
// from the DDRiVE desk assessment (ADR-024) and the evacuation-centre inventory on one map, with centre suitability
// screening and route screening. Sheets are fitted pictures read at barangay scale; a screening flags what to check
// with field teams and never marks a centre or a route as safe. The map is not navigation.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Eraser, Maximize2, Minimize2, MousePointerClick, Route, ScanSearch } from 'lucide-react';
import { db } from '@/lib/db';
import { Badge, Button, Checkbox, Notice, PageHeader, Section, Select, Tabs } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import { ORMOC, basemapReady, baseStyle, ensureProtocol, plainStyle, token } from '@/features/eoc/map/base';
import { HAZARD_MAPS } from '@/features/eoc/map/hazardMaps';
import { identifyAt } from '@/features/eoc/map/identify';
import { classOf, rawValue, THEMES, type ThemeData, type ThemeKey } from '@/features/eoc/map/themes';
import { fmtDistance, pathLength, type LngLat } from '@/features/eoc/map/geodesy';
import { centreScreening, fmt, latestPerCentre, utilisation } from '@/domain/echo';
import { currentReportWindow } from '@/domain/eoc';
import { ECHO_TABS, PHASE, VERIFICATION, VERIFICATION_TONE } from './labels';
import { densify, severity, summariseRoute, type RouteFinding, type Severity } from './screening';

type Mode = 'select' | 'route';
type BgyFeature = { type: 'Feature'; properties: { psgc: string; name: string; area_km2: number }; geometry: unknown };
const SEV_TONE: Record<Severity, 'bad' | 'warn' | 'ok' | 'neutral' | 'info'> = { high: 'bad', moderate: 'warn', low: 'ok', none: 'neutral', unknown: 'info' };
const SEV_LABEL: Record<Severity, string> = { high: 'High', moderate: 'Moderate', low: 'Low', none: 'Not mapped', unknown: 'Check the sheet' };

export default function EchoIntel() {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [hasBase, setHasBase] = useState<boolean | null>(null);
  const [baseProblem, setBaseProblem] = useState<string | null>(null);
  const [bgy, setBgy] = useState<BgyFeature[] | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({ flood: true });
  const [theme, setTheme] = useState<ThemeKey>('none');
  const [mode, setMode] = useState<Mode>('select');
  const modeRef = useRef<Mode>(mode); modeRef.current = mode;
  const [route, setRoute] = useState<LngLat[]>([]);
  const [findings, setFindings] = useState<RouteFinding[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<{ id: string | null; at: LngLat; readings: { title: string; value: string; sev: Severity }[] } | null>(null);
  const [showTraining, setShowTraining] = useState(false);
  const [full, setFull] = useState(false);

  const data = useLiveQuery(async () => {
    const [centres, reports, activations, flood, hazards, priority, exposure] = await Promise.all([db.evacuation_centers.toArray(), db.camp_reports.toArray(),
      db.eoc_activations.toArray(), db.ddrive_flood.toArray(), db.ddrive_hazards.toArray(), db.ddrive_priority.toArray(), db.ddrive_exposure.toArray()]);
    const window = currentReportWindow(activations);
    const latest = new Map(latestPerCentre(reports, window.from).map((r) => [r.centre_id, r]));
    const themeData: ThemeData = { flood: new Map(flood.map((r) => [r.psgc, r])), hazards: new Map(hazards.map((r) => [r.psgc, r])),
      priority: new Map(priority.map((r) => [r.psgc, r])), exposure: new Map(exposure.map((r) => [r.psgc, r])) };
    return { centres, latest, themeData };
  }, []);
  const centres = useMemo(() => (data?.centres ?? []).filter((c) => c.lat !== null && c.verification_status !== 'superseded'
    && (showTraining || c.verification_status !== 'training')), [data, showTraining]);

  useEffect(() => {
    fetch('/geo/ormoc-barangays.geojson').then((r) => (r.ok ? r.json() : Promise.reject())).then((g: { features: BgyFeature[] }) => setBgy(g.features)).catch(() => setBgy([]));
  }, []);
  useEffect(() => { void basemapReady().then((p) => { setBaseProblem(p); setHasBase(p === null); }); }, []);
  useEffect(() => {
    if (!box.current || hasBase === null) return;
    ensureProtocol();
    const m = new maplibregl.Map({ container: box.current, style: hasBase ? baseStyle() : plainStyle(), center: ORMOC, zoom: 11, attributionControl: { compact: true }, cooperativeGestures: true });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    m.on('load', () => {
      for (const hm of [...HAZARD_MAPS].reverse()) {
        m.addSource(`hz-${hm.code}`, { type: 'image', url: hm.file, coordinates: hm.corners });
        m.addLayer({ id: `hz-${hm.code}`, type: 'raster', source: `hz-${hm.code}`, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.65, 'raster-fade-duration': 0 } });
      }
      m.addSource('bgy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never, promoteId: 'psgc' });
      m.addLayer({ id: 'bgy-fill', type: 'fill', source: 'bgy', paint: { 'fill-color': token('sunken'), 'fill-opacity': 0 } });
      m.addLayer({ id: 'bgy-line', type: 'line', source: 'bgy', paint: { 'line-color': token('ink'), 'line-width': 0.7, 'line-opacity': 0.6 } });
      m.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never });
      m.addLayer({ id: 'route-line', type: 'line', source: 'route', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': token('action'), 'line-width': 4, 'line-dasharray': [2, 1] } });
      m.addLayer({ id: 'route-flag', type: 'circle', source: 'route', filter: ['==', ['get', 'kind'], 'high'], paint: { 'circle-color': token('bad'), 'circle-radius': 4 } });
      m.addLayer({ id: 'route-pt', type: 'circle', source: 'route', filter: ['==', ['get', 'kind'], 'vertex'], paint: { 'circle-color': token('action'), 'circle-radius': 5, 'circle-stroke-width': 2, 'circle-stroke-color': token('surface') } });
      m.addSource('centres', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never });
      m.addLayer({ id: 'centres', type: 'circle', source: 'centres', paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 15, 11],
        'circle-color': ['match', ['get', 'state'], 'over', token('bad'), 'open', token('ok'), 'training', token('info'), token('action')],
        'circle-stroke-width': 2, 'circle-stroke-color': token('surface') } });
      if (hasBase) m.addLayer({ id: 'centre-label', type: 'symbol', source: 'centres', minzoom: 12.5,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
        paint: { 'text-color': token('ink'), 'text-halo-color': token('surface'), 'text-halo-width': 1.5 } });
      setReady(true);
    });
    m.on('error', (e) => { if (/pmtiles|404|Failed to fetch|NetworkError/i.test(String(e.error?.message ?? ''))) setBaseProblem('Part of the map could not be read.'); });
    m.on('click', (e: MapMouseEvent) => {
      const p: LngLat = [e.lngLat.lng, e.lngLat.lat];
      if (modeRef.current === 'route') { setRoute((r) => [...r, p]); setFindings(null); return; }
      const f = m.queryRenderedFeatures([e.point.x, e.point.y], { layers: ['centres'] })[0];
      const id = (f?.properties as { id?: string } | undefined)?.id ?? null;
      const at: LngLat = f ? ((f.geometry as unknown as { coordinates: LngLat }).coordinates) : p;
      void identifyAt(at, HAZARD_MAPS).then((rs) => setPicked({ id, at, readings: rs.map((r) => ({ title: r.map.title, value: r.value, sev: severity(r.map, r.value) })) }));
    });
    map.current = m;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => m.resize()) : null;
    ro?.observe(box.current);
    return () => { ro?.disconnect(); m.remove(); map.current = null; setReady(false); };
  }, [hasBase]);

  useEffect(() => { if (ready && bgy) (map.current!.getSource('bgy') as GeoJSONSource).setData({ type: 'FeatureCollection', features: bgy } as never); }, [ready, bgy]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const hm of HAZARD_MAPS) m.setLayoutProperty(`hz-${hm.code}`, 'visibility', on[hm.code] ? 'visible' : 'none');
  }, [ready, on]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !bgy || !data) return;
    if (theme === 'none') { m.setPaintProperty('bgy-fill', 'fill-opacity', 0); return; }
    const match: unknown[] = ['match', ['get', 'psgc']];
    for (const f of bgy) match.push(f.properties.psgc, classOf(theme, rawValue(theme, f.properties.psgc, data.themeData)).color);
    match.push(token('sunken'));
    m.setPaintProperty('bgy-fill', 'fill-color', match as never);
    m.setPaintProperty('bgy-fill', 'fill-opacity', 0.55);
  }, [ready, theme, bgy, data]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !data) return;
    const feats = centres.map((c) => {
      const r = data.latest.get(c.id);
      const u = utilisation(r?.persons ?? null, c.capacity_persons);
      const state = c.verification_status === 'training' ? 'training' : u !== null && u > 1 ? 'over' : r && r.phase !== 'closed' ? 'open' : 'idle';
      return { type: 'Feature', properties: { id: c.id, name: c.name, state }, geometry: { type: 'Point', coordinates: [c.lng, c.lat] } };
    });
    (m.getSource('centres') as GeoJSONSource).setData({ type: 'FeatureCollection', features: feats } as never);
  }, [ready, centres, data]);
  const [flags, setFlags] = useState<LngLat[]>([]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const feats: unknown[] = route.map((p) => ({ type: 'Feature', properties: { kind: 'vertex' }, geometry: { type: 'Point', coordinates: p } }));
    if (route.length > 1) feats.push({ type: 'Feature', properties: { kind: 'line' }, geometry: { type: 'LineString', coordinates: route } });
    for (const p of flags) feats.push({ type: 'Feature', properties: { kind: 'high' }, geometry: { type: 'Point', coordinates: p } });
    (m.getSource('route') as GeoJSONSource).setData({ type: 'FeatureCollection', features: feats } as never);
  }, [ready, route, flags]);
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  async function screenRoute() {
    if (route.length < 2) return;
    setBusy(true);
    const samples = densify(route, 50);
    const readings = await Promise.all(samples.map((p) => identifyAt(p, HAZARD_MAPS)));
    setFindings(summariseRoute(samples, readings));
    setFlags(samples.filter((_, i) => readings[i]!.some((r) => severity(r.map, r.value) === 'high')));
    setBusy(false);
  }
  async function toggleFull() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (frame.current?.requestFullscreen) await frame.current.requestFullscreen(); else setFull((f) => !f); }
    catch { setFull((f) => !f); }
  }
  const pickedCentre = picked?.id ? data?.centres.find((c) => c.id === picked.id) ?? null : null;
  const pickedReport = pickedCentre ? data?.latest.get(pickedCentre.id) ?? null : null;
  const anyHigh = findings?.some((f) => f.high > 0);

  return (
    <div className="mx-auto w-full max-w-[120rem] space-y-4 px-4 pb-28 pt-4 lg:px-6 lg:pb-12">
      <PageHeader title="ECHO" subtitle="Evacuation and Camp Handling Operations" />
      <Tabs items={ECHO_TABS} />
      {baseProblem && <Notice tone="info" title="Plain background">{baseProblem} The sheets, boundaries and centres still show.</Notice>}
      <div ref={frame} className={full ? 'fixed inset-0 z-50 flex flex-col gap-2 bg-surface p-2 sm:p-3' : 'space-y-2'}>
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Map tools">
          <Button variant={mode === 'select' ? 'primary' : 'secondary'} icon={MousePointerClick} aria-pressed={mode === 'select'} tip="Click a centre (or any point) to screen it against the hazard sheets" onClick={() => setMode('select')}>Screen a centre</Button>
          <Button variant={mode === 'route' ? 'primary' : 'secondary'} icon={Route} aria-pressed={mode === 'route'} tip="Click points along a proposed route, then screen it" onClick={() => setMode('route')}>Draw a route</Button>
          {mode === 'route' && <Button variant="secondary" icon={ScanSearch} busy={busy} disabled={route.length < 2} tip="Read every hazard sheet about every 50 m along the route" onClick={() => void screenRoute()}>Screen route</Button>}
          {route.length > 0 && <Button variant="quiet" icon={Eraser} tip="Remove the route" onClick={() => { setRoute([]); setFindings(null); setFlags([]); }}>Clear route</Button>}
          <span className="flex-1" />
          {route.length > 1 && <span className="font-data text-sm">{fmtDistance(pathLength(route))}</span>}
          <Button variant="secondary" icon={full ? Minimize2 : Maximize2} aria-pressed={full} tip={full ? 'Leave full screen (Esc)' : 'Show the map on the whole screen'} onClick={() => void toggleFull()}>{full ? 'Exit full screen' : 'Full screen'}</Button>
        </div>
        <div ref={box} className={full ? 'min-h-0 w-full flex-1 overflow-hidden rounded-card border border-line' : 'h-[min(72dvh,56rem)] min-h-[22rem] w-full overflow-hidden rounded-card border border-line sm:min-h-[26rem]'}
          role="application" aria-label="Evacuation intelligence map of Ormoc City" />
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-ok align-middle" aria-hidden />Open centre</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-bad align-middle" aria-hidden />Over capacity</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-action align-middle" aria-hidden />In the inventory, no open report</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-info align-middle" aria-hidden />Training site</span>
          <span>Red dots on a route: a sheet reads high there.</span>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <div className="space-y-4">
          {picked && mode === 'select' && (
            <Section title={pickedCentre ? pickedCentre.name : 'Point screening'}>
              {pickedCentre && (() => {
                const s = centreScreening(pickedCentre);
                return (
                  <div className="mb-3 space-y-2">
                    <div className="flex flex-wrap gap-2"><Badge tone={VERIFICATION_TONE[pickedCentre.verification_status]}>{VERIFICATION[pickedCentre.verification_status]}</Badge><Badge tone={s.tone}>{s.label}</Badge>
                      {pickedReport && <Badge>{PHASE[pickedReport.phase]}: {fmt(pickedReport.persons)} / {fmt(pickedCentre.capacity_persons)}</Badge>}</div>
                    {s.notes.length > 0 && <ul className="list-disc pl-5 text-sm">{s.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
                    <Link className="text-sm font-semibold underline" to={`/tools/echo/camps/${pickedCentre.id}`} {...tip('Open this centre in Camp management')}>Open in Camp management</Link>
                  </div>
                );
              })()}
              <p className="text-sm text-muted">{picked.at[1].toFixed(5)}° N, {picked.at[0].toFixed(5)}° E. Read from each sheet's colour; good to its fit error.</p>
              <ul className="mt-2 divide-y divide-line text-sm">
                {picked.readings.map((r) => <li key={r.title} className="flex justify-between gap-3 py-1.5"><span>{r.title}</span>
                  <span className="flex items-center gap-2 text-right"><span className="text-muted">{r.value}</span><Badge tone={SEV_TONE[r.sev]}>{SEV_LABEL[r.sev]}</Badge></span></li>)}
              </ul>
              {picked.readings.some((r) => r.sev === 'high') && <Notice tone="warn">A sheet reads high here. Confirm with the CPDO, the City Engineer and the field team before using this site; for a real centre, record the screening in the inventory.</Notice>}
            </Section>
          )}
          {mode === 'route' && (
            <Section title="Route screening">
              {route.length < 2 ? <p className="text-sm text-muted">Click at least two points on the map along the proposed route, then Screen route.</p> : !findings ? <p className="text-sm text-muted">{route.length} points, {fmtDistance(pathLength(route))}. Select Screen route.</p> : (
                <>
                  <Notice tone={anyHigh ? 'warn' : 'info'}>{anyHigh ? 'Part of this route crosses high classes on at least one sheet. Choose another route or confirm passage with the field team before movement.'
                    : 'No high class read along this route. That does not make it safe: check road access, bridges and current conditions with field teams.'}</Notice>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-line text-left text-muted"><th className="py-1">Sheet</th><th className="py-1 text-right">High</th><th className="py-1 text-right">Moderate</th><th className="py-1 text-right">First high at</th></tr></thead>
                    <tbody className="divide-y divide-line">{findings.map((f) => <tr key={f.sheet}><td className="py-1">{f.title}</td><td className="py-1 text-right font-data">{f.high}</td>
                      <td className="py-1 text-right font-data">{f.moderate}</td><td className="py-1 text-right font-data">{f.firstHighAt === null ? '—' : fmtDistance(f.firstHighAt)}</td></tr>)}</tbody>
                  </table>
                  <p className="mt-1 text-xs text-muted">Counts of points sampled about every 50 m along the line drawn. Straight lines between your clicks, not the road network.</p>
                </>
              )}
            </Section>
          )}
          <Section title="Hazard sheets">
            <div className="flex flex-wrap gap-2">
              {HAZARD_MAPS.map((h) => <Checkbox key={h.code} checked={!!on[h.code]} onChange={() => setOn((o) => ({ ...o, [h.code]: !o[h.code] }))} tip={`${h.source}. Fit error about ${h.accuracy_m} m.`}>{h.title}</Checkbox>)}
            </div>
            <p className="mt-2 text-xs text-muted">The same sheets as Assess → Hazard maps, which has legends, opacity, measuring and export.</p>
          </Section>
        </div>
        <div className="space-y-4">
          <Section title="Barangay exposure">
            <Select value={theme} onChange={(e) => setTheme(e.target.value as ThemeKey)} aria-label="Barangay colouring" {...tip('Colour each barangay by a DDRiVE desk-assessment value')}>
              {THEMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
            <p className="mt-2 text-xs text-muted">DDRiVE desk assessment, pending validation. A blank is "Not assessed", never zero.</p>
          </Section>
          <Section title={`Evacuation centres on the map (${centres.length})`}>
            <label className="flex items-center gap-2 text-sm" {...tip('Show the training sites used in exercises')}><input type="checkbox" className="h-4 w-4" checked={showTraining} onChange={() => setShowTraining(!showTraining)} />Show training sites</label>
            {data && data.centres.filter((c) => c.lat === null && c.verification_status !== 'superseded').length > 0 && (
              <p className="mt-2 text-sm text-warn">{data.centres.filter((c) => c.lat === null && c.verification_status !== 'superseded').length} centre(s) have no location yet. Add it in Camp management.</p>
            )}
            {centres.length === 0 && <p className="mt-2 text-sm text-muted">No centre with a location. The inventory is in <Link className="font-semibold underline" to="/tools/echo/camps">Camp management</Link>.</p>}
          </Section>
        </div>
        <div className="space-y-4 lg:col-span-2 2xl:col-span-1">
          <Section title="How to use this map">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li><strong className="text-ink">Screen a centre</strong>: click a centre (or any point) to read every hazard sheet there, with the centre's inventory screening.</li>
              <li><strong className="text-ink">Draw a route</strong>: click points along the proposed route, then Screen route. ECHO samples the sheets about every 50 m and marks high readings in red.</li>
              <li>Tick hazard sheets to show them; colour barangays by DDRiVE exposure. Full screen keeps the tools with the map.</li>
              <li>Sheets are fitted pictures for barangay-level awareness. A screening is not a safety certificate and the map is not navigation: routes and sites are confirmed by authorised field teams.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
