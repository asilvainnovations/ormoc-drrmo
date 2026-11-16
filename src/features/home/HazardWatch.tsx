/**
 * Today — Hazard watch strip (ADR-041).
 * Outbound official sources + local DDRiVE flood snapshot. Never a trigger.
 */
import { Activity, CloudRain, ExternalLink, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Notice, Section } from '@/components/ui';
import { tip } from '@/components/Tooltip';

const LINKS = [
  {
    name: 'PAGASA Visayas forecast',
    url: 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd',
    icon: CloudRain,
    text: 'Official regional forecast (Visayas).',
  },
  {
    name: 'PHIVOLCS earthquake monitoring',
    url: 'https://www.phivolcs.dost.gov.ph/index.php/earthquake/earthquake-information3',
    icon: Activity,
    text: 'Official earthquake information and monitoring.',
  },
  {
    name: 'PHIVOLCS Tsunami Information',
    url: 'https://tsunami.phivolcs.dost.gov.ph/',
    icon: Waves,
    text: 'Official tsunami information bulletins for significant earthquakes, in the Philippines and abroad.',
  },
  {
    name: 'PAGASA weather',
    url: 'https://www.pagasa.dost.gov.ph/weather',
    icon: CloudRain,
    text: 'National weather and tropical cyclone products.',
  },
] as const;

export function HazardWatch() {
  const local = useLiveQuery(async () => {
    const [flood, priority, profiles] = await Promise.all([
      db.ddrive_flood.toArray(),
      db.ddrive_priority.toArray(),
      db.ddrive_barangay_profiles.toArray(),
    ]);
    if (!flood.length) return null;
    const names = new Map(profiles.map((p) => [p.psgc, p.name]));
    const high = flood.filter((f) => /high|very/i.test(f.susceptibility_class ?? '')).length;
    const top = [...priority]
      .filter((p) => p.priority_rank != null && p.priority_rank <= 5)
      .sort((a, b) => (a.priority_rank ?? 99) - (b.priority_rank ?? 99))
      .slice(0, 5)
      .map((p) => names.get(p.psgc) ?? p.psgc);
    return { high, top, n: flood.length };
  }, []);

  return (
    <Section title="Hazard watch">
      <p className="mb-2 text-sm text-muted">
        Official agency products open outside MODE. Local flood counts come from DDRiVE reference data already on this device.
      </p>
      <Notice tone="info">
        MODE does not issue warnings. Use PAGASA and PHIVOLCS for operational decisions. Local figures below are
        desk-assessment support only.
      </Notice>

      <ul className="mt-3 space-y-2">
        {LINKS.map((l) => (
          <li key={l.url}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-action hover:underline"
              {...tip(`Open ${l.name}`)}
            >
              <l.icon className="h-4 w-4 shrink-0" aria-hidden />
              {l.name}
              <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </a>
            <p className="pl-6 text-xs text-muted">{l.text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-control border border-line bg-surface p-3 text-sm">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <Waves className="h-4 w-4" aria-hidden /> Local flood snapshot (DDRiVE)
        </div>
        {!local ? (
          <p className="text-muted">No flood reference rows on this device yet.</p>
        ) : (
          <>
            <p>
              {local.n} barangays with flood rows · {local.high} classed high / very high susceptibility
            </p>
            {local.top.length > 0 && (
              <p className="mt-1 text-muted">Priority focus: {local.top.join(', ')}</p>
            )}
            <p className="mt-2">
              <Link className="font-medium text-action underline" to="/tools/flood-intelligence">
                Flood intelligence →
              </Link>
              {' · '}
              <Link className="font-medium text-action underline" to="/eoc/risk">
                City Risk Picture →
              </Link>
            </p>
          </>
        )}
      </div>
    </Section>
  );
}
