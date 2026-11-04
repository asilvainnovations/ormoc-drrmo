import {
  ExternalLink,
  Map,
  Satellite,
  BarChart3,
  Layers,
  Award,
  ShieldCheck,
  Swords,
  CloudRain,
  Globe2,
  Flame,
  Waves,
  Activity,
  Radar,
  MapPinned,
  Earth,
  Network,
  Compass,
  Info,
  Radio,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOnline } from '@/lib/hooks';
import { Notice, PageHeader, Section } from '@/components/ui';
import { tip } from '@/components/Tooltip';

/**
 * Ormoc City reference coordinates.
 * Used only to center relevant geographic visualizations.
 */
export const ORMOC = {
  lat: 11.0064,
  lon: 124.6075,
};

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type ToolCategory =
  | 'official'
  | 'philippines'
  | 'international'
  | 'specialized';

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

interface InternalTool {
  to: string;
  name: string;
  icon: LucideIcon;
  text: string;
  iat: string;
}

/* -------------------------------------------------------------------------- */
/* Philippine official and national information systems                      */
/* -------------------------------------------------------------------------- */

export const PHILIPPINE_TOOLS: ExternalTool[] = [
  {
    id: 'pagasa',
    name: 'PAGASA Weather and Warnings',
    by: 'DOST – Philippine Atmospheric, Geophysical and Astronomical Services Administration',
    url: 'https://www.pagasa.dost.gov.ph/weather',
    icon: CloudRain,
    category: 'official',
    priority: 'official',
    use: 'Official weather forecasts, tropical cyclone bulletins, rainfall warnings, severe weather advisories and other meteorological information.',
    when: 'Primary source for weather monitoring, tropical cyclone preparedness, rainfall advisories, flood preparedness and EOC activation decisions.',
    limitations:
      'Always consult the latest official bulletin and its validity period. Weather forecasts do not replace local flood and river monitoring.',
  },
  {
    id: 'hazardhunter',
    name: 'HazardHunterPH',
    by: 'GeoRiskPH – DOST and partner agencies',
    url: 'https://hazardhunter.georisk.gov.ph/map',
    icon: Map,
    category: 'philippines',
    priority: 'official',
    use: 'Multi-hazard assessment of a selected location, including flood, rain-induced landslide, storm surge, ground rupture, liquefaction and tsunami susceptibility.',
    when: 'Evacuation center suitability, alternate EOC assessment, barangay risk screening, PDRA preparation and land-use planning.',
    limitations:
      'Hazard assessment results are screening information, not a substitute for site-specific engineering studies or official warnings.',
  },
  {
    id: 'geoanalytics',
    name: 'GeoAnalyticsPH',
    by: 'GeoRiskPH',
    url: 'https://geoanalytics.georisk.gov.ph/',
    icon: BarChart3,
    category: 'philippines',
    priority: 'official',
    use: 'Geospatial exposure and risk analytics covering population, buildings and critical facilities exposed to hazards.',
    when: 'CDRA updates, barangay-level exposure analysis, scenario development, damage and needs assessment preparation and risk-informed investment planning.',
    limitations:
      'Validate underlying exposure datasets, geographic coverage, reference dates and assumptions before using outputs in official reports.',
  },
  {
    id: 'noah-studio',
    name: 'NOAH Studio',
    by: 'UP NOAH Center',
    url: 'https://noah.up.edu.ph/noah-studio',
    icon: Layers,
    category: 'philippines',
    priority: 'supporting',
    use: 'Geospatial visualization and exploration of hazard and environmental information through the UP NOAH platform.',
    when: 'Spatial analysis, hazard mapping, CDRA technical assessment, risk communication and local planning.',
    limitations:
      'Check available layers, geographic coverage, data dates and methodology for each visualization.',
  },
  {
    id: 'noah-hazards',
    name: 'Know Your Hazards',
    by: 'UP NOAH Center',
    url: 'https://noah.up.edu.ph/know-your-hazards',
    icon: MapPinned,
    category: 'philippines',
    priority: 'supporting',
    use: 'Location-based exploration of hazard information to support public understanding of disaster risks.',
    when: 'Barangay profiling, community risk communication, household preparedness and preliminary hazard screening.',
    limitations:
      'Use official agency advisories for emergency decisions and confirm the applicable hazard maps and datasets.',
  },
  {
    id: 'phivolcs',
    name: 'PHIVOLCS',
    by: 'DOST – Philippine Institute of Volcanology and Seismology',
    url: 'https://www.phivolcs.dost.gov.ph/',
    icon: Activity,
    category: 'official',
    priority: 'official',
    use: 'Official earthquake, volcano, tsunami and related geophysical hazard information, including monitoring bulletins and advisories.',
    when: 'Earthquake response, tsunami preparedness, volcanic activity monitoring, seismic risk assessment and public safety advisories.',
    limitations:
      'Refer to the relevant official bulletin and warning level. Do not rely on third-party earthquake or tsunami visualizations for evacuation decisions.',
  },
];

