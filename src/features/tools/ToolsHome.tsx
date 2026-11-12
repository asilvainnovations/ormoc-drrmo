import {
  Activity,
  Award,
  BarChart3,
  CloudRain,
  Compass,
  Earth,
  ExternalLink,
  Flame,
  Globe2,
  Info,
  Layers,
  Map as MapIcon,
  MapPinned,
  Network,
  Radar,
  Radio,
  Satellite,
  ShieldCheck,
  Swords,
  Tent,
  Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOnline } from '@/lib/hooks';
import { Badge, Notice, PageHeader, Section } from '@/components/ui';
import { tip } from '@/components/Tooltip';

/** Ormoc City (city proper, between the Anilao and Malbasag rivers). Centers map links. */
export const ORMOC = { lat: 11.0064, lon: 124.6075 };

type ToolCategory = 'official' | 'philippines' | 'international' | 'specialized';
type ToolPriority = 'official' | 'supporting' | 'reference';

export interface ExternalTool {
  id: string;
  name: string;
  by: string;
  url: string;
  icon: LucideIcon;
  category: ToolCategory;
  priority: ToolPriority;
  use: string;
  when: string;
  limitations?: string;
}

interface InternalTool { to: string; name: string; icon: LucideIcon; text: string; iat: string }

// External services open in a new tab (ADR-011): they run their own maps and sign-in and do
// not allow framing. Nothing from this platform is sent to them. Never iframe them, and never
// loosen the CSP for them.

/* Philippine official and national information systems */
export const PHILIPPINE_TOOLS: ExternalTool[] = [
  {
    id: 'pagasa', name: 'PAGASA Weather and Warnings',
    by: 'DOST – Philippine Atmospheric, Geophysical and Astronomical Services Administration',
    url: 'https://www.pagasa.dost.gov.ph/weather', icon: CloudRain, category: 'official', priority: 'official',
    use: 'Official weather forecasts, tropical cyclone bulletins, rainfall warnings, severe weather advisories and other meteorological information.',
    when: 'Primary source for weather monitoring, tropical cyclone preparedness, rainfall advisories, flood preparedness and EOC activation decisions.',
    limitations: 'Always consult the latest official bulletin and its validity period. Weather forecasts do not replace local flood and river monitoring.',
  },
  {
    id: 'hazardhunter', name: 'HazardHunterPH', by: 'GeoRiskPH – DOST and partner agencies',
    url: 'https://hazardhunter.georisk.gov.ph/map', icon: MapIcon, category: 'philippines', priority: 'official',
    use: 'Multi-hazard assessment of a selected location, including flood, rain-induced landslide, storm surge, ground rupture, liquefaction and tsunami susceptibility.',
    when: 'Evacuation center suitability, alternate EOC assessment, barangay risk screening, PDRA preparation and land-use planning.',
    limitations: 'Hazard assessment results are screening information, not a substitute for site-specific engineering studies or official warnings.',
  },
  {
    id: 'geoanalytics', name: 'GeoAnalyticsPH', by: 'GeoRiskPH',
    url: 'https://geoanalytics.georisk.gov.ph/', icon: BarChart3, category: 'philippines', priority: 'official',
    use: 'Geospatial exposure and risk analytics covering population, buildings and critical facilities exposed to hazards.',
    when: 'CDRA updates, barangay-level exposure analysis, scenario development, damage and needs assessment preparation and risk-informed investment planning.',
    limitations: 'Validate underlying exposure datasets, geographic coverage, reference dates and assumptions before using outputs in official reports.',
  },
  {
    id: 'noah-studio', name: 'NOAH Studio', by: 'UP NOAH Center',
    url: 'https://noah.up.edu.ph/noah-studio', icon: Layers, category: 'philippines', priority: 'supporting',
    use: 'Geospatial visualization and exploration of hazard and environmental information through the UP NOAH platform.',
    when: 'Spatial analysis, hazard mapping, CDRA technical assessment, risk communication and local planning.',
    limitations: 'Check available layers, geographic coverage, data dates and methodology for each visualization.',
  },
  {
    id: 'noah-hazards', name: 'Know Your Hazards', by: 'UP NOAH Center',
    url: 'https://noah.up.edu.ph/know-your-hazards', icon: MapPinned, category: 'philippines', priority: 'supporting',
    use: 'Location-based exploration of hazard information to support public understanding of disaster risks.',
    when: 'Barangay profiling, community risk communication, household preparedness and preliminary hazard screening.',
    limitations: 'Use official agency advisories for emergency decisions and confirm the applicable hazard maps and datasets.',
  },
  {
    id: 'phivolcs', name: 'PHIVOLCS', by: 'DOST – Philippine Institute of Volcanology and Seismology',
    url: 'https://www.phivolcs.dost.gov.ph/', icon: Activity, category: 'official', priority: 'official',
    use: 'Official earthquake, volcano, tsunami and related geophysical hazard information, including monitoring bulletins and advisories.',
    when: 'Earthquake response, tsunami preparedness, volcanic activity monitoring, seismic risk assessment and public safety advisories.',
    limitations: 'Refer to the relevant official bulletin and warning level. Do not rely on third-party earthquake or tsunami visualizations for evacuation decisions.',
  },
];

