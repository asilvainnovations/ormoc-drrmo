/**
 * Flood intelligence tool — local source-aligned flood exposure plus official
 * external warning and mapping services. This is a static reference data view,
 * not a forecast, warning, evacuation trigger or replacement for PAGASA/CDRRMO.
 */
import { ExternalLink, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, List, ListRow, Notice, PageHeader, Section } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import { ORMOC_FLOOD_EXPOSURE, FLOOD_EXPOSURE_AS_OF } from '@/domain/floodExposure';

const MAPS = [
  { id:'flood', title:'Flood Hazard Map', file:'ormoc-city-flood-hazard-map.webp', desc:'Flood susceptibility map for Ormoc City.' },
  { id:'rain-landslide', title:'Rain-Induced Landslide Hazard Map', file:'ormoc-city-rain-induced-landslide-hazard-map.webp', desc:'Rain-induced landslide susceptibility.' },
  { id:'slope', title:'Slope Map', file:'ormoc-city-slope-map.webp', desc:'Terrain slope classes.' },
  { id:'topography', title:'Topographic Map', file:'ormoc-city-topography-map.webp', desc:'City topographic reference.' },
  { id:'tsunami', title:'Tsunami Hazard Map', file:'ormoc-city-tsunami-hazard-map.webp', desc:'Tsunami inundation hazard reference.' },
  { id:'eq-landslide', title:'Earthquake-Induced Landslide Hazard Map', file:'ormoc-city-earthquake-induced-landslide-hazard-map.webp', desc:'Earthquake-induced landslide susceptibility.' },
  { id:'ground-rupture', title:'Ground Rupture Hazard Map', file:'ormoc-city-ground-rupture-hazard-map.webp', desc:'Ground rupture reference map.' },
  { id:'ground-shaking', title:'Ground Shaking Hazard Map', file:'ormoc-city-ground-shaking-hazard-map.webp', desc:'Ground shaking intensity reference map.' },
  { id:'landslide', title:'Landslide Susceptibility Map', file:'ormoc-city-landslide-hazard-map.webp', desc:'Landslide susceptibility classes.' },
  { id:'liquefaction', title:'Liquefaction Hazard Map', file:'ormoc-city-liquefaction-hazard-map.webp', desc:'Liquefaction hazard reference map.' },
  { id:'zoning', title:'Zoning Map', file:'ormoc-city-zoning-map.webp', desc:'City land-use and zoning reference.' },
  { id:'boundary', title:'Political Boundary Map', file:'ormoc-city-political-boundary-map.webp', desc:'Ormoc City political and barangay boundary reference.' },
  { id:'surge-1', title:'Storm Surge Advisory 1 — 2 metres', file:'ormoc-city-storm-surge-advisory-1-map.webp', desc:'Storm surge scenario map at 2 metres.' },
  { id:'surge-2', title:'Storm Surge Advisory 2 — 3 metres', file:'ormoc-city-storm-surge-advisory-2-map.webp', desc:'Storm surge scenario map at 3 metres.' },
  { id:'surge-3', title:'Storm Surge Advisory 3 — 4 metres', file:'ormoc-city-storm-surge-advisory-3-map.webp', desc:'Storm surge scenario map at 4 metres.' },
  { id:'surge-4', title:'Storm Surge Advisory 4 — 5 metres', file:'ormoc-city-storm-surge-advisory-4-map.webp', desc:'Storm surge scenario map at 5 metres.' },
] as const;

const OUTBOUND = [
  { name:'PAGASA — Visayas regional forecast', by:'DOST-PAGASA', url:'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd', use:'Official regional forecasts and weather advisories.' },
  { name:'PAGASA weather', by:'DOST-PAGASA', url:'https://www.pagasa.dost.gov.ph/weather', use:'National weather and tropical cyclone products.' },
  { name:'HazardHunterPH', by:'GeoRiskPH', url:'https://hazardhunter.georisk.gov.ph/map', use:'Official multi-hazard screening for the Philippines.' },
  { name:'UP NOAH — Know Your Hazards', by:'UP NOAH Center', url:'https://noah.up.edu.ph/know-your-hazards', use:'Supporting hazard exploration; confirm official advisories before action.' },
  { name:'Copernicus EMS — On-Demand Mapping', by:'European Union Copernicus Programme', url:'https://mapping.emergency.copernicus.eu/', use:'Satellite-based emergency mapping on institutional request.' },
] as const;

const pct = (value: number) => `${value.toFixed(3)}%`;

