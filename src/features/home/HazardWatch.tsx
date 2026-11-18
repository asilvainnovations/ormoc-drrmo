/**
 * Today — Hazard watch (ADR-041, simplified 1.26.0): one row of icons. Official agency pages open outside MODE; the two local
 * tools open inside it. The notes that used to sit as paragraphs are tooltips. Never a trigger.
 */
import { Activity, CloudRain, Droplets, Info, ShieldAlert, Waves, Wind } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Section } from '@/components/ui';
import { tip } from '@/components/Tooltip';

const CHIP = 'grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink shadow-raised transition-colors hover:border-sky hover:bg-sky-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

const LINKS: { name: string; url: string; icon: LucideIcon; text: string }[] = [
  { name: 'PAGASA Visayas forecast', url: 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd', icon: CloudRain, text: 'Official regional forecast (Visayas).' },
  { name: 'PAGASA weather and cyclones', url: 'https://www.pagasa.dost.gov.ph/weather', icon: Wind, text: 'National weather and tropical cyclone products.' },
  { name: 'PHIVOLCS earthquakes', url: 'https://www.phivolcs.dost.gov.ph/index.php/earthquake/earthquake-information3', icon: Activity, text: 'Official earthquake information and monitoring.' },
  { name: 'PHIVOLCS tsunami', url: 'https://tsunami.phivolcs.dost.gov.ph/', icon: Waves, text: 'Official tsunami information bulletins for significant earthquakes, in the Philippines and abroad.' },
];

export function HazardWatch() {
  const local = useLiveQuery(async () => {
    const [flood, priority, profiles] = await Promise.all([db.ddrive_flood.toArray(), db.ddrive_priority.toArray(), db.ddrive_barangay_profiles.toArray()]);
    if (!flood.length) return null;
    const names = new Map(profiles.map((p) => [p.psgc, p.name]));
    const high = flood.filter((f) => /high|very/i.test(f.susceptibility_class ?? '')).length;
    const top = priority.filter((p) => p.priority_rank != null && p.priority_rank <= 5).sort((a, b) => (a.priority_rank ?? 99) - (b.priority_rank ?? 99)).map((p) => names.get(p.psgc) ?? p.psgc);
    return { high, top, n: flood.length };
  }, []);

  const floodTip = local
    ? `Flood intelligence (DDRiVE): ${local.n} barangays with flood rows, ${local.high} high or very high susceptibility${local.top.length ? `. Priority focus: ${local.top.join(', ')}` : ''}. Desk-assessment support only.`
    : 'Flood intelligence (DDRiVE). No flood reference rows on this device yet.';

  return (
    <Section title="Hazard watch">
      <ul className="flex flex-wrap items-center gap-3" aria-label="Hazard sources">
        {LINKS.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className={CHIP} aria-label={`${l.name} (opens outside MODE)`} {...tip(`${l.name}. ${l.text} Opens outside MODE.`)}>
              <l.icon className="h-5 w-5" aria-hidden />
            </a>
          </li>
        ))}
        <li aria-hidden className="mx-1 h-8 w-px bg-line" />
        <li><Link to="/tools/flood-intelligence" className={CHIP} aria-label="Flood intelligence" {...tip(floodTip)}><Droplets className="h-5 w-5" aria-hidden /></Link></li>
        <li><Link to="/eoc/risk" className={CHIP} aria-label="City risk picture" {...tip('City risk picture: likelihood and severity matrix and the Ten-Year Plan risk profile.')}><ShieldAlert className="h-5 w-5" aria-hidden /></Link></li>
        <li className="ml-auto">
          <span role="img" tabIndex={0} aria-label="MODE does not issue warnings. Use PAGASA and PHIVOLCS for operational decisions. Local figures are desk-assessment support only."
            className="grid h-9 w-9 place-items-center rounded-full text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            {...tip('MODE does not issue warnings. Use PAGASA and PHIVOLCS for operational decisions. Local figures below are desk-assessment support only.')}>
            <Info className="h-5 w-5" aria-hidden />
          </span>
        </li>
      </ul>
    </Section>
  );
}
