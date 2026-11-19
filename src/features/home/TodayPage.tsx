import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ClipboardCheck, FolderLock, ListChecks, NotebookPen, Settings, Siren, Users, 
  Workflow, Wrench, ShieldCheck, AlertCircle,
  Clock, Building2, ArrowUpRight, BookOpen
} from 'lucide-react';
import { ButtonAnchor, Badge, List, ListRow, Notice, TextLink } from '@/components/ui';
import { USER_GUIDE_LABEL, USER_GUIDE_TIP, USER_GUIDE_URL } from '@/lib/userGuide';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { useActiveDeclaration, useNow } from '@/lib/hooks';
import { cycleResults } from '@/domain/scoring';
import { priorityTiers } from '@/domain/dashboard';
import { statusCounts } from '@/domain/eoc_assessment';
import { nextDeadline } from '@/domain/aa';
import { canOperate } from '@/domain/eoc';
import { duration, fmtDateTime, fmtLongDate, fmtTime, manilaHour, relative } from '@/lib/time';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import GlassCard from '@/components/ui/GlassCard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { templateIsWorkflow } from '@/features/protocols/labels';
import { DECL_STATUS } from '@/features/eoc/aa/labels';
import { tip } from '@/components/Tooltip';
import { Seals } from '@/components/Brand';
import { canUseVault } from '@/features/vault/access';
import { CYCLE_STATUS } from '@/features/iat/labels';
import { PRIORITY_INDICATORS } from '@/features/iat/priority';
import { useT, type StringKey } from '@/lib/i18n';
import type { Indicator, Response } from '@/types';
import { Separator } from '@/components/ui/separator';
import { HazardWatch } from './HazardWatch';

const ValidationPanel = lazy(() => import('./dashboard/ValidationPanel'));

const GREET_KEYS = ['greet.morning', 'greet.afternoon', 'greet.evening'] as const;

// --- OPERATIONAL ANALYTICS (1.24.0) ---
// Every figure below is counted from rows on this device. Where there is nothing to count the panel says so;
// it never draws a trend, a zero or an "all clear" that the data does not support.

interface ShiftDelta { newLogs: number; newReports: number; openedReqs: number; newSitreps: number; declarationUpdates: number }