/* International disaster intelligence and satellite systems */
export const INTERNATIONAL_TOOLS: ExternalTool[] = [
  {
    id: 'copernicus', name: 'Copernicus Emergency Management Service', by: 'European Union – Copernicus Programme',
    url: 'https://emergency.copernicus.eu/', icon: Earth, category: 'international', priority: 'supporting',
    use: 'Satellite-based emergency mapping, rapid damage assessment, flood monitoring, wildfire intelligence and geospatial emergency information.',
    when: 'Large-scale flood assessment, post-disaster mapping, damage analysis, recovery planning and independent geospatial situational awareness.',
    limitations: 'Rapid mapping is generally activated through specific requests and eligibility arrangements. Global products do not guarantee immediate coverage of Ormoc.',
  },
  {
    id: 'gdacs', name: 'GDACS', by: 'Global Disaster Alert and Coordination System – UN, European Commission and partners',
    url: 'https://www.gdacs.org/', icon: Globe2, category: 'international', priority: 'supporting',
    use: 'Global monitoring and alerts for major earthquakes, tropical cyclones, floods, volcanoes and other disasters, with estimated impact information.',
    when: 'Strategic disaster monitoring, regional situational awareness, humanitarian coordination and monitoring hazards affecting the Philippines.',
    limitations: 'Global alert levels and impact estimates are screening products. Validate local conditions through PAGASA, PHIVOLCS and relevant authorities.',
  },
  {
    id: 'nasa-firms', name: 'NASA FIRMS', by: 'NASA – Fire Information for Resource Management System',
    url: 'https://firms.modaps.eosdis.nasa.gov/map/', icon: Flame, category: 'international', priority: 'supporting',
    use: 'Satellite-derived active fire and thermal anomaly observations using MODIS and VIIRS instruments.',
    when: 'Grassfire and wildfire monitoring, forest and watershed protection, fire incident intelligence and environmental risk monitoring.',
    limitations: 'Satellite observations may have detection delays and spatial limitations. A hotspot is not automatically a confirmed ground fire.',
  },
  {
    id: 'sentinel-asia', name: 'Sentinel Asia', by: 'JAXA and Asia-Pacific disaster management partners',
    url: 'https://sentinel-asia.org/', icon: Satellite, category: 'international', priority: 'supporting',
    use: 'Regional disaster information-sharing and satellite observation coordination for floods, landslides, volcanic events and other emergencies.',
    when: 'Regional disaster intelligence, satellite-based emergency mapping, cross-border coordination and major disaster impact assessment.',
    limitations: 'Satellite data requests and emergency mapping depend on activation procedures, participating agencies and available observations.',
  },
  {
    id: 'nasa-earthdata', name: 'NASA Earthdata', by: 'NASA – Earth Science Data Systems',
    url: 'https://www.earthdata.nasa.gov/', icon: Globe2, category: 'international', priority: 'reference',
    use: 'Access to Earth observation datasets, including satellite imagery, precipitation, land surface, vegetation, drought and environmental information.',
    when: 'Climate risk assessment, watershed analysis, rainfall studies, environmental monitoring and long-term resilience research.',
    limitations: 'Some datasets require technical processing, registration or geospatial expertise. These are research and analytical resources, not direct local emergency warnings.',
  },
  {
    id: 'glofas', name: 'Global Flood Awareness System (GloFAS)', by: 'Copernicus Emergency Management Service',
    url: 'https://global-flood.emergency.copernicus.eu/', icon: Waves, category: 'international', priority: 'supporting',
    use: 'Global river flood forecasting, seasonal streamflow outlooks and satellite-based flood monitoring.',
    when: 'Watershed and river-basin monitoring, flood preparedness, hydrological risk assessment and scenario planning.',
    limitations: 'Primarily focuses on river flooding. It does not provide flash-flood or coastal-flood forecasts. Forecasts complement national hydrological and meteorological services.',
  },
  {
    id: 'gsmap', name: 'JAXA GSMaP Global Rainfall Watch', by: 'Japan Aerospace Exploration Agency',
    url: 'https://sharaku.eorc.jaxa.jp/GSMaP/', icon: CloudRain, category: 'international', priority: 'supporting',
    use: 'Satellite-derived global rainfall observations, including hourly precipitation information and rainfall accumulation.',
    when: 'Rainfall monitoring, watershed assessment, flood preparedness, extreme rainfall analysis and climate research.',
    limitations: 'Satellite rainfall estimates are not equivalent to ground-based rain gauges or official rainfall warnings.',
  },
];

