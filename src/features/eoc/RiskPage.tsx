
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '@/lib/db';
import { hazardChip, riskBand } from '@/domain/ddrive';
import { getBarangayFloodExposure } from '@/domain/floodExposure';

import {
  Badge,
  Field,
  Input,
  List,
  ListRow,
  Notice,
  PageHeader,
  Section,
  Select,
  Tabs,
} from '@/components/ui';

import { Sheet } from '@/components/Sheet';

import type {
  DdriveBarangayProfile,
  DdriveCityRisk,
  DdriveFlood,
  DdriveHazards,
  DdrivePriority,
  DdriveVulnerability,
} from '@/types';

import { EOC_TABS, HAZARD_FILTER } from './labels';

import {
  RiskMatrixChart,
  type RiskMatrixItem,
} from './RiskMatrixChart';

import { LdrrmpRiskProfile } from './LdrrmpRiskProfile';

interface Profile {
  p: DdriveBarangayProfile;
  f: DdriveFlood | undefined;
  h: DdriveHazards | undefined;
  pr: DdrivePriority | undefined;
  v: DdriveVulnerability | undefined;
}

export function RiskPage() {
  const [q, setQ] = useState('');
  const [hazard, setHazard] = useState('all');
  const [open, setOpen] = useState<Profile | null>(null);

  /**
   * City-level DDRiVE risk intelligence.
   *
   * ddrive_risk_matrix contains risk classification bands,
   * not individual 5x5 chart cells.
   *
   * riskBand() uses these records to classify each city score.
   */
  const city = useLiveQuery(async () => {
    const [scores, matrix] = await Promise.all([
      db.ddrive_city_scores.toArray(),
      db.ddrive_risk_matrix.orderBy('ranking').toArray(),
    ]);

    const risks = scores
      .map((score) => {
        const band = riskBand(
          score.likelihood,
          score.severity,
          matrix,
        );

        return band
          ? {
              ...score,
              ...band,
            }
          : null;
      })
      .filter((item): item is DdriveCityRisk => item !== null)
      .sort((a, b) => b.ranking - a.ranking);

    return {
      risks,
      matrix,
    };
  }, []);

  /**
   * Barangay-level DDRiVE profiles.
   *
   * Related datasets are indexed by PSGC for efficient lookup.
   * Missing records remain undefined and are never converted to zero.
   */
  const profiles = useLiveQuery(async (): Promise<Profile[]> => {
    const [
      ps,
      fs,
      hs,
      prs,
      vs,
    ] = await Promise.all([
      db.ddrive_barangay_profiles.orderBy('name').toArray(),
      db.ddrive_flood.toArray(),
      db.ddrive_hazards.toArray(),
      db.ddrive_priority.toArray(),
      db.ddrive_vulnerability.toArray(),
    ]);

    const floodByPsgc = new Map(
      fs.map((item) => [item.psgc, item]),
    );

    const hazardsByPsgc = new Map(
      hs.map((item) => [item.psgc, item]),
    );

    const priorityByPsgc = new Map(
      prs.map((item) => [item.psgc, item]),
    );

    const vulnerabilityByPsgc = new Map(
      vs.map((item) => [item.psgc, item]),
    );

    return ps.map((profile) => ({
      p: profile,
      f: floodByPsgc.get(profile.psgc),
      h: hazardsByPsgc.get(profile.psgc),
      pr: priorityByPsgc.get(profile.psgc),
      v: vulnerabilityByPsgc.get(profile.psgc),
    }));
  }, []);

  /**
   * FIX: Adapt DDRiVE city scores to the RiskMatrixChart contract.
   *
   * DDRiVE uses:
   *   likelihood: number
   *   severity: number
   *
   * RiskMatrixChart requires:
   *   likelihood: number
   *   impact: number
   *
   * Severity represents the impact dimension in the chart.
   *
   * Do not pass ddrive_risk_matrix directly to the chart.
   * Those records describe classification bands, not chart cells.
   */
  const matrixItems: RiskMatrixItem[] = (city?.risks ?? []).map(
    ({ likelihood, severity }) => ({
      likelihood,
      impact: severity,
    }),
  );

  // ------------------------------------------------------------
  // Barangay search and hazard filtering
  // ------------------------------------------------------------

  const word = q.trim().toLowerCase();

  const match = (r: Profile): boolean => {
    if (hazard === 'all') {
      return true;
    }

    if (hazard === 'flood') {
      return (
        !!(r.f && hazardChip(r.f.susceptibility_class)) ||
        !!getBarangayFloodExposure(r.p.psgc)
      );
    }

    if (hazard === 'priority') {
      return r.pr?.priority_rank != null;
    }

    if (hazard === 'cluster') {
      return r.p.cluster_no != null;
    }

    const col: Partial<Record<string, keyof DdriveHazards>> = {
      rain_landslide: 'rain_landslide',
      eq_landslide: 'eq_landslide',
      liquefaction: 'liquefaction',
      tsunami: 'tsunami',
      storm_surge: 'storm_surge',
    };

    const key = col[hazard];

    return (
      !!r.h &&
      !!key &&
      !!hazardChip(r.h[key])
    );
  };

  /**
   * Count classified hazard signals only.
   * Unassessed and unavailable fields are excluded.
   */
  const hazardSignals = (r: Profile): number =>
    [
      r.f?.susceptibility_class,
      r.h?.rain_landslide,
      r.h?.eq_landslide,
      r.h?.liquefaction,
      r.h?.tsunami,
      r.h?.storm_surge,
    ].filter((value) => !!hazardChip(value ?? null)).length;

  const rows = (profiles ?? []).filter((r) => {
    const matchesSearch =
      !word ||
      `${r.p.name} ${r.p.former_name ?? ''} ${
        r.p.district_zone ?? ''
      }`
        .toLowerCase()
        .includes(word);

    return matchesSearch && match(r);
  });

  const multiHazardCount = (profiles ?? []).filter(
    (r) => hazardSignals(r) >= 2,
  ).length;

  const priorityRankedCount = (profiles ?? []).filter(
    (r) => r.pr?.priority_rank != null,
  ).length;

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <div className="page">
      <PageHeader
        title="Risk Intelligence"
        subtitle="DDRiVE — Data-Driven Risk and Vulnerability Estimation. Desk assessment v1.2 (9 Nov 2026); aggregate data only."
      />

      <Tabs items={EOC_TABS} />

      <Notice
        tone="info"
        title="Decision support, not a trigger"
      >
        DDRiVE desk scores and barangay classes guide attention and
        PDRA discussion. Evacuation and activation decisions follow
        the Manual's SOPs. A blank field means "not assessed" —
        never zero.
      </Notice>

      {/* ======================================================
          CITY RISK PICTURE
          ====================================================== */}

      <Section title="City Risk Picture">
        <RiskMatrixChart
          items={matrixItems}
          title="City Risk Matrix"
          description="ISO 31000-inspired 5×5 likelihood and impact visualization. Scores are calculated from available DDRiVE city risk records."
          ariaLabel="City risk matrix showing likelihood against impact"
          showCounts
        />

        <LdrrmpRiskProfile />

        {city && (
          <p className="mt-3 text-xs text-muted">
            Desk scores remain pending DDRiVE working-session
            validation. Select a hazard for its evidence.
            Historical, dated assessment series are not available
            here, so trend arrows are intentionally not inferred.
          </p>
        )}
      </Section>

      {/* ======================================================
          BARANGAY SUMMARY CARDS
          ====================================================== */}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-sheet border border-line bg-surface p-3">
          <p className="text-xs font-bold text-muted">
            Barangay profiles
          </p>

          <p className="mt-1 font-data text-2xl font-extrabold">
            {profiles?.length ?? 0}
          </p>
        </div>

        <div className="rounded-sheet border border-line bg-surface p-3">
          <p className="text-xs font-bold text-muted">
            Multiple hazard signals
          </p>

          <p className="mt-1 font-data text-2xl font-extrabold text-warn">
            {multiHazardCount}
          </p>

          <p className="text-xs text-muted">
            Two or more classified signals
          </p>
        </div>

        <div className="col-span-2 rounded-sheet border border-line bg-surface p-3 sm:col-span-1">
          <p className="text-xs font-bold text-muted">
            Priority-ranked
          </p>

          <p className="mt-1 font-data text-2xl font-extrabold">
            {priorityRankedCount}
          </p>
        </div>
      </div>

      {/* ======================================================
          BARANGAY PROFILES
          ====================================================== */}

      <Section
        title={`Barangay profiles (${rows.length} of ${
          profiles?.length ?? 0
        })`}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Field
            label="Find a barangay"
            tip="Name, former name or district"
          >
            {(id) => (
              <Input
                id={id}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. Curva, Balion, west coast"
              />
            )}
          </Field>

          <Field label="Hazard filter">
            {(id) => (
              <Select
                id={id}
                value={hazard}
                onChange={(e) => setHazard(e.target.value)}
              >
                {Object.entries(HAZARD_FILTER).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <List>
          {rows.map((r) => {
            const exposure = getBarangayFloodExposure(r.p.psgc);
            const signals = hazardSignals(r);

            return (
              <ListRow
                key={r.p.psgc}
                tip="Open the DDRiVE profile and flood exposure detail"
                onClick={() => setOpen(r)}
                title={
                  <>
                    {r.p.name}

                    {r.p.former_name && (
                      <span className="ml-1 text-sm font-normal text-muted">
                        (was {r.p.former_name})
                      </span>
                    )}
                  </>
                }
                meta={[
                  `Pop. ${r.p.population_2024 ?? '—'} (2024)`,

                  exposure
                    ? `Flood-prone ${
                        exposure.pronePopulation.toLocaleString('en-PH')
                      } / ${
                        exposure.denominator.toLocaleString('en-PH')
                      } · ${exposure.exposurePercent.toFixed(3)}%`
                    : null,

                  signals >= 2
                    ? `Multi-hazard signals ${signals}`
                    : null,

                  r.p.cluster_no
                    ? `Cluster ${r.p.cluster_no} (proposed)`
                    : null,

                  r.pr?.priority_rank != null
                    ? `Priority ${r.pr.priority_rank}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  <Badge
                    tone={
                      r.f && hazardChip(r.f.susceptibility_class)
                        ? 'warn'
                        : 'neutral'
                    }
                  >
                    {hazardChip(r.f?.susceptibility_class ?? null) ??
                      (exposure
                        ? 'Flood exposure reported'
                        : r.p.urban_rural ?? '—')}
                  </Badge>
                }
              />
            );
          })}
        </List>
      </Section>

      {/* ======================================================
          BARANGAY DETAIL SHEET
          ====================================================== */}

      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `${open.p.name} — DDRiVE profile` : ''}
      >
        {open && <ProfileSheet r={open} />}
      </Sheet>
    </div>
  );
}

// ------------------------------------------------------------
// Reusable profile information row
// ------------------------------------------------------------

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="contents">
      <dt className="pt-1 text-sm font-semibold text-muted">
        {label}
      </dt>

      <dd className="text-sm leading-6">
        {value?.trim() ? value : '—'}
      </dd>
    </div>
  );
}

// ------------------------------------------------------------
// Barangay profile detail
// ------------------------------------------------------------

function ProfileSheet({ r }: { r: Profile }) {
  const { p, f, h, pr, v } = r;

  const val = (s: string | null | undefined) =>
    s && !/^not (available|assessed)/i.test(s.trim())
      ? s
      : null;

  const exposure = getBarangayFloodExposure(p.psgc);

  return (
    <div className="space-y-4">
      {/* General information */}

      <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1.5">
        <Row label="PSGC" value={p.psgc} />

        <Row label="Setting" value={p.urban_rural} />

        <Row
          label="Population"
          value={
            p.population_2024 != null
              ? `${p.population_2024.toLocaleString()} (2024 POPCEN); ${
                  p.population_2020?.toLocaleString()
                } (2020 CPH)`
              : null
          }
        />

        <Row
          label="Coordinates"
          value={`${p.lat}, ${p.lng} (WGS 84) · ${
            p.coord_validation ?? 'validation unknown'
          }`}
        />

        <Row
          label="Cluster"
          value={
            p.cluster_no
              ? `Cluster ${p.cluster_no} (proposed) — ${
                  p.cluster_validation ?? ''
                }`
              : p.cluster_label
          }
        />

        <Row
          label="Priority"
          value={
            pr?.priority_rank != null
              ? `Rank ${pr.priority_rank} of 85 · ${
                  pr.confidence ?? ''
                }`
              : null
          }
        />
      </dl>

      {/* Flood exposure */}

      <h3 className="border-b border-line pb-1 font-bold">
        Flood exposure
      </h3>

      <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1.5">
        <Row
          label="DDRiVE class"
          value={val(f?.susceptibility_class)}
        />

        <Row
          label="DDRiVE exposed"
          value={
            f?.exposed_population != null
              ? `${f.exposed_population.toLocaleString()} people (${
                  f.exposure_base_year ?? 'base year n.a.'
                })${
                  f.exposure_pct != null
                    ? ` — ${(f.exposure_pct * 100).toFixed(1)}% of base`
                    : ''
                }`
              : null
          }
        />

        <Row
          label="Assessment confidence"
          value={f?.confidence}
        />

        <Row
          label="Source report"
          value={
            exposure
              ? `${exposure.pronePopulation.toLocaleString()} / ${
                  exposure.denominator.toLocaleString()
                } (${exposure.exposurePercent.toFixed(3)}%)`
              : null
          }
        />

        <Row
          label="Susceptibility classes"
          value={
            exposure
              ? exposure.classes
                  .map(
                    (c) =>
                      `${c.name}: ${c.population.toLocaleString()}`,
                  )
                  .join('; ')
              : null
          }
        />

        <Row
          label="Scenario"
          value={val(f?.depth_scenario)}
        />

        <Row
          label="Source"
          value={val(f?.hazard_source)}
        />

        <Row
          label="Status"
          value={f?.validation_status}
        />
      </dl>

      {/* Population exposure */}

      {exposure && (
        <div className="rounded-control border border-line p-3">
          <p className="font-semibold">
            Population by age group and sex
          </p>

          {exposure.ageSexStatus === 'available' &&
          exposure.ageSex.length > 0 ? (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-xs">
                <thead>
                  <tr className="border-b border-line">
                    <th className="p-1 text-left">Age group</th>
                    <th className="p-1 text-right">M not prone</th>
                    <th className="p-1 text-right">M prone</th>
                    <th className="p-1 text-right">F not prone</th>
                    <th className="p-1 text-right">F prone</th>
                  </tr>
                </thead>

                <tbody>
                  {exposure.ageSex.map((a) => (
                    <tr
                      key={a.ageGroup}
                      className="border-b border-line"
                    >
                      <td className="p-1">
                        {a.ageGroup}
                      </td>

                      {[
                        a.maleNotProne,
                        a.maleProne,
                        a.femaleNotProne,
                        a.femaleProne,
                      ].map((n, i) => (
                        <td
                          key={i}
                          className="p-1 text-right tabular-nums"
                        >
                          {n ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Notice tone="warn">
              Age-sex detail not available in the readable source
              file. No values have been inferred.{' '}
              {exposure.notes ?? ''}
            </Notice>
          )}

          <p className="mt-2 text-xs text-muted">
            Source: {exposure.source}. Report denominator is kept
            separate from the 2024 POPCEN baseline.
          </p>
        </div>
      )}

      {/* Other hazards */}

      <h3 className="border-b border-line pb-1 font-bold">
        Other hazards (CDRA Table 3)
      </h3>

      <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1.5">
        <Row
          label="Landslide (rain)"
          value={val(h?.rain_landslide)}
        />

        <Row
          label="Landslide (quake)"
          value={val(h?.eq_landslide)}
        />

        <Row
          label="Ground shaking"
          value={val(h?.ground_shaking)}
        />

        <Row
          label="Ground rupture"
          value={val(h?.ground_rupture)}
        />

        <Row
          label="Liquefaction"
          value={val(h?.liquefaction)}
        />

        <Row
          label="Tsunami"
          value={val(h?.tsunami)}
        />

        <Row
          label="Storm surge"
          value={val(h?.storm_surge)}
        />
      </dl>

      {/* Vulnerability and capacity */}

      <h3 className="border-b border-line pb-1 font-bold">
        Vulnerability and capacity
      </h3>

      <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1.5">
        <Row
          label="Sensitivity"
          value={val(v?.social_sensitivity)}
        />

        <Row
          label="Access limits"
          value={val(v?.access_constraints)}
        />

        <Row
          label="Coping"
          value={val(v?.coping_capacity)}
        />

        <Row
          label="Adaptive"
          value={val(v?.adaptive_capacity)}
        />

        <Row
          label="Evacuation access"
          value={val(h?.evacuation_access)}
        />

        <Row
          label="Priority basis"
          value={val(pr?.basis)}
        />
      </dl>

      {/* Data provenance */}

      <p className="text-xs text-muted">
        Provenance: DDRiVE workbook v1.2 (9 Nov 2026) and the
        supplied Population_Prone_Flood report when present.
        Missing fields remain unassessed.
      </p>
    </div>
  );
}
