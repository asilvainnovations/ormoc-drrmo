/**
 * Flood intelligence: where flooding would hurt Ormoc, from what the City already holds. A map of the 85 barangays
 * by DDRiVE flood class over the City's flood sheet, a watch list, a benefit-cost screen for flood measures, and the
 * official warning sources. Reference and planning support only: not a forecast, warning, evacuation trigger or
 * replacement for PAGASA, the CDRRMO or the approved EOC procedures.
 */
import { lazy, Suspense, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { List, Loading, Notice, PageHeader, Section } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import { Chips, Tile } from '@/features/eoc/kit';
import { classCounts } from '@/domain/floodScreen';
import { useFloodRows } from './flood/useFloodRows';
import { BarangayPanel } from './flood/BarangayPanel';
import { WatchTab } from './flood/WatchTab';
import { PlanTab } from './flood/PlanTab';

// The map library is large; it loads only when this page opens.
const FloodMap = lazy(() => import('./flood/FloodMap'));

const OUTBOUND = [
  { name: 'PAGASA — Visayas regional forecast', by: 'DOST-PAGASA', url: 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd', use: 'Official regional forecasts and weather advisories.' },
  { name: 'PAGASA weather', by: 'DOST-PAGASA', url: 'https://www.pagasa.dost.gov.ph/weather', use: 'National weather and tropical cyclone products.' },
  { name: 'HazardHunterPH', by: 'GeoRiskPH', url: 'https://hazardhunter.georisk.gov.ph/map', use: 'Official multi-hazard screening for the Philippines.' },
  { name: 'UP NOAH — Know Your Hazards', by: 'UP NOAH Center', url: 'https://noah.up.edu.ph/know-your-hazards', use: 'Supporting hazard exploration; confirm official advisories before action.' },
  { name: 'Copernicus EMS — On-Demand Mapping', by: 'European Union Copernicus Programme', url: 'https://mapping.emergency.copernicus.eu/', use: 'Satellite-based emergency mapping on institutional request.' },
] as const;

type View = 'map' | 'watch' | 'plan' | 'sources';
const VIEWS: { value: View; label: string }[] = [{ value: 'map', label: 'Map' }, { value: 'watch', label: 'Watch list' }, { value: 'plan', label: 'Compare measures' }, { value: 'sources', label: 'Official sources' }];

export function FloodIntelligencePage() {
  const data = useFloodRows();
  const [view, setView] = useState<View>('map');
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const counts = useMemo(() => classCounts(rows), [rows]);
  const by = (c: string) => counts.find((x) => x.cls === c);
  const top = (by('Very high')?.barangays ?? 0) + (by('High')?.barangays ?? 0);
  const people = (by('Very high')?.people ?? 0) + (by('High')?.people ?? 0);
  const unknown = (by('Very high')?.unknown ?? 0) + (by('High')?.unknown ?? 0);
  const pick = (psgc: string | null) => { setSelected(psgc); if (psgc) setView('map'); };

  return (
    <div className="page space-y-5">
      <PageHeader title="Flood intelligence" back="/tools" subtitle="Which barangays flood, how many people live there, and what to compare before spending. Reference data, not a live forecast." />
      <Notice tone="warn" title="Operational safety">
        Follow current PAGASA bulletins, City CDRRMO instructions and approved EOC procedures. A flood class or an exposed-population figure is not, by itself, an evacuation order or declaration threshold.
      </Notice>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Very high" tone="bad" value={by('Very high')?.barangays ?? 0} hint="barangays" />
        <Tile label="High" tone="warn" value={by('High')?.barangays ?? 0} hint="barangays" />
        <Tile label="People in those two classes" value={people.toLocaleString('en-PH')} hint={unknown ? `${unknown} of ${top} barangays have no figure` : `across ${top} barangays`} />
        <Tile label="Not assessed" value={by('Not assessed')?.barangays ?? 0} hint="barangays without a DDRiVE class" />
      </div>
      <Chips value={view} onChange={setView} options={VIEWS} label="Flood intelligence view" />

      {view === 'map' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_21rem]">
          <Suspense fallback={<Loading />}><FloodMap rows={rows} selected={selected} onSelect={setSelected} /></Suspense>
          <BarangayPanel rows={rows} flood={data?.flood ?? new Map()} selected={selected} onSelect={setSelected} />
        </div>
      )}
      {view === 'watch' && <WatchTab rows={rows} onPick={pick} />}
      {view === 'plan' && <PlanTab />}
      {view === 'sources' && (
        <Section title="Official and supporting sources">
          <List>{OUTBOUND.map((t) => <li key={t.url} className="border-b border-line py-3 last:border-0"><a href={t.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 font-medium text-action hover:underline" {...tip(`Open ${t.name} in a new tab`)}><ExternalLink className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{t.name}<span className="mt-0.5 block text-xs font-normal text-muted">{t.by}</span><span className="mt-1 block text-sm font-normal text-muted">{t.use}</span></span></a></li>)}</List>
          <p className="mt-3 text-sm text-muted">The City's other hazard sheets, with identify and measure tools, are in <Link className="font-medium text-action underline" to="/assess/hazard-maps">Hazard maps</Link>. Flood classes come from DDRiVE and the City's flood sheet (MGB Region VIII, mapped by CPDO-GIS); check each sheet's date and limits before operational use.</p>
        </Section>
      )}
      <p><Link className="text-sm font-medium text-action underline" to="/eoc/risk">Open City Risk Intelligence →</Link></p>
    </div>
  );
}