/* Specialized monitoring and situational awareness */
export const SPECIALIZED_TOOLS: ExternalTool[] = [
  {
    id: 'zoom-earth', name: 'Zoom Earth', by: 'Independent satellite and weather visualization platform',
    url: `https://zoom.earth/maps/satellite-hd/#view=${ORMOC.lat},${ORMOC.lon},9z`, icon: Satellite, category: 'specialized', priority: 'reference',
    use: 'Near-real-time satellite imagery, tropical cyclone tracking, precipitation and wind visualization.',
    when: 'EOC situational awareness, visual monitoring of approaching weather systems and briefing support.',
    limitations: 'Third-party visualization. Official warnings and forecasts must come from PAGASA and PHIVOLCS.',
  },
  {
    id: 'tsunami-tracker', name: 'Tsunami Tracker', by: 'Radar Tracker – Third-party visualization',
    url: 'https://radar-tracker.com/tsunami-tracker/', icon: Waves, category: 'specialized', priority: 'reference',
    use: 'Tsunami-related tracking and visualization for supplementary situational awareness.',
    when: 'Supplementary tsunami awareness and training exercises involving coastal hazard scenarios.',
    limitations: 'Not an official tsunami warning service. Use PHIVOLCS tsunami bulletins and evacuation instructions as the authoritative basis for action.',
  },
  {
    id: 'jma-himawari', name: 'Himawari Satellite – JMA', by: 'Japan Meteorological Agency',
    url: 'https://www.jma.go.jp/bosai/map.html#contents=himawari', icon: Radar, category: 'specialized', priority: 'reference',
    use: 'Geostationary satellite imagery covering the Asia-Pacific region for observing cloud systems, tropical cyclones and severe weather development.',
    when: 'Regional weather monitoring, tropical cyclone observation and supplementary EOC situational awareness.',
    limitations: 'Satellite imagery is not a substitute for official local forecasts and warning bulletins.',
  },
  {
    id: 'usgs-earthquake', name: 'USGS Latest Earthquakes', by: 'United States Geological Survey',
    url: 'https://earthquake.usgs.gov/earthquakes/map/', icon: Activity, category: 'specialized', priority: 'reference',
    use: 'Interactive global earthquake map, recent seismic events, earthquake catalog and related event information.',
    when: 'Supplementary seismic monitoring, earthquake scenario exercises and international seismic situational awareness.',
    limitations: 'Not the official Philippine earthquake or tsunami warning authority. PHIVOLCS remains the primary Philippine source.',
  },
];

