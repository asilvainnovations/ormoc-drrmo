// Ormoc City MODE — EOC Barangay Status & CSWD District Workspace
// CSWD district assignments are a separate dimension from CDRRMO operational
// clusters (Barangay.cluster_id). The page remains usable offline and preserves
// the existing report, activation, flood-exposure and DDRiVE workflows.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { MapPinned, UsersRound, Search, X } from 'lucide-react';

import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import {
  barangayReportProblem,
  canOperate,
  currentLevel,
  parseCount,
} from '@/domain/eoc';
import { getBarangayFloodExposure } from '@/domain/floodExposure';
import { fmtDateTime, relative } from '@/lib/time';

import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Notice,
  PageHeader,
  Tabs,
  Textarea,
} from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';

import type { BarangayCondition, BarangayReport } from '@/types';
import {
  COND_LABEL,
  COND_ORDER,
  COND_STYLE,
  Chips,
  Legend,
  Stepper,
  type Cond,
} from './kit';
import { BarangayGrid, type CSWDPictureRow } from './BarangayPicture';
import { useBarangayPicture, type PictureRow } from './useBarangayPicture';
import {
  CSWD_DISTRICTS,
  CSWD_OFFICIAL_BARANGAY_COUNT,
  getCSWDDistrict,
} from './cswdDistricts';
import { EOC_TABS } from './labels';

const CHANNELS = [
  { value: 'radio', label: 'Radio' },
  { value: 'sms', label: 'SMS' },
  { value: 'call', label: 'Call' },
  { value: 'app', label: 'This app' },
  { value: 'in_person', label: 'In person' },
];

const CONDITIONS: BarangayCondition[] = [
  'normal',
  'monitoring',
  'affected',
  'evacuating',
  'isolated',
];

const blank = (channel: string) => ({
  condition: 'monitoring' as BarangayCondition,
  families: '',
  persons: '',
  remarks: '',
  channel,
});

const districtNumber = (code: string) => Number(code.replace(/\D/g, ''));

