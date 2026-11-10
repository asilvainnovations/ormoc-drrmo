import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { bandPrefix, hazardChip, riskBand } from '@/domain/ddrive';
import { Badge, Field, Input, List, ListRow, Notice, PageHeader, Section, Select, Tabs } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { tip } from '@/components/Tooltip';
import type { DdriveBarangayProfile, DdriveCityRisk, DdriveFlood, DdriveHazards, DdrivePriority, DdriveVulnerability } from '@/types';
import { BAND_TONE, EOC_TABS, HAZARD_FILTER } from './labels';

interface Profile {
  p: DdriveBarangayProfile; f: DdriveFlood | undefined; h: DdriveHazards | undefined; pr: DdrivePriority | undefined;
  v: DdriveVulnerability | undefined;
}

/** 1.12.1 (ADR-024): the DDRiVE base layer — the city's desk-assessment risk picture and a
 *  per-barangay drill-down. Read-only reference data; decision support, never a trigger. */
export function RiskPage() {
  const [q, setQ] = useState('');
  const [hazard, setHazard] = useState<string>('all');
  const [open, setOpen] = useState<Profile | null>(null);

  const city = useLiveQuery(async () => {
    const [scores, matrix] = await Promise.all([db.ddrive_city_scores.toArray(), db.ddrive_risk_matrix.orderBy('ranking').toArray()]);
    return scores
      .map((s) => ({ ...s, ...riskBand(s.likelihood, s.severity, matrix)! }))
      .sort((a, b) => b.ranking - a.ranking) as DdriveCityRisk[];
  }, []);
  const profiles = useLiveQuery(async (): Promise<Profile[]> => {
    const [ps, fs, hs, prs, vs] = await Promise.all([
      db.ddrive_barangay_profiles.orderBy('name').toArray(), db.ddrive_flood.toArray(), db.ddrive_hazards.toArray(),
      db.ddrive_priority.toArray(), db.ddrive_vulnerability.toArray(),
    ]);
    const f = new Map(fs.map((x) => [x.psgc, x]));
    const h = new Map(hs.map((x) => [x.psgc, x]));
    const pr = new Map(prs.map((x) => [x.psgc, x]));
    const v = new Map(vs.map((x) => [x.psgc, x]));
    return ps.map((p) => ({ p, f: f.get(p.psgc), h: h.get(p.psgc), pr: pr.get(p.psgc), v: v.get(p.psgc) }));
  }, []);

  const word = q.trim().toLowerCase();
  const matchHazard = (r: Profile): boolean => {
    if (hazard === 'all') return true;
    if (hazard === 'flood') return !!r.f && !!hazardChip(r.f.susceptibility_class);
    if (hazard === 'priority') return r.pr?.priority_rank != null;
    if (hazard === 'cluster') return r.p.cluster_no != null;
    const col: Partial<Record<string, keyof DdriveHazards>> = {
      rain_landslide: 'rain_landslide', eq_landslide: 'eq_landslide', liquefaction: 'liquefaction',
      tsunami: 'tsunami', storm_surge: 'storm_surge',
    };
    const key = col[hazard];
    return !!r.h && !!key && !!hazardChip(r.h[key]);
  };
  const rows = (profiles ?? []).filter((r) =>
    (!word || `${r.p.name} ${r.p.former_name ?? ''} ${r.p.district_zone ?? ''}`.toLowerCase().includes(word)) && matchHazard(r));

  return (
    <div className="page">
      <PageHeader title="Risk intelligence" subtitle="DDRiVE — Data-Driven Risk and Vulnerability Estimation. Desk assessment v1.2 (9 Nov 2026); aggregate data only." />
      <Tabs items={EOC_TABS} />
      <Notice tone="info" title="Decision support, not a trigger">
        DDRiVE desk scores and barangay classes guide attention and PDRA discussion. Evacuation and activation decisions follow the Manual's SOPs. A blank field means "not assessed" — never zero.
      </Notice>

      <Section title="City risk picture" >
        <List>
          {(city ?? []).map((c) => (
            <ListRow key={c.hazard_event} title={<>{c.hazard_event} <Badge tone="neutral" className="ml-2">{c.hazard_family.split(' ')[0]}</Badge></>}
              meta={`Likelihood ${c.likelihood}/10 × severity ${c.severity}/100 · vulnerability ${c.vulnerability_rating ?? '—'} · ${c.validation_status ?? ''}`}
              trailing={<Badge tone={BAND_TONE[c.label]} {...tip(c.evidence_anchor ?? `${c.label}: ${c.band}`)}>{bandPrefix(c.band)} · {c.label}</Badge>} />
          ))}
        </List>
        {city && <p className="mt-2 text-xs text-muted" {...tip('Every desk score is pending DDRiVE working-session validation; the evidence anchor names the source figure.')}>All ten desk scores are desk scores pending working-session validation. Hold any row for its evidence anchor.</p>}
      </Section>

      <Section title={`Barangay profiles (${rows.length} of ${profiles?.length ?? 0})`}>
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Field label="Find a barangay" tip="Name, former name or district">
            {(id) => <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Curva, Balion, west coast" />}
          </Field>
          <Field label="Hazard filter" tip="Keep barangays whose assessment names this hazard; classes, not counts">
            {(id) => (
              <Select id={id} value={hazard} onChange={(e) => setHazard(e.target.value)}>
                {Object.entries(HAZARD_FILTER).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <List>
          {rows.map((r) => (
            <ListRow key={r.p.psgc} tip="Open the DDRiVE profile: flood, hazards, exposure, vulnerability and priority" onClick={() => setOpen(r)}
              title={<>{r.p.name}{r.p.former_name && <span className="ml-1 text-sm font-normal text-muted">(was {r.p.former_name})</span>}</>}
              meta={[`Pop. ${r.p.population_2024 ?? '—'} (2024)`, r.p.cluster_no ? `Cluster ${r.p.cluster_no} (proposed)` : null,
                r.pr?.priority_rank != null ? `Priority ${r.pr.priority_rank}` : null].filter(Boolean).join(' · ')}
              trailing={<Badge tone={r.f && hazardChip(r.f.susceptibility_class) ? 'warn' : 'neutral'}>{hazardChip(r.f?.susceptibility_class ?? null) ?? (r.p.urban_rural ?? '—')}</Badge>} />
          ))}
        </List>
      </Section>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `${open.p.name} — DDRiVE profile` : ''}>
        {open && <ProfileSheet r={open} />}
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="contents">
      <dt className="pt-1 text-sm font-semibold text-muted">{label}</dt>
      <dd className="text-sm leading-6">{value?.trim() ? value : '—'}</dd>
    </div>
  );
}

function ProfileSheet({ r }: { r: Profile }) {
  const { p, f, h, pr, v } = r;
  const val = (s: string | null | undefined) => (s && !/^not (available|assessed)/i.test(s.trim()) ? s : null);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1.5">
        <Row label="PSGC" value={p.psgc} />
        <Row label="Setting" value={p.urban_rural} />
        <Row label="Population" value={p.population_2024 != null ? `${p.population_2024.toLocaleString()} (2024 POPCEN); ${p.population_2020?.toLocaleString()} (2020 CPH)` : null} />
        <Row label="Coordinates" value={`${p.lat}, ${p.lng} (WGS 84) · ${p.coord_validation ?? 'validation unknown'}`} />
        <Row label="Cluster" value={p.cluster_no ? `Cluster ${p.cluster_no} (proposed) — ${p.cluster_validation ?? ''}` : p.cluster_label} />
        <Row label="Priority" value={pr?.priority_rank != null ? `Rank ${pr.priority_rank} of 85 · ${pr.confidence ?? ''}` : null} />
      </dl>

      <h3 className="border-b border-line pb-1 font-bold">Flood</h3>
      <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1.5">
        <Row label="Class" value={val(f?.susceptibility_class)} />
        <Row label="Exposed" value={f?.exposed_population != null ? `${f.exposed_population.toLocaleString()} people (${f.exposure_base_year ?? 'base year n.a.'})${f.exposure_pct != null ? ` — ${(f.exposure_pct * 100).toFixed(0)}% of base` : ''}` : null} />
        <Row label="Scenario" value={val(f?.depth_scenario)} />
        <Row label="Source" value={val(f?.hazard_source)} />
        <Row label="Status" value={f?.validation_status} />
      </dl>

      <h3 className="border-b border-line pb-1 font-bold">Other hazards (CDRA Table 3)</h3>
      <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1.5">
        <Row label="Landslide (rain)" value={val(h?.rain_landslide)} />
        <Row label="Landslide (quake)" value={val(h?.eq_landslide)} />
        <Row label="Ground shaking" value={val(h?.ground_shaking)} />
        <Row label="Ground rupture" value={val(h?.ground_rupture)} />
        <Row label="Liquefaction" value={val(h?.liquefaction)} />
        <Row label="Tsunami" value={val(h?.tsunami)} />
        <Row label="Storm surge" value={val(h?.storm_surge)} />
      </dl>

      <h3 className="border-b border-line pb-1 font-bold">Vulnerability and capacity</h3>
      <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1.5">
        <Row label="Sensitivity" value={val(v?.social_sensitivity)} />
        <Row label="Access limits" value={val(v?.access_constraints)} />
        <Row label="Coping" value={val(v?.coping_capacity)} />
        <Row label="Adaptive" value={val(v?.adaptive_capacity)} />
        <Row label="Evacuation access" value={val(h?.evacuation_access)} />
        <Row label="Priority basis" value={val(pr?.basis)} />
      </dl>
      <p className="text-xs text-muted" {...tip('Source: DDRiVE workbook v1.2 (9 Nov 2026), transcribed from the City DRA, CDRA Table 3 and the DRRM 10-Year Plan; see the source register S-01 to S-31.')}>Provenance: DDRiVE workbook v1.2 (9 Nov 2026). Missing fields are genuinely not assessed yet.</p>
    </div>
  );
}