/** DDRiVE-M, an external entry point kept apart from the app's own routes. */
export const DDRIVE_M: ExternalTool = {
  id: 'ddrivem', name: 'DDRiVE-M', by: 'ASilva Innovations',
  url: 'https://ddrive-m.asilvainnovations.com/', icon: Network, category: 'specialized', priority: 'supporting',
  use: 'Detect and direct, respond and recover, and mitigate: an integrated DRRM decision-support platform.',
  when: 'Scenario planning, operational coordination, resilience programming and application of the Manual of Operations.',
};

/** Every external service on this page, in display order. The tools test checks each one. */
export const EXTERNAL_TOOLS: ExternalTool[] = [...PHILIPPINE_TOOLS, ...INTERNATIONAL_TOOLS, ...SPECIALIZED_TOOLS, DDRIVE_M];

export const INTERNAL_TOOLS: InternalTool[] = [
  { to: '/tools/echo', name: 'ECHO: Evacuation and Camp Handling Operations', icon: Tent, iat: 'A7.4, A7.6, A7.9, B5.1, B6.3, B6.4',
    text: 'Simulate the whole cycle from evacuation planning to camp closure, screen centres and routes on the hazard sheets, keep the evacuation-centre inventory and aggregate camp reports, and see one EOC picture with SitRep figures.' },
  { to: '/tools/ics', name: 'ICS Exercise Simulator', icon: Swords, iat: 'A8.1, B6.1, B7.2, B7.3',
    text: 'Conduct drills, facilitated tabletops and position exercises across six Ormoc scenarios. Assess performance against Philippine ICS doctrine and generate printable after-action reviews.' },
  { to: '/tools/pscp', name: 'Public Service Continuity Plan', icon: ShieldCheck, iat: 'A3.4, B2.7',
    text: 'Develop continuity arrangements covering essential functions, business impact analysis, risks, alternate sites, succession, vital records and activation procedures.' },
  { to: '/tools/gk', name: 'Gawad KALASAG Seal Readiness', icon: Award, iat: 'A10.7',
    text: 'Evaluate the six Seal criteria, calculate weighted scores and identify improvement opportunities based on the IAT baseline.' },
];

const PRIORITY: Record<ToolPriority, { label: string; tone: 'info' | 'neutral' }> = {
  official: { label: 'Official information source', tone: 'info' },
  supporting: { label: 'Supporting intelligence', tone: 'neutral' },
  reference: { label: 'Supplementary reference', tone: 'neutral' },
};

const CARD = 'group flex h-full flex-col rounded-sheet border border-line bg-surface p-4 shadow-raised hover:border-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

function ToolCard({ tool }: { tool: ExternalTool }) {
  const Icon = tool.icon;
  const p = PRIORITY[tool.priority];
  return (
    <a href={tool.url} target="_blank" rel="noopener noreferrer" {...tip(`Open ${tool.name} in a new tab`)} className={CARD}>
      <span className="flex items-start gap-3">
        <Icon className="mt-0.5 h-6 w-6 shrink-0 text-action" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-bold leading-snug">{tool.name}</span>
          <span className="mt-0.5 block text-xs text-muted">{tool.by}</span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 text-muted group-hover:text-action" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </span>
      <span className="mt-3 block"><Badge tone={p.tone}>{p.label}</Badge></span>
      <span className="mt-3 block text-sm">{tool.use}</span>
      <span className="mt-3 block border-t border-line pt-3 text-sm text-muted"><span className="font-semibold text-ink">Use it for: </span>{tool.when}</span>
      {tool.limitations && (
        <span className="mt-3 flex gap-2 rounded-control bg-sunken p-2.5 text-xs text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{tool.limitations}</span>
        </span>
      )}
    </a>
  );
}

