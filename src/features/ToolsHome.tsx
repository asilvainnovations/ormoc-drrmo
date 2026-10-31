import { ExternalLink, Map, Satellite, BarChart3, Layers, Award, ShieldCheck, Swords } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOnline } from '@/lib/hooks';
import { Notice, PageHeader, Section } from '@/components/ui';
import { tip } from '@/components/Tooltip';

/** Ormoc City (city proper, between the Anilao and Malbasag rivers). */
export const ORMOC = { lat: 11.0064, lon: 124.6075 };

export interface ExternalTool { id: string; name: string; by: string; url: string; icon: LucideIcon; use: string; when: string }

// Opened in a new tab: these sites run their own maps and sign-in, and do not allow being framed
// inside another site. Nothing from this platform is sent to them.
export const EXTERNAL_TOOLS: ExternalTool[] = [
  { id: 'hazardhunter', name: 'HazardHunterPH', by: 'GeoRiskPH (DOST-PHIVOLCS and partners)', url: 'https://hazardhunter.georisk.gov.ph/map', icon: Map,
    use: 'Hazard assessment of any point: flood, rain-induced landslide, storm surge, ground rupture, liquefaction, tsunami and more, with a downloadable report.',
    when: 'Siting evacuation centers and the alternate EOC (IAT B2.1, B2.7, A7.4); checking a barangay before a PDRA; land-use screening (C1.2).' },
  { id: 'geoanalytics', name: 'GeoAnalyticsPH', by: 'GeoRiskPH', url: 'https://geoanalytics.georisk.gov.ph/', icon: BarChart3,
    use: 'Exposure and risk analysis: population, buildings and critical facilities exposed to each hazard, by barangay.',
    when: 'CDRA and exposure updates (A5.2, A5.8); costing the most severe credible scenario (A4.9); PDRA exposure counts.' },
  { id: 'zoomearth', name: 'Zoom Earth', by: 'Live satellite and weather map', url: `https://zoom.earth/maps/satellite-hd/#view=${ORMOC.lat},${ORMOC.lon},9z`, icon: Satellite,
    use: 'Near real-time satellite imagery, tropical cyclone tracks, rain and wind layers, centered on Ormoc.',
    when: 'Situational awareness for the duty officer and EOC. Official warnings still come from PAGASA and PHIVOLCS; act on their bulletins.' },
  { id: 'ddrivem', name: 'DDRiVE-M', by: 'ASilva Innovations', url: 'https://asilvainnovations.github.io/ddrive-m/public/platform.html', icon: Layers,
    use: 'Detect and direct, respond and recover, mitigate: the DRRM decision-support platform behind the ICS exercises.',
    when: 'Scenario planning and DRRM decision support alongside the Manual of Operations.' },
];

const INTERNAL = [
  { to: '/tools/ics', name: 'ICS exercise simulator', icon: Swords, text: 'Drills, facilitated tabletops and position drills on six Ormoc scenarios, scored against Philippine ICS doctrine, with a printable after-action review.', iat: 'A8.1, B6.1, B7.2, B7.3' },
  { to: '/tools/pscp', name: 'Public Service Continuity Plan', icon: ShieldCheck, text: 'Essential functions and business impact analysis, risks, alternate sites, succession, vital records and activation, ending in a printable plan.', iat: 'A3.4, B2.7' },
  { to: '/tools/gk', name: 'Gawad KALASAG Seal readiness', icon: Award, text: 'Rate the six Seal criteria 0 to 3 and see the weighted mean and rating, with suggestions from the IAT baseline.', iat: 'A10.7' },
];

/** Readiness tools and hazard information services, in one place. */
export function ToolsHome() {
  const online = useOnline();
  return (
    <div className="page">
      <PageHeader title="Tools" subtitle="Exercises, continuity planning and Seal readiness, plus the national hazard and risk information services." />
      <Section title="Readiness tools">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTERNAL.map(({ to, name, icon: Icon, text, iat }) => (
            <Link key={to} to={to} {...tip(`Open ${name}`)} className="rounded-sheet border border-line bg-surface p-4 shadow-raised hover:border-action">
              <Icon className="h-6 w-6 text-action" aria-hidden />
              <span className="mt-2 block text-lg font-bold">{name}</span>
              <span className="mt-1 block text-sm text-muted">{text}</span>
              <span className="mt-2 block font-data text-xs text-muted">IAT {iat}</span>
            </Link>
          ))}
        </div>
      </Section>
      <Section title="Hazard and situational information">
        {!online && <Notice tone="warn">These services need an internet connection.</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          {EXTERNAL_TOOLS.map(({ id, name, by, url, icon: Icon, use, when }) => (
            <a key={id} href={url} target="_blank" rel="noopener noreferrer" {...tip(`Open ${name} in a new tab`)}
              className="rounded-sheet border border-line bg-surface p-4 shadow-raised hover:border-action">
              <span className="flex items-center gap-2"><Icon className="h-6 w-6 text-action" aria-hidden /><span className="text-lg font-bold">{name}</span><ExternalLink className="ml-auto h-4 w-4 text-muted" aria-label="opens in a new tab" /></span>
              <span className="block text-xs text-muted">{by}</span>
              <span className="mt-2 block text-sm">{use}</span>
              <span className="mt-1 block text-sm text-muted"><span className="font-semibold text-ink">Use it for: </span>{when}</span>
            </a>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">External services, opened in a new tab. Their data and terms are their owners'. Cite the source and date of any map or figure you copy into a plan, PDRA or report.</p>
      </Section>
    </div>
  );
}
