/**
 * Flood intelligence tool (ADR-041, 1.22.0 Slice 2).
 * Local DDRiVE flood picture + outbound official/supporting sources.
 * Not an official forecast. Prototype Bayesian UI is optional static reference only.
 */
import { ExternalLink, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { hazardChip } from '@/domain/ddrive';
import { Badge, List, ListRow, Notice, PageHeader, Section } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import { ORMOC } from './ToolsHome';

const OUTBOUND = [
  {
    name: 'Copernicus EMS — On-Demand Mapping',
    by: 'European Union Copernicus Programme',
    url: 'https://mapping.emergency.copernicus.eu/',
    use: 'Request or view on-demand satellite maps for emergencies (institutional activation).',
  },
  {
    name: 'Copernicus Global Flood Awareness',
    by: 'Copernicus EMS',
    url: 'https://global-flood.emergency.copernicus.eu/',
    use: 'Continental flood awareness products — situational awareness, not a local warning.',
  },
  {
    name: 'PAGASA — Visayas regional forecast',
    by: 'DOST-PAGASA',
    url: 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd',
    use: 'Official regional weather forecast for Visayas. Governs operational decisions.',
  },
  {
    name: 'PAGASA weather',
    by: 'DOST-PAGASA',
    url: 'https://www.pagasa.dost.gov.ph/weather',
    use: 'National weather and tropical cyclone products.',
  },
  {
    name: 'HazardHunterPH',
    by: 'GeoRiskPH',
    url: 'https://hazardhunter.georisk.gov.ph/map',
    use: 'Official multi-hazard screening for the Philippines.',
  },
  {
    name: 'UP NOAH — Know Your Hazards',
    by: 'UP NOAH Center',
    url: 'https://noah.up.edu.ph/know-your-hazards',
    use: 'Supporting hazard exploration. Confirm with official agency advisories for action.',
  },
] as const;

export function FloodIntelligencePage() {
  const snap = useLiveQuery(async () => {
    const [flood, priority, profiles] = await Promise.all([
      db.ddrive_flood.toArray(),
      db.ddrive_priority.toArray(),
      db.ddrive_barangay_profiles.toArray(),
    ]);
    const nameOf = new Map(profiles.map((p) => [p.psgc, p.name]));
    const byClass = new Map<string, number>();
    for (const f of flood) {
      const c = (f.susceptibility_class || 'unknown').toLowerCase();
      byClass.set(c, (byClass.get(c) ?? 0) + 1);
    }
    const top = [...priority]
      .filter((p) => p.priority_rank != null)
      .sort((a, b) => (a.priority_rank ?? 99) - (b.priority_rank ?? 99))
      .slice(0, 8)
      .map((p) => ({
        psgc: p.psgc,
        name: nameOf.get(p.psgc) ?? p.psgc,
        rank: p.priority_rank,
        flood: flood.find((f) => f.psgc === p.psgc)?.susceptibility_class ?? null,
      }));
    return { byClass: [...byClass.entries()], top, nFlood: flood.length, nPriority: priority.length };
  }, []);

  return (
    <div className="page">
      <PageHeader
        title="Flood intelligence"
        back="/tools"
        subtitle="Ormoc flood context from the City DDRiVE layer, plus official and supporting map sources. Decision support only — not an evacuation trigger."
      />

      <Notice tone="warn">
        Official forecasts and warnings remain with PAGASA and the City CDRRMO. Short-lead flash floods
        on the Anilao–Malbasag system usually fall under the 72-hour anticipatory-action floor: route them
        to city-level early action, not automatically to a State of Imminent Disaster declaration.
      </Notice>

      <Section title="Ormoc context" tip="Fixed local facts used across MODE.">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>City proper sits between the Anilao and Malbasag rivers (approx. {ORMOC.lat}°N, {ORMOC.lon}°E).</li>
          <li>Working barangay count: 85 (PSA PSGC; confirm with CPDO before treating as final).</li>
          <li>DDRiVE flood susceptibility and priority ranks are desk-assessment reference data (ADR-024).</li>
        </ul>
      </Section>

      <Section title="Local flood picture (DDRiVE)" tip="Loaded with reference data; works offline once synced.">
        {!snap ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : snap.nFlood === 0 ? (
          <Notice tone="info">No DDRiVE flood rows on this device yet. Load reference data, then return here.</Notice>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              {snap.nFlood} barangay flood rows · {snap.nPriority} priority rows
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {snap.byClass.map(([cls, n]) => (
                <Badge key={cls} tip={`Susceptibility class “${cls}”`}>
                  {cls}: {n}
                </Badge>
              ))}
            </div>
            <h3 className="mb-2 text-sm font-semibold">Priority barangays (decision support)</h3>
            <List>
              {snap.top.map((r) => (
                <ListRow
                  key={r.psgc}
                  title={`${r.rank ?? '—'} · ${r.name}`}
                  meta={r.flood ? `Flood susceptibility: ${r.flood}` : 'No flood class on file'}
                  tip="Open the full City Risk Picture for filters and profiles"
                />
              ))}
            </List>
            <p className="mt-3">
              <Link className="text-sm font-medium text-primary underline" to="/eoc/risk">
                Open City Risk Picture →
              </Link>
            </p>
          </>
        )}
      </Section>

      <Section title="On-demand mapping & official sources" tip="Opens outside MODE. Requires a connection.">
        <List>
          {OUTBOUND.map((t) => (
            <li key={t.url} className="border-b border-border py-3 last:border-0">
              <a
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 font-medium text-primary hover:underline"
                {...tip(`Open ${t.name} in a new tab`)}
              >
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t.name}
                  <span className="mt-0.5 block text-xs font-normal text-muted">{t.by}</span>
                </span>
              </a>
              <p className="mt-1 pl-6 text-sm text-muted">{t.use}</p>
            </li>
          ))}
        </List>
      </Section>

      <Section title="Reference prototype" tip="Optional static model from the engagement — not an official product.">
        <p className="mb-2 text-sm text-muted">
          A Bayesian-style flood intervention explorer was prepared as a design reference. If the file is
          installed under <code className="text-xs">public/tools/flood-intelligence-prototype.html</code>, open it
          in a new tab. It must not be treated as a PAGASA product or as an activation trigger.
        </p>
        <a
          className="inline-flex items-center gap-2 text-sm font-medium text-primary underline"
          href="/tools/flood-intelligence-prototype.html"
          target="_blank"
          rel="noopener noreferrer"
          {...tip('Open the static reference prototype if present')}
        >
          <Waves className="h-4 w-4" /> Open reference prototype
        </a>
      </Section>
    </div>
  );
}