function ToolGrid({ tools }: { tools: ExternalTool[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tools.map((t) => <ToolCard key={t.id} tool={t} />)}
    </div>
  );
}

function InternalToolCard({ tool }: { tool: InternalTool }) {
  const Icon = tool.icon;
  return (
    <Link to={tool.to} {...tip(`Open ${tool.name}`)} className={CARD}>
      <Icon className="h-6 w-6 text-action" aria-hidden />
      <span className="mt-2 block text-lg font-bold">{tool.name}</span>
      <span className="mt-1 block flex-1 text-sm text-muted">{tool.text}</span>
      <span className="mt-3 block border-t border-line pt-3 font-data text-xs text-muted">IAT {tool.iat}</span>
    </Link>
  );
}

/** Readiness tools and hazard information services, in one place. */
export function ToolsHome() {
  const online = useOnline();
  return (
    <div className="page">
      <PageHeader title="DRRM Intelligence and Tools"
        subtitle="Hazard monitoring, risk analytics, disaster intelligence and readiness tools for Ormoc City, in one place." />

      <Notice tone="info" title="Multi-hazard intelligence hub">
        <span className="flex items-start gap-2">
          <Compass className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>National warning systems, hazard and risk maps, satellite intelligence and international monitoring. Use them alongside the EOC Manual and the CDRRMO protocols.</span>
        </span>
      </Notice>

      {!online && <Notice tone="warn">You are offline. These services need an internet connection, and anything you saw earlier may no longer show current conditions.</Notice>}

      <Section title="1. Official Philippine warning systems">
        <p className="mb-3 text-sm text-muted">Act on official PAGASA and PHIVOLCS bulletins when making operational decisions, issuing public information and starting a response.</p>
        <ToolGrid tools={PHILIPPINE_TOOLS.filter((t) => t.category === 'official')} />
      </Section>

      <Section title="2. Philippine hazard mapping and risk analytics">
        <p className="mb-3 text-sm text-muted">Local hazard susceptibility, exposure and multi-hazard information for the CDRA, barangay risk profiles and land-use planning.</p>
        <ToolGrid tools={PHILIPPINE_TOOLS.filter((t) => t.category === 'philippines')} />
      </Section>

      <Section title="3. International disaster intelligence">
        <p className="mb-3 text-sm text-muted">Satellite observation, emergency mapping, disaster alerts and environmental data that add to local monitoring.</p>
        <ToolGrid tools={INTERNATIONAL_TOOLS} />
      </Section>

      <Section title="4. Satellite, weather and specialized monitoring">
        <p className="mb-3 text-sm text-muted">Supplementary views for situational awareness and exercises. They do not replace official warnings.</p>
        <ToolGrid tools={SPECIALIZED_TOOLS} />
      </Section>

      <Section title="5. DDRiVE-M and readiness tools">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ToolCard tool={DDRIVE_M} />
          {INTERNAL_TOOLS.map((t) => <InternalToolCard key={t.to} tool={t} />)}
        </div>
      </Section>

      <Section title="6. Operational use and data governance">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-sheet border border-line bg-surface p-4">
            <p className="flex items-center gap-2 font-bold"><Radio className="h-5 w-5 text-action" aria-hidden />Warning and verification</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Act on PAGASA and PHIVOLCS official bulletins first.</li>
              <li>Check warnings against local observations and the technical offices concerned.</li>
              <li>Confirm the time, place, validity and issuing authority of every advisory.</li>
              <li>Record EOC decisions and their information sources in the logbook.</li>
            </ul>
          </div>
          <div className="rounded-sheet border border-line bg-surface p-4">
            <p className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-action" aria-hidden />Evidence and data governance</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Cite the original data provider and dataset.</li>
              <li>Record the extraction date and the observation time.</li>
              <li>Check resolution, geographic coverage and method.</li>
              <li>Keep the maps and outputs used in official plans and reports.</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">External services, opened in a new tab. Their data and terms are their owners'. Opening them sends nothing from this platform. Availability, update frequency and coverage vary by provider.</p>
      </Section>
    </div>
  );
}