function ShiftDeltaStrip({ delta, since }: { delta: ShiftDelta; since: string }) {
  const metrics = [
    { label: 'Logbook entries', value: delta.newLogs, icon: NotebookPen, to: '/eoc/log' },
    { label: 'Barangay reports', value: delta.newReports, icon: Users, to: '/eoc/barangays' },
    { label: 'Requests opened', value: delta.openedReqs, icon: ListChecks, to: '/eoc/requests' },
    { label: 'Sitreps submitted', value: delta.newSitreps, icon: ClipboardCheck, to: '/eoc/sitreps' },
    { label: 'Declaration updates', value: delta.declarationUpdates, icon: Siren, to: '/eoc/aa', highlight: delta.declarationUpdates > 0 },
  ];
  return (
    <section aria-label="Since your last visit" className="mb-6">
      <p className="mb-2 text-sm text-muted">Since your last visit, {relative(since, Date.now())}.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {metrics.map((m) => (
          <Link key={m.label} to={m.to} {...tip(`Open ${m.label.toLowerCase()}`)} className={`min-h-tap rounded-sheet border border-line bg-surface p-4 transition hover:border-sky ${m.highlight ? 'ring-1 ring-bad/50' : ''}`}>
            <div className="mb-2 flex items-center justify-between"><m.icon className={`h-4 w-4 ${m.highlight ? 'text-bad' : 'text-sky'}`} aria-hidden /><ArrowUpRight className="h-3 w-3 text-muted" aria-hidden /></div>
            <div className="font-data text-2xl font-bold text-ink">{m.value}</div>
            <div className="mt-1 text-xs text-muted">{m.label}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

interface Quality { activation: boolean; barangays: number; staleBarangays: number; failedUploads: number; waiting: number; unconfirmedIat: number }

function DataQualityPanel({ q }: { q: Quality }) {
  const lines: { icon: typeof Clock; tone: string; text: string }[] = [];
  if (q.activation && q.barangays > 0 && q.staleBarangays > 0) lines.push({ icon: Clock, tone: 'text-warn', text: `${q.staleBarangays} of ${q.barangays} barangays have no report in the last 12 hours of this activation.` });
  if (q.failedUploads > 0) lines.push({ icon: AlertCircle, tone: 'text-bad', text: `${q.failedUploads} ${q.failedUploads === 1 ? 'change was' : 'changes were'} refused by the server. Open Settings, Sync to retry or discard.` });
  if (q.waiting > 0) lines.push({ icon: Clock, tone: 'text-muted', text: `${q.waiting} ${q.waiting === 1 ? 'change is' : 'changes are'} waiting to be sent from this device.` });
  if (q.unconfirmedIat > 0) lines.push({ icon: ShieldCheck, tone: 'text-muted', text: `${q.unconfirmedIat} pre-filled EOC capability answers still need confirming on site.` });
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg text-ink"><AlertCircle className="h-5 w-5 text-warn" aria-hidden />Data quality</CardTitle><CardDescription>What may be out of date or unsent on this device.</CardDescription></CardHeader>
      <CardContent>
        {lines.length ? <ul className="space-y-2 text-sm">{lines.map((l, i) => <li key={i} className={`flex items-start gap-2 ${l.tone}`}><l.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{l.text}</li>)}</ul>
          : <p className="flex items-center gap-2 text-sm text-ok"><ShieldCheck className="h-4 w-4" aria-hidden />Nothing waiting and nothing flagged on this device.</p>}
        {!q.activation && <p className="mt-2 text-xs text-muted">Barangay report freshness is checked only while the EOC is activated.</p>}
      </CardContent>
    </Card>
  );
}

interface Sites { total: number; fieldVerified: number; pending: number; training: number }

function EvacuationPanel({ sites }: { sites: Sites }) {
  return (
    <Card className="mb-6">
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
        <div><CardTitle className="flex items-center gap-2 text-lg text-ink"><Building2 className="h-5 w-5 text-ok" aria-hidden />Evacuation centres</CardTitle><CardDescription>How many registered sites have been verified in the field.</CardDescription></div>
        <TextLink tip="Open the evacuation centre register" size="sm" to="/tools/echo/camps">Open</TextLink>
      </CardHeader>
      <CardContent>
        {sites.total === 0 ? <p className="text-muted">No centres registered on this device yet.</p> : <>
          <p className="text-sm text-ink"><span className="font-data text-2xl font-bold">{sites.fieldVerified}</span> of {sites.total} field-verified</p>
          <p className="mt-1 text-sm text-muted">{sites.pending} pending field validation{sites.training > 0 && `, ${sites.training} training entries`}. A site that is not verified is not cleared for use.</p>
          <Progress className="mt-3" value={(100 * sites.fieldVerified) / sites.total} aria-label="Centres field-verified" />
        </>}
      </CardContent>
    </Card>
  );
}

// --- MAIN PAGE COMPONENT ---

export function TodayPage() {
  const t = useT();
  const { profile, roles, has, offlineIdentity } = useAuth();
  const now = useNow();
  const decl = useActiveDeclaration();

  // "Since your last visit": read once when the page opens, then stamp the visit. Never written inside the live query,
  // which re-runs on every change and would reset the window each time.
  const [since] = useState(() => {
    const fallback = new Date(Date.now() - 8 * 3_600_000).toISOString();
    try {
      const last = localStorage.getItem('lastTodayVisit');
      localStorage.setItem('lastTodayVisit', new Date().toISOString());
      return last ?? fallback;
    } catch { return fallback; }
  });

  const analytics = useLiveQuery(async () => {
    const staleBefore = new Date(Date.now() - 12 * 3_600_000).toISOString();
    const activation = await db.eoc_activations.filter((a) => !a.ended_at).first();
    const shiftDelta: ShiftDelta = {
      newLogs: await db.logbook_entries.where('occurred_at').above(since).count(),
      newReports: await db.barangay_reports.where('reported_at').above(since).count(),
      openedReqs: await db.resource_requests.where('requested_at').above(since).count(),
      newSitreps: await db.sitreps.filter((r) => !!r.submitted_at && r.submitted_at > since).count(),
      declarationUpdates: await db.declarations.filter((d) => (d.updated_at ?? '') > since).count(),
    };
    const barangays = await db.barangays.count();
    let staleBarangays = 0;
    if (activation && barangays > 0) {
      const fresh = new Set((await db.barangay_reports.where('reported_at').above(staleBefore).filter((r) => r.activation_id === activation.id).toArray()).map((r) => r.barangay_psgc));
      staleBarangays = Math.max(0, barangays - fresh.size);
    }
    const queued = await db.outbox.toArray();
    const quality: Quality = {
      activation: !!activation, barangays, staleBarangays,
      failedUploads: queued.filter((o) => !!o.lastError).length,
      waiting: queued.filter((o) => !o.lastError).length,
      unconfirmedIat: await db.eoc_assessment_responses.filter((r) => r.provenance === 'prefilled_iat').count(),
    };
    const centres = await db.evacuation_centers.toArray();
    const sites: Sites = {
      total: centres.length,
      fieldVerified: centres.filter((c) => c.verification_status === 'field_verified').length,
      pending: centres.filter((c) => c.verification_status === 'pending_field_validation').length,
      training: centres.filter((c) => c.verification_status === 'training').length,
    };
    return { shiftDelta, quality, sites };
  }, [since]);

  const data = useLiveQuery(async () => {
    const cycle = (await db.assessment_cycles.orderBy('cycle_year').reverse().toArray()).find((c) => c.status !== 'archived');
    const res = cycle ? cycleResults(await db.iat_indicators.toArray(), await db.iat_domains.toArray(), await db.responses.where('cycle_id').equals(cycle.id).toArray()) : null;
    const responses: Response[] = cycle ? await db.responses.where('cycle_id').equals(cycle.id).toArray() : [];
    const byId = new Map((await db.iat_indicators.toArray()).map((i) => [i.id, i]));
    const priority = PRIORITY_INDICATORS.map((p) => ({ ...p, indicator: byId.get(p.id) }))
      .filter((p): p is typeof p & { indicator: Indicator } => !!p.indicator)
      .map((p) => ({ ...p, response: responses.find((r) => r.indicator_id === p.indicator.id) }));
    return {
      cycle, res, priority,
      runs: await db.protocol_runs.where('status').equals('running').toArray(),
      log: await db.logbook_entries.orderBy('occurred_at').reverse().limit(5).toArray(),
      hazard: decl ? await db.hazards.get(decl.hazard_code) : undefined,
      overdueReport: (await db.declarations.where('status').equals('lifted').toArray()).find((d) => !d.report_submitted_at),
      templates: (await db.protocol_templates.toArray()).filter((t) => t.status !== 'retired'),
      forms: (await db.form_templates.toArray()).filter((f) => f.status !== 'retired'),
      docs: await db.moo_documents.where('manual').equals('MOO').toArray(),
      raciIssues: countAccountableIssues(await db.raci_activities.toArray(), await db.raci_assignments.toArray()),
      raciActivities: await db.raci_activities.count(),
      eocCap: await eocCapabilitySummary(),
    };
  }, [decl?.id]);

  const hour = manilaHour(now);
  const dl = decl ? nextDeadline(decl, now) : null;
  
  const quick = [
    canOperate(roles) && { to: '/eoc/log', label: 'Log an entry', icon: NotebookPen, tip: 'Write a time-stamped entry in the EOC logbook' },
    canOperate(roles) && { to: '/drrm/protocols', label: 'Run a protocol', icon: ListChecks, tip: 'Pick a CDRRMO procedure and follow it step by step' },
    canOperate(roles) && { to: '/eoc/barangays', label: 'Barangay status', icon: Users, tip: 'Record or check the latest report from each barangay' },
    has('cdrrmo_head', 'eoc_manager', 'eoc_staff') && { to: '/eoc/aa/pdra/new', label: 'New PDRA', icon: Siren, tip: 'Assess a forecast hazard and decide: monitor, act early or request a declaration' },
    has('assessor', 'validator', 'lead_office_focal') && { to: data?.cycle ? `/assess/${data.cycle.id}` : '/assess', label: 'Continue assessment', icon: ClipboardCheck, tip: 'Go back to the indicators you are scoring' },
    canUseVault(has) && { to: '/vault', label: 'Document Vault', icon: FolderLock, tip: 'Laws, guidelines and documents for Document Review' },
    { to: '/raci', label: 'RACI board', icon: Workflow, tip: 'Who is Responsible, Accountable, Consulted and Informed for each protocol, workflow and manual review step' },
    { to: '/tools', label: 'Tools and hazard maps', icon: Wrench, tip: 'ICS exercises, continuity plan, Gawad KALASAG readiness, HazardHunterPH, GeoAnalyticsPH, Zoom Earth, DDRiVE-M' },
  ].filter(Boolean) as { to: string; label: string; icon: typeof NotebookPen; tip: string }[];

  return (
    <div className="page">
      <GlassCard hover={false} className="mb-6">
        <header className="flex items-start justify-between gap-3 p-5">
          <div>
            <Seals size={44} className="mb-3 lg:hidden" />
            <p className="font-data text-sm font-semibold uppercase tracking-widest text-accent-ink">{fmtLongDate(now)}</p>
            <h1 className="mt-1 text-2xl font-extrabold lg:text-3xl text-ink">
              {t(GREET_KEYS[hour < 12 ? 0 : hour < 18 ? 1 : 2])}
              {profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
            </h1>
            <p className="mt-1 max-w-prose text-muted">{t('today.hero')}</p>
            
            {/* UPDATED: Added target and rel for external static file to preserve app state */}
            <ButtonAnchor 
              href={USER_GUIDE_URL} 
              variant="primary" 
              icon={BookOpen} 
              tip={USER_GUIDE_TIP} 
              className="mt-4"
              newTab
            >
              {USER_GUIDE_LABEL}
            </ButtonAnchor>
          </div>
          <div className="flex shrink-0 items-center gap-1 lg:hidden">
            <ThemeToggle />
            <Link to="/settings" {...tip('Settings: sync, users and roles, about, sign out')} className="inline-flex h-tap w-tap items-center justify-center rounded-control hover:bg-sunken" aria-label="Settings">
              <Settings className="h-5 w-5 text-muted" aria-hidden />
            </Link>
          </div>
        </header>
      </GlassCard>

      {offlineIdentity && <Notice tone="info" title="Working offline">You are using the last sign-in on this device. Your entries are kept here and sent when the connection returns.</Notice>}

      <HazardWatch />

      {roles.length > 0 && <Suspense fallback={<div className="mb-6 h-40" aria-hidden />}><ValidationPanel /></Suspense>}

      {analytics && (
        <>
          <ShiftDeltaStrip delta={analytics.shiftDelta} since={since} />
          <div className="grid gap-4 lg:grid-cols-2"><DataQualityPanel q={analytics.quality} /><EvacuationPanel sites={analytics.sites} /></div>
        </>
      )}

      {decl && (
        <Link to={`/eoc/aa/d/${decl.id}`} {...tip('Open the declaration: next legal step, anticipatory action checklist and funds')} className="mb-6 block rounded-sheet border-2 border-bad bg-bad-soft p-4 hover:opacity-95">
          <p className="font-bold text-bad">{DECL_STATUS[decl.status]}: {data?.hazard?.name ?? decl.hazard_code}</p>
          {dl && <p className="mt-1 text-lg font-bold text-ink">{dl.label} {dl.overdue ? 'was' : 'is'} {fmtDateTime(dl.due)}{!dl.overdue && `, ${duration(dl.hoursLeft)} from now`}</p>}
          <p className="mt-1 text-sm text-ink">Open the declaration for the next step, the anticipatory action checklist and funds.</p>
        </Link>
      )}
      
      {data?.overdueReport && !decl && (
        <Notice tone={new Date(data.overdueReport.report_due_at ?? 0).getTime() < now.getTime() ? 'bad' : 'warn'} title="Report to OCD outstanding"
          action={<TextLink tip="Open the declaration to record the report" to={`/eoc/aa/d/${data.overdueReport.id}`}>Open the declaration</TextLink>}>
          Due {fmtDateTime(data.overdueReport.report_due_at)}.
        </Notice>
      )}

      {quick.length > 0 && (
        <nav aria-label="Quick actions" className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {quick.map(({ to, label, icon: Icon, tip: t }) => (
            <Link key={label} to={to} {...tip(t)} className="group flex min-h-[5.5rem] flex-col justify-between rounded-sheet border border-line bg-surface p-3 font-semibold shadow-raised transition hover:-translate-y-0.5 hover:border-sky hover:shadow-sheet motion-reduce:hover:translate-y-0">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-soft text-sky group-hover:bg-sky group-hover:text-on-strong"><Icon className="h-5 w-5" aria-hidden /></span>
              <span className="text-ink">{label}</span>
            </Link>
          ))}
        </nav>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg text-ink">Protocols running</CardTitle><CardDescription>Runs in progress on any device.</CardDescription></CardHeader>
          <CardContent>
            {!data ? <TodaySkeleton /> : data.runs.length ? <List>{data.runs.map((r) => <ListRow tip="Continue this protocol run" key={r.id} to={`/drrm/run/${r.id}`} title={r.title} meta={`Started ${relative(r.started_at, now.getTime())}`} />)}</List>
              : <p className="text-muted">None running.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div><CardTitle className="text-lg text-ink">Latest logbook entries</CardTitle><CardDescription>The five most recent entries.</CardDescription></div>
            <TextLink tip="Open the EOC logbook" size="sm" to="/eoc/log">Logbook</TextLink>
          </CardHeader>
          <CardContent>
            {!data ? <TodaySkeleton /> : data.log.length ? <List>{data.log.map((l) => <ListRow key={l.id} title={l.entry} meta={fmtTime(l.occurred_at)} />)}</List> : <p className="text-muted">No entries yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div><CardTitle className="text-lg text-ink">Institutional assessment</CardTitle><CardDescription>Scoring progress of the current cycle.</CardDescription></div>
            <TextLink tip="See all assessment cycles" size="sm" to="/assess">All cycles</TextLink>
          </CardHeader>
          <CardContent>
            {!data ? <TodaySkeleton /> : data.cycle && data.res ? (
              <Link to={`/assess/${data.cycle.id}`} {...tip('Open this assessment cycle')} className="block rounded-control p-1 hover:bg-sky-soft/60">
                <p className="font-semibold text-ink">{data.cycle.name} <Badge className="ml-1">{CYCLE_STATUS[data.cycle.status]}</Badge></p>
                <p className="mb-3 text-sm text-muted">{data.res.answered} of {data.res.total} answered{data.res.imi.maturityIndex !== null && `. Maturity ${data.res.imi.maturityIndex.toFixed(2)}, ${data.res.imi.band}`}</p>
                <Progress value={data.res.total ? (100 * data.res.answered) / data.res.total : 0} aria-label="Indicators answered" />
              </Link>
            ) : <p className="text-muted">No assessment cycle yet.</p>}
          </CardContent>
        </Card>
        <ManualReadiness data={data} />
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div><CardTitle className="text-lg text-ink">RACI board</CardTitle><CardDescription>Who does what, from MOO Annex 1-F.</CardDescription></div>
            <TextLink tip="Open the interactive RACI board" size="sm" to="/raci">Open</TextLink>
          </CardHeader>
          <CardContent>
            {!data ? <TodaySkeleton /> : (
              <Link to="/raci" {...tip('Search a protocol or activity and see its colour-coded RACI')} className="block rounded-control p-1 hover:bg-sky-soft/60">
                <p className="font-semibold text-ink">{data.raciActivities} activities mapped</p>
                <p className="text-sm text-muted">
                  {data.raciIssues === 0 ? 'Every activity has exactly one Accountable.' : `${data.raciIssues} ${data.raciIssues === 1 ? 'activity needs' : 'activities need'} an Accountable check.`}
                </p>
              </Link>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div><CardTitle className="text-lg text-ink">EOC capability</CardTitle><CardDescription>The 154-item OCD/NDRRMC checklist against the IAT B_EOC evidence.</CardDescription></div>
            <TextLink tip="Open the EOC capability assessment board" size="sm" to="/eoc-assessment">Open</TextLink>
          </CardHeader>
          <CardContent>
            {!data ? <TodaySkeleton /> : !data.eocCap ? <p className="text-muted">Arrives with the next reference-data sync.</p> : (
              <Link to="/eoc-assessment" {...tip('Open the capability board by section')} className="block rounded-control p-1 hover:bg-sky-soft/60">
                <p className="font-semibold text-ink">{data.eocCap.run.title} <Badge className="ml-1">{data.eocCap.run.status === 'validated' ? 'Validated' : 'Draft'}</Badge></p>
                <p className="mb-3 text-sm text-muted">
                  {data.eocCap.counts.met} met · {data.eocCap.counts.partially_met} partially · {data.eocCap.counts.largely_unmet} largely unmet · {data.eocCap.counts.not_met} not met
                  {data.eocCap.counts.no_direct_indicator > 0 && ` · ${data.eocCap.counts.no_direct_indicator} no direct indicator`}
                  {data.eocCap.prefilled > 0 && ` · ${data.eocCap.prefilled} pre-filled from the IAT, to confirm on site`}
                </p>
                <Progress value={data.eocCap.total ? (100 * data.eocCap.counts.met) / data.eocCap.total : 0} variant={data.eocCap.counts.met === data.eocCap.total && data.eocCap.total ? 'success' : 'default'} aria-label="Checklist items met" />
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
      <ParetoCard data={data} t={t} />
    </div>
  );
}

/** 1.19 (ADR-033): activities whose Accountable count is not the normal one (Annex 1-F: "normally one"). */
function countAccountableIssues(activities: { id: string }[], assignments: { activity_id: string; duty: string }[]): number {
  const aCount = new Map<string, number>();
  for (const s of assignments) if (s.duty === 'A') aCount.set(s.activity_id, (aCount.get(s.activity_id) ?? 0) + 1);
  return activities.filter((a) => (aCount.get(a.id) ?? 0) !== 1).length;
}

/** 1.20 (ADR-035): the latest capability run and how its 154 items stand. */
async function eocCapabilitySummary() {
  const runs = (await db.eoc_assessment_runs.toArray()).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const run = runs[0];
  if (!run) return null;
  const responses = (await db.eoc_assessment_responses.where('run_id').equals(run.id).toArray()).filter((r) => (r.site ?? 'primary') === 'primary');
  const counts = statusCounts(responses.map((r) => r.status));
  const prefilled = responses.filter((r) => r.provenance === 'prefilled_iat').length;
  return { run, answered: responses.length, total: await db.eoc_assessment_items.count(), counts, prefilled };
}

/** 1.17 (ADR-031): the Pareto dashboard — the 23 priority indicators in three tiers, met counts from the current IAT cycle. */
function ParetoCard({ data, t }: { data?: { cycle?: { id: string; name: string }; priority: { id: string; tier: 1 | 2 | 3; indicator: Pick<Indicator, 'id' | 'statement'>; response?: Response }[] }; t: (k: StringKey) => string }) {
  const TIER_KEY = { 1: 'today.pareto.tier1', 2: 'today.pareto.tier2', 3: 'today.pareto.tier3' } as const;
  if (!data) return <div className="mt-4"><Card><CardContent className="pt-6"><TodaySkeleton /></CardContent></Card></div>;
  // ADR-044 principle 4: an unscored indicator is "not yet scored", never "needs work"; N/A leaves the count.
  const { rows, needsWork } = priorityTiers(data.priority);
  const unmet = needsWork.slice(0, 5);
  return (
    <div className="mt-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg text-ink">{t('today.pareto.title')}</CardTitle>
            <CardDescription>{t('today.pareto.about')}</CardDescription>
          </div>
          {data.cycle && <TextLink tip="Open the current assessment cycle" size="sm" to={`/assess/${data.cycle.id}`}>{data.cycle.name}</TextLink>}
        </CardHeader>
        <CardContent className="space-y-3">
          {!data.cycle ? <p className="text-muted">{t('today.pareto.none')}</p> : <>
            {rows.map(({ tier, met, total, unscored }, i) => (
              <div key={tier}>
                {i > 0 && <Separator className="mb-3" />}
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold text-ink">{'★'.repeat(4 - tier)} {t(TIER_KEY[tier])}</span>
                  <span className="font-data text-muted">{met} of {total} {t('today.pareto.met')}{unscored > 0 && ` · ${unscored} ${t('today.pareto.unscored')}`}</span>
                </div>
                <Progress value={total ? (100 * met) / total : 0} variant={met === total && total > 0 ? 'success' : 'default'} aria-label={`Priority tier ${tier} met`} />
              </div>
            ))}
            {unmet.length > 0 && <>
              <Separator />
              <List>
                {unmet.map((p) => <ListRow key={p.id} tip="Score this indicator in the assessment" to={data.cycle ? `/assess/${data.cycle.id}/i/${p.id}` : '/assess'} title={p.id} meta={`${p.indicator.statement} · ${t(TIER_KEY[p.tier])} · ${t('today.pareto.unmet')}`} />)}
              </List>
            </>}
          </>}
        </CardContent>
      </Card>
    </div>
  );
}

function TodaySkeleton() {
  return <div className="space-y-2" aria-hidden><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-5 w-2/3" /></div>;
}

/** How much of the Manual is ready to use: approved templates and forms, drafted chapters (1.11.0). */
function ManualReadiness({ data }: { data?: { templates: { status: string; kind?: string; category: string }[]; forms: { status: string }[]; docs: { kind: string; chapter_no?: number | null }[] } }) {
  if (!data) return <Card><CardContent className="pt-6"><TodaySkeleton /></CardContent></Card>;
  const protocols = data.templates.filter((t) => !templateIsWorkflow(t as never));
  const workflows = data.templates.filter((t) => templateIsWorkflow(t as never));
  const rows = [
    { label: 'Protocols', to: '/drrm/protocols', total: protocols.length, approved: protocols.filter((t) => t.status === 'approved').length, tip: 'Point-of-action checklists: approved out of all' },
    { label: 'Workflows', to: '/drrm', total: workflows.length, approved: workflows.filter((t) => t.status === 'approved').length, tip: 'Management cycles across offices: approved out of all' },
    { label: 'Forms', to: '/drrm/forms', total: data.forms.length, approved: data.forms.filter((f) => f.status === 'approved').length, tip: 'Records that close each step: approved out of all' },
  ];
  const chapters = new Set(data.docs.filter((d) => d.kind === 'chapter' && d.chapter_no != null).map((d) => d.chapter_no)).size;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
        <div><CardTitle className="text-lg text-ink">Manual readiness</CardTitle><CardDescription>{chapters} chapter{chapters === 1 ? '' : 's'} drafted. Approval is by the CDRRMO Head after validation.</CardDescription></div>
        <TextLink tip="Open the Manual of Operations" size="sm" to="/library">Library</TextLink>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <Link key={r.label} to={r.to} {...tip(r.tip)} className="block rounded-control p-1 hover:bg-sky-soft/60">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm"><span className="font-semibold text-ink">{r.label}</span><span className="font-data text-muted">{r.total ? `${r.approved} of ${r.total} approved` : 'Arrives with the next sync'}</span></div>
            <Progress value={r.total ? (100 * r.approved) / r.total : 0} variant={r.approved === r.total && r.total ? 'success' : 'default'} aria-label={`${r.label} approved`} />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