export function FloodIntelligencePage() {
  const sorted = [...ORMOC_FLOOD_EXPOSURE].sort((a, b) => b.exposurePercent - a.exposurePercent);
  return (
    <div className="page space-y-5">
      <PageHeader title="Flood intelligence" back="/tools" subtitle="Ormoc City flood exposure reference, city hazard maps and official warning sources. Static assessment data only; not a live forecast." />
      <Notice tone="warn" title="Operational safety">
        Follow current PAGASA bulletins, City CDRRMO instructions and approved EOC procedures. A mapped susceptibility class or exposed-population estimate is not, by itself, an evacuation order or declaration threshold.
      </Notice>
      <Section title={`Barangay flood exposure — ${FLOOD_EXPOSURE_AS_OF}`}>
        <p className="mb-3 text-sm text-muted">Eight reference barangays from the submitted Population_Prone_Flood reports and DDRiVE source records. Denominators follow each source report and are kept distinct from 2024 POPCEN population baselines.</p>
        <div className="overflow-x-auto rounded-control border border-line">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="bg-sunken text-left"><tr><th className="p-3">Barangay</th><th className="p-3 text-right">Flood-prone</th><th className="p-3 text-right">Report base</th><th className="p-3 text-right">Share</th><th className="p-3">Classes</th></tr></thead>
            <tbody>{sorted.map((r) => <tr key={r.psgc} className="border-t border-line">
              <td className="p-3 font-semibold">{r.name}<span className="block text-xs font-normal text-muted">PSGC {r.psgc}</span></td>
              <td className="p-3 text-right tabular-nums">{r.pronePopulation.toLocaleString('en-PH')}</td>
              <td className="p-3 text-right tabular-nums">{r.denominator.toLocaleString('en-PH')}</td>
              <td className="p-3 text-right tabular-nums">{pct(r.exposurePercent)}</td>
              <td className="p-3"><div className="flex flex-wrap gap-1">{r.classes.map((c) => <Badge key={c.name}>{c.name}: {c.population.toLocaleString('en-PH')}</Badge>)}</div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Population exposure estimates are not flood depth or inundated land area. Boundary and model validation are recorded in the City's supplied barangay hazard-assessment and boundary reference workbooks.</p>
      </Section>
      <Section title="Barangay age and sex detail — Lao">
        {(() => { const lao = ORMOC_FLOOD_EXPOSURE.find((r) => r.name === 'Lao')!; return <>
          <p className="mb-2 text-sm text-muted">Source: {lao.source}. Values retain the source's age bands and separate male/female, prone/not-prone columns.</p>
          <div className="overflow-x-auto rounded-control border border-line"><table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-sunken"><tr>{['Age group','Male not prone','Male prone','Female not prone','Female prone'].map((h) => <th key={h} className="p-2 text-right first:text-left">{h}</th>)}</tr></thead>
            <tbody>{lao.ageSex.map((r) => <tr key={r.ageGroup} className="border-t border-line"><td className="p-2">{r.ageGroup}</td>{[r.maleNotProne,r.maleProne,r.femaleNotProne,r.femaleProne].map((v,i)=><td key={i} className="p-2 text-right tabular-nums">{v == null ? '—' : v.toLocaleString('en-PH')}</td>)}</tr>)}</tbody>
          </table></div>
        </>; })()}
        <Notice tone="info" title="Linao age-sex table status">The uploaded Linao file was not a valid XLSX workbook, so the Linao age/sex table is not displayed or inferred. Its flood class and population exposure figures are retained from the supplied DDRiVE assessment source.</Notice>
      </Section>
      <Section title="Ormoc City hazard map library">
        <p className="mb-3 text-sm text-muted">High-resolution display copies of the City-provided map images. Click a map to inspect it at full size. Map dates, legends and limitations remain those printed on each source map.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MAPS.map((m) => <a key={m.id} href={`/maps/${m.file}`} target="_blank" rel="noopener noreferrer" className="group overflow-hidden rounded-control border border-line bg-surface hover:border-action">
            <div className="aspect-[4/3] overflow-hidden bg-sunken"><img src={`/maps/${m.file}`} alt={`${m.title}, Ormoc City`} loading="lazy" decoding="async" className="h-full w-full object-contain transition-transform group-hover:scale-[1.02]" /></div>
            <div className="p-3"><span className="font-semibold">{m.title}</span><span className="mt-1 block text-xs text-muted">{m.desc}</span><span className="mt-2 inline-flex items-center gap-1 text-xs text-action">Open full map <ExternalLink className="h-3 w-3" aria-hidden /></span></div>
          </a>)}
        </div>
      </Section>
      <Section title="Official and supporting sources"><List>{OUTBOUND.map((t) => <li key={t.url} className="border-b border-line py-3 last:border-0"><a href={t.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 font-medium text-action hover:underline" {...tip(`Open ${t.name} in a new tab`)}><ExternalLink className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{t.name}<span className="mt-0.5 block text-xs font-normal text-muted">{t.by}</span><span className="mt-1 block text-sm font-normal text-muted">{t.use}</span></span></a></li>)}</List></Section>
      <p className="flex items-center gap-2 text-xs text-muted"><Waves className="h-4 w-4" aria-hidden />Map library images are static cartographic references; check issuing agency, map date, scale, legend and limitations before operational use.</p>
      <p><Link className="text-sm font-medium text-action underline" to="/eoc/risk">Open City Risk Intelligence →</Link></p>
    </div>
  );
}