export function BarangaysPage() {
  const { roles } = useAuth();
  const toast = useToast();
  const pic = useBarangayPicture();
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Cond | null>(null);
  const [districtFilter, setDistrictFilter] = useState<string | null>(null);
  const [target, setTarget] = useState<PictureRow | null>(null);
  const [form, setForm] = useState(blank('radio'));
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const operator = canOperate(roles);

  // Attach the CSWD administrative assignment without changing the
  // existing CDRRMO operational cluster returned by useBarangayPicture().
  const districtRows = useMemo<CSWDPictureRow[]>(() => {
    return (pic?.rows ?? []).map((row) => ({
      ...row,
      cswdDistrict: getCSWDDistrict(row.b.name),
    }));
  }, [pic?.rows]);

  const districtStats = useMemo(() => {
    return CSWD_DISTRICTS.map((district) => {
      const assignedRows = districtRows.filter(
        (row) => row.cswdDistrict?.code === district.code,
      );

      const counts: Record<Cond, number> = {
        silent: 0,
        normal: 0,
        monitoring: 0,
        affected: 0,
        evacuating: 0,
        isolated: 0,
      };

      for (const row of assignedRows) counts[row.cond] += 1;

      const reporting = assignedRows.length - counts.silent;

      return {
        ...district,
        rows: assignedRows,
        loaded: assignedRows.length,
        reporting,
        counts,
        coverage: district.barangays.length
          ? Math.round((assignedRows.length / district.barangays.length) * 100)
          : 0,
        reportingRate: assignedRows.length
          ? Math.round((reporting / assignedRows.length) * 100)
          : 0,
      };
    });
  }, [districtRows]);

  const unmatchedRows = useMemo(
    () => districtRows.filter((row) => !row.cswdDistrict),
    [districtRows],
  );

  const rows = useMemo(() => {
    const query = q.trim().toLocaleLowerCase('en');

    return districtRows
      .filter((row) => !query || row.b.name.toLocaleLowerCase('en').includes(query))
      .filter((row) => !filter || row.cond === filter)
      .filter(
        (row) =>
          !districtFilter || row.cswdDistrict?.code === districtFilter,
      )
      .sort((a, b) => {
        const districtOrder =
          districtNumber(a.cswdDistrict?.code ?? '') -
          districtNumber(b.cswdDistrict?.code ?? '');
        return districtOrder || a.b.name.localeCompare(b.b.name);
      });
  }, [districtRows, q, filter, districtFilter]);

  const open = (row: PictureRow) => {
    setForm({
      ...blank(form.channel),
      condition:
        row.report && row.cond !== 'silent'
          ? row.report.condition
          : 'monitoring',
    });
    setProblem(null);
    setTarget(row);
  };

  // Deep link from the EOC Board: /eoc/barangays?b=<PSGC>.
  useEffect(() => {
    const wanted = params.get('b');
    if (!wanted || !pic || !operator) return;

    const row = districtRows.find((item) => item.b.psgc === wanted);
    if (row) {
      open(row);
      setParams({}, { replace: true });
    }
    // open() intentionally uses the current reporting channel and form state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pic, districtRows, operator, setParams]);

  const record = async () => {
    if (!target || saving) return;

    const validation = barangayReportProblem(form);
    if (validation) {
      setProblem(validation);
      return;
    }

    setSaving(true);
    setProblem(null);

    try {
      const { activation } = currentLevel(
        await db.eoc_activations.toArray(),
      );
      const count = (value: string) => {
        const parsed = parseCount(value);
        return typeof parsed === 'number' ? parsed : null;
      };

      const now = new Date().toISOString();
      const report: BarangayReport & { _new: true } = {
        _new: true,
        id: uuid(),
        barangay_psgc: target.b.psgc,
        activation_id: activation?.id ?? null,
        reported_at: now,
        condition: form.condition,
        families_evacuated: count(form.families),
        persons_evacuated: count(form.persons),
        remarks: form.remarks.trim() || null,
        channel: form.channel,
        created_at: now,
      };

      await save(
        'barangay_reports',
        report,
        `Status report: ${target.b.name}`,
      );

      const barangayName = target.b.name;
      setTarget(null);
      toast(`${barangayName}: ${COND_LABEL[report.condition].toLowerCase()}`);
    } catch (error) {
      console.error('[EOC] Unable to save barangay status report:', error);
      setProblem(
        'The report could not be saved. Your entries are still on screen; check storage or connectivity and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const silentPriority = districtRows
    .filter((row) => row.cond === 'silent' && row.priority != null)
    .sort((a, b) => a.priority! - b.priority!)
    .slice(0, 6);

  const num = (value: string) => Number(value) || 0;
  const totalReporting = districtRows.filter(
    (row) => row.cond !== 'silent',
  ).length;
  const totalAffected =
    (pic?.counts.affected ?? 0) +
    (pic?.counts.evacuating ?? 0) +
    (pic?.counts.isolated ?? 0);

  return (
    <div className="page">
      <PageHeader
        title="Barangays"
        subtitle={
          pic
            ? pic.window.kind === 'event'
              ? `Latest report per barangay since this activation began, ${fmtDateTime(pic.window.from)}.`
              : 'White level: latest report per barangay in the last 24 hours.'
            : 'Barangay status monitoring and CSWD/CDRRMO district coordination.'
        }
      />
      <Tabs items={EOC_TABS} />

      {!pic ? (
        <div
          className="rounded-sheet border border-line bg-surface p-6 text-center text-sm text-muted"
          role="status"
          aria-live="polite"
        >
          Loading the latest barangay picture…
        </div>
      ) : pic.rows.length === 0 ? (
        <EmptyState
          title="No barangays loaded"
          body="An administrator imports the barangay list (PSGC code and name) in Settings."
        />
      ) : (
        <div className="space-y-6">
          {/* CSWD district command-and-coordination overview */}
          <section aria-labelledby="cswd-district-title" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-info-soft text-info">
                  <MapPinned size={21} aria-hidden />
                </span>
                <div>
                  <h2
                    id="cswd-district-title"
                    className="text-lg font-extrabold tracking-tight text-ink"
                  >
                    CDRRMO/CSWDO District Coordination
                  </h2>
                  <p className="mt-0.5 max-w-2xl text-sm text-muted">
                    Six administrative districts for social welfare coordination
                    and evacuation-camp support, .
                  </p>
                </div>
              </div>

              <Badge tone="info">
                {CSWD_DISTRICTS.length} districts · {CSWD_OFFICIAL_BARANGAY_COUNT} barangays
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {districtStats.map((district, index) => {
                const active = districtFilter === district.code;
                const noReport = district.counts.silent;
                const tone =
                  district.counts.isolated > 0
                    ? 'bad'
                    : district.counts.evacuating + district.counts.affected > 0
                      ? 'warn'
                      : district.reporting > 0
                        ? 'ok'
                        : 'neutral';

                return (
                  <button
                    key={district.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setDistrictFilter(active ? null : district.code)
                    }
                    className={clsx(
                      'group relative min-w-0 overflow-hidden rounded-sheet border bg-surface p-4 text-left',
                      'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                      active
                        ? 'border-info ring-2 ring-info/40'
                        : 'border-line hover:border-info/50',
                    )}
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <div className="absolute -right-7 -top-8 h-24 w-24 rounded-full bg-info/5 transition-transform duration-300 group-hover:scale-125" />

                    <div className="relative space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-info">
                            CSWD cluster
                          </p>
                          <h3 className="mt-1 text-lg font-extrabold text-ink">
                            {district.name}
                          </h3>
                        </div>
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-info-soft font-data text-sm font-black text-info">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>

                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted">Barangays matched</p>
                          <p className="font-data text-2xl font-black text-ink">
                            {district.loaded}
                            <span className="ml-1 text-sm font-semibold text-muted">
                              / {district.barangays.length}
                            </span>
                          </p>
                        </div>
                        <Badge tone={tone}>
                          {district.counts.isolated
                            ? `${district.counts.isolated} isolated`
                            : district.counts.evacuating
                              ? `${district.counts.evacuating} evacuating`
                              : district.reporting
                                ? `${district.reporting} reporting`
                                : 'Awaiting reports'}
                        </Badge>
                      </div>

                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-line"
                        role="progressbar"
                        aria-label={`${district.name} barangay-list matching`}
                        aria-valuemin={0}
                        aria-valuemax={district.barangays.length}
                        aria-valuenow={district.loaded}
                      >
                        <div
                          className="h-full rounded-full bg-info transition-[width] duration-500"
                          style={{
                            width: `${Math.min(100, district.coverage)}%`,
                          }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                        {district.counts.isolated > 0 && (
                          <span className="rounded-full bg-bad-soft px-2 py-1 text-bad">
                            Isolated {district.counts.isolated}
                          </span>
                        )}
                        {district.counts.evacuating > 0 && (
                          <span className="rounded-full bg-warn-soft px-2 py-1 text-warn">
                            Evacuating {district.counts.evacuating}
                          </span>
                        )}
                        {district.counts.affected > 0 && (
                          <span className="rounded-full bg-warn-soft px-2 py-1 text-warn">
                            Affected {district.counts.affected}
                          </span>
                        )}
                        {district.counts.monitoring > 0 && (
                          <span className="rounded-full bg-sky-soft px-2 py-1 text-sky">
                            Monitoring {district.counts.monitoring}
                          </span>
                        )}
                        {district.counts.normal > 0 && (
                          <span className="rounded-full bg-ok-soft px-2 py-1 text-ok">
                            Normal {district.counts.normal}
                          </span>
                        )}
                        {noReport > 0 && (
                          <span className="rounded-full border border-dashed border-line px-2 py-1 text-muted">
                            No report {noReport}
                          </span>
                        )}
                        {district.loaded === 0 && (
                          <span className="text-muted">
                            No matching barangay records loaded
                          </span>
                        )}
                      </div>

                      <div className="border-t border-line pt-3">
                        <div className="flex items-start gap-2">
                          <UsersRound
                            size={15}
                            className="mt-0.5 shrink-0 text-muted"
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                              District Camp Coordinator
                            </p>
                            <p className="mt-0.5 text-sm font-bold text-ink">
                              {district.coordinator}
                            </p>
                            <p className="mt-0.5 text-xs leading-5 text-muted">
                              {district.coordinatorTitle}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 pl-6 text-xs text-muted">
                          Assistant: <span className="font-semibold text-ink">{district.assistant}</span>
                        </p>
                      </div>

                      <p className="flex items-center justify-between text-xs font-semibold text-info">
                        {active ? 'District filter active' : 'View this district'}
                        <span aria-hidden>{active ? '−' : '→'}</span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-sheet border border-line bg-sunken/50 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-ink">
                  Citywide barangay reporting
                </p>
                <p className="text-xs text-muted">
                  Latest reporting period · all loaded barangay records
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-data text-xl font-black text-ink">
                    {totalReporting}
                    <span className="text-sm font-semibold text-muted">
                      {' '}/ {pic.rows.length}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted">Reporting</p>
                </div>
                <div className="h-8 w-px bg-line" />
                <div className="text-right">
                  <p className="font-data text-xl font-black text-ink">
                    {totalAffected}
                  </p>
                  <p className="text-[11px] text-muted">Affected / response</p>
                </div>
              </div>
            </div>

            {unmatchedRows.length > 0 && (
              <Notice
                tone="warn"
                title={`${unmatchedRows.length} barangay record(s) need CSWD district matching`}
              >
                These records remain visible under “CSWD district not matched”
                rather than being silently assigned to an incorrect district:{' '}
                {unmatchedRows.map((row) => row.b.name).join(', ')}.
                Review the imported barangay names against the official CSWD list.
              </Notice>
            )}
          </section>

          {/* Search and condition filters */}
          <section aria-labelledby="barangay-status-title" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="barangay-status-title"
                  className="text-lg font-extrabold tracking-tight text-ink"
                >
                  Barangay Status Monitoring
                </h2>
                <p className="text-sm text-muted">
                  Select a barangay tile to record its latest operational condition.
                </p>
              </div>
              {districtFilter && (
                <Button
                  tip="Clear the selected CSWD district filter"
                  variant="quiet"
                  size="md"
                  icon={X}
                  onClick={() => setDistrictFilter(null)}
                >
                  Clear district
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div
                role="group"
                aria-label="Filter barangays by condition"
                className="flex flex-wrap gap-2"
              >
                {COND_ORDER.map((condition) => (
                  <button
                    key={condition}
                    type="button"
                    aria-pressed={filter === condition}
                    onClick={() =>
                      setFilter(filter === condition ? null : condition)
                    }
                    className={clsx(
                      'flex min-h-tap items-center gap-2 rounded-full border bg-surface px-3 text-sm font-bold transition-all',
                      filter === condition
                        ? 'border-ink ring-2 ring-ink'
                        : 'border-line hover:border-info',
                    )}
                  >
                    <span
                      className={clsx(
                        'inline-block h-3.5 w-3.5 rounded-sm border',
                        COND_STYLE[condition],
                      )}
                    />
                    {COND_LABEL[condition]}
                    <span className="font-data">{pic.counts[condition]}</span>
                  </button>
                ))}
              </div>

              <Field label="Find a barangay">
                {(id) => (
                  <div className="relative w-full sm:w-64">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                      aria-hidden
                    />
                    <Input
                      id={id}
                      type="search"
                      className="w-full pl-9"
                      placeholder="Search barangay name…"
                      value={q}
                      onChange={(event) => setQ(event.target.value)}
                    />
                  </div>
                )}
              </Field>
            </div>

            {(districtFilter || filter || q) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>Active filters:</span>
                {districtFilter && <Badge tone="info">{districtFilter}</Badge>}
                {filter && <Badge>{COND_LABEL[filter]}</Badge>}
                {q && <Badge>Search: {q}</Badge>}
                <span>{rows.length} matching barangays</span>
              </div>
            )}
          </section>

          {/* Priority warning */}
          {silentPriority.length > 0 && pic.activation && (
            <Notice
              tone="warn"
              title="High-risk barangays still silent"
            >
              {silentPriority
                .map((row) => `${row.b.name} (#${row.priority})`)
                .join(', ')}. Call these first; the number is the DDRiVE priority rank.
            </Notice>
          )}

          {/* CSWD district-grouped status tiles */}
          <section aria-label="Barangays grouped by CSWD district">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-ink">
                  Barangay Status by CSWD District
                </h3>
                <p className="text-xs text-muted">
                  Tiles show the latest report in the active reporting window.
                  Dashed tiles indicate no report in this period.
                </p>
              </div>
              <Badge tone="info">{rows.length} results</Badge>
            </div>

            {rows.length > 0 ? (
              <BarangayGrid
                rows={rows}
                groupByCSWDDistrict
                onPick={operator ? open : undefined}
              />
            ) : (
              <EmptyState
                title="No barangays match these filters"
                body="Clear one or more filters or search using another barangay name."
              />
            )}
          </section>

          {!operator && (
            <p className="text-sm text-muted">
              Reports are recorded by the EOC duty team.
            </p>
          )}

          <div className="mt-6">
            <Legend />
          </div>
        </div>
      )}

      {/* Barangay reporting sheet — existing operational workflow retained. */}
      <Sheet
        open={!!target}
        onClose={() => {
          if (!saving) setTarget(null);
        }}
        title={
          target
            ? `${target.b.name}${
                getCSWDDistrict(target.b.name)
                  ? ` · ${getCSWDDistrict(target.b.name)!.code}`
                  : ''
              }`
            : ''
        }
        footer={
          <>
            <Button
              tip="Close without saving"
              variant="secondary"
              disabled={saving}
              onClick={() => setTarget(null)}
            >
              Cancel
            </Button>
            <Button
              tip="Save this report. It works offline and synchronizes when connectivity returns."
              busy={saving}
              onClick={record}
            >
              Record report
            </Button>
          </>
        }
      >
        {target && (
          <div className="space-y-5">
            <div className="rounded-control border border-line bg-sunken/50 p-3">
              <p className="text-sm text-muted">
                {target.report
                  ? `Last report ${relative(target.report.reported_at)}: ${COND_LABEL[target.cond].toLowerCase()}.`
                  : 'No report yet in this period.'}
                {(() => {
                  const exposure = getBarangayFloodExposure(target.b.psgc);
                  return exposure
                    ? ` Flood-prone: ${exposure.pronePopulation.toLocaleString('en-PH')} of ${exposure.denominator.toLocaleString('en-PH')} people.`
                    : '';
                })()}
              </p>
              {target.priority != null && (
                <Badge tone="info" className="mt-2">
                  DDRiVE #{target.priority}
                </Badge>
              )}
            </div>

            {problem && <Notice tone="bad">{problem}</Notice>}

            <div>
              <p className="mb-2 text-sm font-bold">Condition</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CONDITIONS.map((condition) => (
                  <button
                    key={condition}
                    type="button"
                    aria-pressed={form.condition === condition}
                    onClick={() => {
                      setForm({
                        ...form,
                        condition,
                        ...(condition === 'evacuating' && form.persons === ''
                          ? { families: '0', persons: '0' }
                          : {}),
                      });
                      setProblem(null);
                    }}
                    className={clsx(
                      'min-h-[3.25rem] rounded-control border text-sm font-extrabold transition-all duration-150 hover:brightness-95',
                      COND_STYLE[condition],
                      form.condition === condition
                        ? 'ring-4 ring-ink/70'
                        : 'opacity-80',
                    )}
                  >
                    {COND_LABEL[condition]}
                  </button>
                ))}
              </div>
            </div>

            {form.condition === 'evacuating' && (
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-sm font-bold">Families evacuated</p>
                  <Stepper
                    label="families evacuated"
                    value={num(form.families)}
                    onChange={(value) =>
                      setForm({ ...form, families: String(value) })
                    }
                    jumps={[1, 5, 10, 50]}
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm font-bold">Persons evacuated</p>
                  <Stepper
                    label="persons evacuated"
                    value={num(form.persons)}
                    onChange={(value) =>
                      setForm({ ...form, persons: String(value) })
                    }
                    jumps={[1, 5, 10, 50]}
                  />
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-info underline"
                  onClick={() =>
                    setForm({ ...form, families: '', persons: '' })
                  }
                >
                  Counts not reported yet
                </button>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-bold">Received by</p>
              <Chips
                label="Received by"
                value={form.channel}
                onChange={(value) =>
                  setForm({ ...form, channel: value })
                }
                options={CHANNELS}
              />
            </div>

            <Field label="Remarks" optional>
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={form.remarks}
                  onChange={(event) =>
                    setForm({ ...form, remarks: event.target.value })
                  }
                  placeholder="Add relevant field observations or coordination notes…"
                />
              )}
            </Field>
          </div>
        )}
      </Sheet>
    </div>
  );
}