/* -------------------------------------------------------------------------- */
/* International disaster intelligence and satellite systems                 */
/* -------------------------------------------------------------------------- */

export const INTERNATIONAL_TOOLS: ExternalTool[] = [
  {
    id: 'copernicus',
    name: 'Copernicus Emergency Management Service',
    by: 'European Union – Copernicus Programme',
    url: 'https://emergency.copernicus.eu/',
    icon: Earth,
    category: 'international',
    priority: 'supporting',
    use: 'Satellite-based emergency mapping, rapid damage assessment, flood monitoring, wildfire intelligence and geospatial emergency information.',
    when: 'Large-scale flood assessment, post-disaster mapping, damage analysis, recovery planning and independent geospatial situational awareness.',
    limitations:
      'Rapid mapping is generally activated through specific requests and eligibility arrangements. Global products do not guarantee immediate coverage of Ormoc.',
  },
  {
    id: 'gdacs',
    name: 'GDACS',
    by: 'Global Disaster Alert and Coordination System – UN, European Commission and partners',
    url: 'https://www.gdacs.org/',
    icon: Globe2,
    category: 'international',
    priority: 'supporting',
    use: 'Global monitoring and alerts for major earthquakes, tropical cyclones, floods, volcanoes and other disasters, with estimated impact information.',
    when: 'Strategic disaster monitoring, regional situational awareness, humanitarian coordination and monitoring hazards affecting the Philippines.',
    limitations:
      'Global alert levels and impact estimates are screening products. Validate local conditions through PAGASA, PHIVOLCS and relevant authorities.',
  },
  {
    id: 'nasa-firms',
    name: 'NASA FIRMS',
    by: 'NASA – Fire Information for Resource Management System',
    url: 'https://firms.modaps.eosdis.nasa.gov/map/',
    icon: Flame,
    category: 'international',
    priority: 'supporting',
    use: 'Satellite-derived active fire and thermal anomaly observations using MODIS and VIIRS instruments.',
    when: 'Grassfire and wildfire monitoring, forest and watershed protection, fire incident intelligence and environmental risk monitoring.',
    limitations:
      'Satellite observations may have detection delays and spatial limitations. A hotspot is not automatically a confirmed ground fire.',
  },
  {
    id: 'sentinel-asia',
    name: 'Sentinel Asia',
    by: 'JAXA and Asia-Pacific disaster management partners',
    url: 'https://sentinel-asia.org/',
    icon: Satellite,
    category: 'international',
    priority: 'supporting',
    use: 'Regional disaster information-sharing and satellite observation coordination for floods, landslides, volcanic events and other emergencies.',
    when: 'Regional disaster intelligence, satellite-based emergency mapping, cross-border coordination and major disaster impact assessment.',
    limitations:
      'Satellite data requests and emergency mapping depend on activation procedures, participating agencies and available observations.',
  },
  {
    id: 'nasa-earthdata',
    name: 'NASA Earthdata',
    by: 'NASA – Earth Science Data Systems',
    url: 'https://www.earthdata.nasa.gov/',
    icon: Globe2,
    category: 'international',
    priority: 'reference',
    use: 'Access to Earth observation datasets, including satellite imagery, precipitation, land surface, vegetation, drought and environmental information.',
    when: 'Climate risk assessment, watershed analysis, rainfall studies, environmental monitoring and long-term resilience research.',
    limitations:
      'Some datasets require technical processing, registration or geospatial expertise. These are research and analytical resources, not direct local emergency warnings.',
  },
  {
    
{
  id: 'glofas',
  name: 'Global Flood Awareness System (GloFAS)',
  by: 'Copernicus Emergency Management Service',
  url: 'https://global-flood.emergency.copernicus.eu/',
  icon: Waves,
  category: 'international',
  priority: 'supporting',
  use: 'Global river flood forecasting, seasonal streamflow outlooks and satellite-based flood monitoring.',
  when: 'Watershed and river-basin monitoring, flood preparedness, hydrological risk assessment and scenario planning.',
  limitations: 'Primarily focuses on river flooding. It does not provide flash-flood or coastal-flood forecasts. Forecasts complement national hydrological and meteorological services.',
},
{
  id: 'gsmap',
  name: 'JAXA GSMaP Global Rainfall Watch',
  by: 'Japan Aerospace Exploration Agency',
  url: 'https://sharaku.eorc.jaxa.jp/GSMaP/',
  icon: CloudRain,
  category: 'international',
  priority: 'supporting',
  use: 'Satellite-derived global rainfall observations, including hourly precipitation information and rainfall accumulation.',
  when: 'Rainfall monitoring, watershed assessment, flood preparedness, extreme rainfall analysis and climate research.',
  limitations: 'Satellite rainfall estimates are not equivalent to ground-based rain gauges or official rainfall warnings.',
},
];
/* -------------------------------------------------------------------------- */
/* Specialized monitoring and situational awareness                           */
/* -------------------------------------------------------------------------- */

export const SPECIALIZED_TOOLS: ExternalTool[] = [
  {
    id: 'zoom-earth',
    name: 'Zoom Earth',
    by: 'Independent satellite and weather visualization platform',
    url: `https://zoom.earth/maps/satellite-hd/#view=${ORMOC.lat},${ORMOC.lon},9z`,
    icon: Satellite,
    category: 'specialized',
    priority: 'reference',
    use: 'Near-real-time satellite imagery, tropical cyclone tracking, precipitation and wind visualization.',
    when: 'EOC situational awareness, visual monitoring of approaching weather systems and briefing support.',
    limitations:
      'Third-party visualization. Official warnings and forecasts must come from PAGASA and PHIVOLCS.',
  },
  {
    id: 'tsunami-tracker',
    name: 'Tsunami Tracker',
    by: 'Radar Tracker – Third-party visualization',
    url: 'https://radar-tracker.com/tsunami-tracker/',
    icon: Waves,
    category: 'specialized',
    priority: 'reference',
    use: 'Tsunami-related tracking and visualization for supplementary situational awareness.',
    when: 'Supplementary tsunami awareness and training exercises involving coastal hazard scenarios.',
    limitations:
      'Not an official tsunami warning service. Use PHIVOLCS tsunami bulletins and evacuation instructions as the authoritative basis for action.',
  },
  {
    id: 'jma-himawari',
    name: 'Himawari Satellite – JMA',
    by: 'Japan Meteorological Agency',
    url: 'https://www.jma.go.jp/bosai/map.html#contents=himawari',
    icon: Radar,
    category: 'specialized',
    priority: 'reference',
    use: 'Geostationary satellite imagery covering the Asia-Pacific region for observing cloud systems, tropical cyclones and severe weather development.',
    when: 'Regional weather monitoring, tropical cyclone observation and supplementary EOC situational awareness.',
    limitations:
      'Satellite imagery is not a substitute for official local forecasts and warning bulletins.',
  },
  {
  id: 'usgs-earthquake',
  name: 'USGS Latest Earthquakes',
  by: 'United States Geological Survey',
  url: 'https://earthquake.usgs.gov/earthquakes/map/',
  icon: Activity,
  category: 'specialized',
  priority: 'reference',
  use: 'Interactive global earthquake map, recent seismic events, earthquake catalog and related event information.',
  when: 'Supplementary seismic monitoring, earthquake scenario exercises and international seismic situational awareness.',
  limitations: 'Not the official Philippine earthquake or tsunami warning authority. PHIVOLCS remains the primary Philippine source.',
},
];

/* -------------------------------------------------------------------------- */
/* DDRiVE-M and internal operational tools                                    */
/* -------------------------------------------------------------------------- */

export const INTERNAL_TOOLS: InternalTool[] = [
  {
    to: '/tools/ics',
    name: 'ICS Exercise Simulator',
    icon: Swords,
    text: 'Conduct drills, facilitated tabletops and position exercises across six Ormoc scenarios. Assess performance against Philippine ICS doctrine and generate printable after-action reviews.',
    iat: 'A8.1, B6.1, B7.2, B7.3',
  },
  {
    to: '/tools/pscp',
    name: 'Public Service Continuity Plan',
    icon: ShieldCheck,
    text: 'Develop continuity arrangements covering essential functions, business impact analysis, risks, alternate sites, succession, vital records and activation procedures.',
    iat: 'A3.4, B2.7',
  },
  {
    to: '/tools/gk',
    name: 'Gawad KALASAG Seal Readiness',
    icon: Award,
    text: 'Evaluate the six Seal criteria, calculate weighted scores and identify improvement opportunities based on the IAT baseline.',
    iat: 'A10.7',
  },
];

/**
 * DDRiVE-M external entry point.
 * Keep this separate from internal application routes.
 */
const DDRIVE_M: ExternalTool = {
  id: 'ddrivem',
  name: 'DDRiVE-M',
  by: 'ASilva Innovations',
  url: 'https://ddrive-m.asilvainnovations.com/',
  icon: Network,
  category: 'specialized',
  priority: 'supporting',
  use: 'Detect and direct, respond and recover, and mitigate: an integrated DRRM decision-support platform.',
  when: 'Scenario planning, operational coordination, resilience programming and application of the Manual of Operations.',
};

/* -------------------------------------------------------------------------- */
/* Shared components                                                          */
/* -------------------------------------------------------------------------- */

function ToolCard({ tool }: { tool: ExternalTool }) {
  const Icon = tool.icon;

  const priorityLabel: Record<ToolPriority, string> = {
    official: 'Official information source',
    supporting: 'Supporting intelligence',
    reference: 'Supplementary reference',
  };

  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${tool.name} in a new tab`}
      {...tip(`Open ${tool.name} in a new tab`)}
      className="
        group flex h-full flex-col rounded-sheet
        border border-line bg-surface p-4 shadow-raised
        transition-all duration-200
        hover:-translate-y-0.5 hover:border-action
        hover:shadow-lg
        focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-action focus-visible:ring-offset-2
      "
    >
      <div className="flex items-start gap-3">
        <div
          className="
            flex h-11 w-11 shrink-0 items-center justify-center
            rounded-xl bg-action/10 text-action
            transition-colors group-hover:bg-action/15
          "
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug text-ink">
            {tool.name}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {tool.by}
          </p>
        </div>

        <ExternalLink
          className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-action"
          aria-hidden="true"
        />
      </div>

      <div className="mt-3">
        <span
          className={`
            inline-flex rounded-full px-2.5 py-1
            text-[10px] font-semibold tracking-wide
            ${
              tool.priority === 'official'
                ? 'bg-action/10 text-action'
                : 'bg-surface-muted text-muted'
            }
          `}
        >
          {priorityLabel[tool.priority]}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink">
        {tool.use}
      </p>

      <div className="mt-3 border-t border-line pt-3">
        <p className="text-xs font-semibold text-ink">
          Recommended application
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {tool.when}
        </p>
      </div>

      {tool.limitations && (
        <div className="mt-3 flex gap-2 rounded-lg bg-surface-muted p-2.5">
          <Info
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted"
            aria-hidden="true"
          />
          <p className="text-[11px] leading-relaxed text-muted">
            {tool.limitations}
          </p>
        </div>
      )}
    </a>
  );
}

function ToolGrid({ tools }: { tools: ExternalTool[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

function InternalToolCard({ tool }: { tool: InternalTool }) {
  const Icon = tool.icon;

  return (
    <Link
      key={tool.to}
      to={tool.to}
      {...tip(`Open ${tool.name}`)}
      className="
        group flex h-full flex-col rounded-sheet
        border border-line bg-surface p-4 shadow-raised
        transition-all duration-200
        hover:-translate-y-0.5 hover:border-action
        focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-action focus-visible:ring-offset-2
      "
    >
      <Icon
        className="h-6 w-6 text-action"
        aria-hidden="true"
      />

      <h3 className="mt-3 text-base font-bold text-ink">
        {tool.name}
      </h3>

      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
        {tool.text}
      </p>

      <div className="mt-3 border-t border-line pt-3">
        <span className="text-xs font-medium text-muted">
          IAT Alignment: {tool.iat}
        </span>
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                   */
/* -------------------------------------------------------------------------- */

export function ToolsHome() {
  const online = useOnline();

  return (
    <div className="page space-y-6">
      <PageHeader
        title="DRRM Intelligence & Tools"
        subtitle="A unified access point for hazard monitoring, risk analytics, disaster intelligence and operational readiness in Ormoc City."
      />

      {/* Introduction */}

      <div className="rounded-sheet border border-line bg-surface p-4 shadow-raised sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-action/10 p-3 text-action">
            <Compass className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h2 className="font-bold text-ink">
              Multi-Hazard Intelligence Hub
            </h2>

            <p className="mt-1 text-sm leading-relaxed text-muted">
              Access national warning systems, geospatial risk
              assessment platforms, satellite intelligence and
              international disaster monitoring resources.
              Use these tools alongside the Ormoc City EOC
              Manual of Operations and established coordination
              protocols.
            </p>
          </div>
        </div>
      </div>

      {!online && (
        <Notice tone="warn">
          You appear to be offline. External monitoring platforms
          require an internet connection. Previously available
          information may not reflect current hazard conditions.
        </Notice>
      )}

      {/* Official warning sources */}

      <Section title="1. Official Philippine Warning Systems">
        <p className="mb-3 text-sm text-muted">
          Prioritize official agency bulletins and advisories
          when making operational decisions, issuing public
          information and initiating emergency response.
        </p>

        <ToolGrid
          tools={PHILIPPINE_TOOLS.filter(
            (tool) => tool.category === 'official',
          )}
        />
      </Section>

      {/* Philippine mapping and analytics */}

      <Section title="2. Philippine Hazard Mapping & Risk Analytics">
        <p className="mb-3 text-sm text-muted">
          Explore local hazard susceptibility, geospatial
          exposure and multi-hazard information for CDRA,
          barangay risk profiling and land-use planning.
        </p>

        <ToolGrid
          tools={PHILIPPINE_TOOLS.filter(
            (tool) => tool.category === 'philippines',
          )}
        />
      </Section>

      {/* Global intelligence */}

      <Section title="3. International Disaster Intelligence">
        <p className="mb-3 text-sm text-muted">
          Supplement local monitoring with international
          satellite observations, emergency mapping,
          disaster alerts and environmental intelligence.
        </p>

        <ToolGrid tools={INTERNATIONAL_TOOLS} />
      </Section>

      {/* Specialized */}

      <Section title="4. Satellite, Weather & Specialized Monitoring">
        <p className="mb-3 text-sm text-muted">
          Use supplementary visualizations for situational
          awareness, monitoring and simulation exercises.
          These services do not replace official warnings.
        </p>

        <ToolGrid
          tools={SPECIALIZED_TOOLS}
        />
      </Section>

      {/* Operational tools */}

      <Section title="5. DDRiVE-M & Operational Decision Support">
        <ToolGrid tools={[DDRIVE_M]} />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {INTERNAL_TOOLS.map((tool) => (
            <InternalToolCard key={tool.to} tool={tool} />
          ))}
        </div>
      </Section>

      {/* Operational guidance */}

      <Section title="6. Operational Use & Data Governance">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-sheet border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-action" aria-hidden="true" />
              <h3 className="font-semibold text-ink">
                Warning and verification protocol
              </h3>
            </div>

            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                • Prioritize PAGASA and PHIVOLCS official bulletins.
              </li>
              <li>
                • Verify warnings against local observations and
                relevant technical offices.
              </li>
              <li>
                • Confirm the time, location, validity and issuing
                authority of every advisory.
              </li>
              <li>
                • Record EOC decisions and information sources
                in the appropriate operational logs.
              </li>
            </ul>
          </div>

          <div className="rounded-sheet border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-action" aria-hidden="true" />
              <h3 className="font-semibold text-ink">
                Evidence and data governance
              </h3>
            </div>

            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                • Cite the original data provider and dataset.
              </li>
              <li>
                • Record data extraction date and observation time.
              </li>
              <li>
                • Check resolution, geographic coverage and
                methodology.
              </li>
              <li>
                • Preserve maps and assessment outputs used in
                official plans and reports.
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          External platforms operate independently and are
          governed by their respective owners' terms and data
          policies. Opening these tools does not transmit
          information from this application. Availability,
          update frequency and geographic coverage vary by provider.
        </p>
      </Section>
    </div>
  );
}
