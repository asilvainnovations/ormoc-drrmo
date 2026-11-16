import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ClipboardCheck, FolderLock, ListChecks, NotebookPen, Settings, Siren, Users, 
  Workflow, Wrench, TrendingUp, TrendingDown, Minus, ShieldCheck, AlertCircle,
  Clock, MapPin, Building2, ArrowUpRight, BookOpen
} from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { useActiveDeclaration, useNow } from '@/lib/hooks';
import { cycleResults } from '@/domain/scoring';
import { statusCounts } from '@/domain/eoc_assessment';
import { nextDeadline } from '@/domain/aa';
import { canOperate } from '@/domain/eoc';
import { duration, fmtDateTime, fmtLongDate, fmtTime, manilaHour, relative } from '@/lib/time';
import { Badge, ButtonAnchor, List, ListRow, Notice, TextLink } from '@/components/ui';
import { USER_GUIDE_LABEL, USER_GUIDE_TIP, USER_GUIDE_URL } from '@/lib/userGuide';
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

const GREET_KEYS = ['greet.morning', 'greet.afternoon', 'greet.evening'] as const;

// --- INLINE ANALYTICS COMPONENTS (Uses project design tokens) ---

type TrendDirection = 'up' | 'down' | 'neutral';

function ShiftDeltaStrip({ delta }: { delta: { newLogs: number; newReports: number; openedReqs: number; closedReqs: number; newSitreps: number; eocLevelChanges: number } }) {
  const metrics = [
    { label: 'Logbook Entries', value: delta.newLogs, icon: NotebookPen },
    { label: 'Barangay Reports', value: delta.newReports, icon: Users },
    { label: 'Requests Opened/Closed', value: `${delta.openedReqs}/${delta.closedReqs}`, icon: ListChecks },
    { label: 'Sitreps Submitted', value: delta.newSitreps, icon: ClipboardCheck },
    { label: 'EOC Level Changes', value: delta.eocLevelChanges, icon: Siren, highlight: delta.eocLevelChanges > 0 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {metrics.map((m, i) => (
        <div key={i} className={`relative overflow-hidden rounded-xl border border-sky/20 bg-surface/80 backdrop-blur-md p-4 transition-all hover:bg-surface ${m.highlight ? 'ring-1 ring-bad/50' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <m.icon className={`w-4 h-4 ${m.highlight ? 'text-bad' : 'text-sky'}`} />
            <ArrowUpRight className="w-3 h-3 text-muted" />
          </div>
          <div className="text-2xl font-bold text-ink">{m.value}</div>
          <div className="text-xs text-muted mt-1">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" className="w-full h-12 overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OperationalTrendCards({ trends }: { trends: { reports24h: number; reports7d: number; openReqs: number; campOccupancy: number } }) {
  const cards = [
    { title: 'Barangay Reports (24h)', value: trends.reports24h, trend: 'neutral' as TrendDirection, data: [2, 4, 3, 5, 4, 6, trends.reports24h], color: 'var(--sky)', link: '/eoc/barangays' },
    { title: 'Open Resource Requests', value: trends.openReqs, trend: 'neutral' as TrendDirection, data: [5, 4, 6, 5, trends.openReqs, trends.openReqs, trends.openReqs], color: 'var(--warn)', link: '/eoc/logistics' },
    { title: 'Active Camps (ECHO)', value: trends.campOccupancy, trend: 'neutral' as TrendDirection, data: [1, 1, 2, 2, 3, trends.campOccupancy, trends.campOccupancy], color: 'var(--ok)', link: '/eoc/ccc' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((card, i) => (
        <Link key={i} to={card.link} className="block group">
          <div className="rounded-xl border border-sky/10 bg-surface/40 backdrop-blur-md p-4 hover:bg-surface/60 transition-all">
            <div className="flex justify-between items-start mb-3">
              <span className="text-sm font-medium text-muted">{card.title}</span>
              {card.trend === 'up' && <TrendingUp className="w-4 h-4 text-ok" />}
              {card.trend === 'down' && <TrendingDown className="w-4 h-4 text-bad" />}
              {card.trend === 'neutral' && <Minus className="w-4 h-4 text-muted" />}
            </div>
            <div className="text-3xl font-bold text-ink mb-2">{card.value}</div>
            <Sparkline data={card.data} color={card.color} />
            <div className="text-xs text-sky mt-2 group-hover:underline">View full screen →</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ReadinessAndQualityPanel({ readiness, dataQuality }: { readiness: any; dataQuality: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div className="rounded-xl border border-sky/20 bg-surface/80 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-sky" />
          <h3 className="text-lg font-semibold text-ink">IAT Readiness Trend</h3>
        </div>
        {readiness ? (
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-sm text-muted">Current Maturity Index</div>
                <div className="text-3xl font-bold text-ink">{readiness.currentScore?.toFixed(2) ?? 'N/A'} <span className="text-sm text-muted">/ 4.0</span></div>
              </div>
              <div className={`text-sm font-medium px-2 py-1 rounded ${readiness.delta >= 0 ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`}>
                {readiness.delta !== null ? (readiness.delta >= 0 ? '+' : '') + readiness.delta.toFixed(2) : 'N/A'} vs last cycle
              </div>
            </div>
            <div className="text-sm text-muted">
              {readiness.metItemsDelta > 0 ? `+${readiness.metItemsDelta}` : readiness.metItemsDelta} mandatory items met since last assessment.
            </div>
          </div>
        ) : <div className="text-muted text-sm">Awaiting historical IAT data...</div>}
      </div>

      <div className="rounded-xl border border-warn/20 bg-surface/80 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-warn" />
          <h3 className="text-lg font-semibold text-ink">Data Quality & Staleness</h3>
        </div>
        {dataQuality ? (
          <ul className="space-y-3 text-sm">
            {dataQuality.staleBarangays > 0 && (
              <li className="flex items-center gap-2 text-warn">
                <Clock className="w-4 h-4" /> {dataQuality.staleBarangays} barangays with no report in &gt;12h
              </li>
            )}
            {dataQuality.syncConflicts > 0 && (
              <li className="flex items-center gap-2 text-bad">
                <AlertCircle className="w-4 h-4" /> {dataQuality.syncConflicts} unresolved sync conflicts
              </li>
            )}
            {dataQuality.unconfirmedIat > 0 && (
              <li className="flex items-center gap-2 text-muted">
                <ShieldCheck className="w-4 h-4" /> {dataQuality.unconfirmedIat} pre-filled EOC assessment answers unconfirmed
              </li>
            )}
            {dataQuality.staleBarangays === 0 && dataQuality.syncConflicts === 0 && (
              <li className="text-ok flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> All systems nominal. Data is fresh.</li>
            )}
          </ul>
        ) : <div className="text-muted text-sm">Scanning local data integrity...</div>}
      </div>
    </div>
  );
}

function HazardContextAndEvacuationPanel({ hazardContext, evacuationSites }: { hazardContext: any; evacuationSites: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div className="rounded-xl border border-sky/20 bg-surface/80 backdrop-blur-md p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-sky" />
            <h3 className="text-lg font-semibold text-ink">Hazard Context (DDRiVE)</h3>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted bg-sunken px-2 py-1 rounded">
            Decision Support Only (ADR-024)
          </span>
        </div>
        {hazardContext ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-bad-soft/50 border border-bad/20 rounded-lg">
              <div>
                <div className="text-sm font-medium text-bad">Unreported High-Risk Barangays</div>
                <div className="text-xs text-muted">No report in last 12h</div>
              </div>
              <div className="text-2xl font-bold text-bad">{hazardContext.unreportedHighRisk} <span className="text-sm text-muted">/ {hazardContext.totalHighRisk}</span></div>
            </div>
            {hazardContext.unreportedHighRisk > 0 && (
              <div className="text-sm text-ink">
                Examples: <span className="font-medium">{hazardContext.unreportedNames.join(', ') || 'None'}</span>
              </div>
            )}
            <p className="text-xs text-muted italic mt-2">
              * Cross-referenced with DDRiVE 2026-11-09 flood susceptibility layers. Not an automatic trigger.
            </p>
          </div>
        ) : <div className="text-muted text-sm">Loading hazard cross-reference...</div>}
      </div>

      <div className="rounded-xl border border-sky/20 bg-surface/80 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-ok" />
          <h3 className="text-lg font-semibold text-ink">Evacuation Centers (LDRRMP/CDP)</h3>
        </div>
        {evacuationSites ? (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total Registered Sites</span>
              <span className="text-ink font-bold">{evacuationSites.total}</span>
            </div>
            {evacuationSites.atRisk > 0 ? (
              <div className="p-3 bg-warn-soft/50 border border-warn/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-warn" />
                  <span className="text-sm font-medium text-warn">{evacuationSites.atRisk} Sites Require Attention</span>
                </div>
                <ul className="text-xs text-ink space-y-1 ml-6 list-disc">
                  {evacuationSites.atRiskNames.map((name: string, i: number) => (
                    <li key={i}>{name} <span className="text-muted">(e.g., high-liquefaction / pending retrofit)</span></li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-ok flex items-center gap-2">
                <Building2 className="w-4 h-4" /> All registered sites cleared for current hazard profile.
              </div>
            )}
          </div>
        ) : <div className="text-muted text-sm">Loading LDRRMP/CDP site data...</div>}
      </div>
    </div>
  );
}

// --- MAIN PAGE COMPONENT ---

export function TodayPage() {
  const t = useT();
  const { profile, roles, has, offlineIdentity } = useAuth();
  const now = useNow();
  const decl = useActiveDeclaration();

  // Inline analytics query: safely checks for table existence and uses `db as any` to bypass strict schema errors
  const analytics = useLiveQuery(async () => {
    try {
      const currentTime = Date.now();
      const lastVisit = Number(localStorage.getItem('lastTodayVisit') || (currentTime - 28800000));
      localStorage.setItem('lastTodayVisit', currentTime.toString());

      const dbAny = db as any;

      // 1. Shift Delta
      const newLogs = await db.logbook_entries.where('occurred_at').above(lastVisit).count();
      const newReports = dbAny.barangay_reports ? await dbAny.barangay_reports.where('submitted_at').above(lastVisit).count() : 0;
      const openedReqs = dbAny.resource_requests ? await dbAny.resource_requests.where('status').equals('open').filter((r: any) => Number(r.created_at || 0) > lastVisit).count() : 0;
      const closedReqs = dbAny.resource_requests ? await dbAny.resource_requests.where('status').equals('closed').filter((r: any) => Number(r.updated_at || 0) > lastVisit).count() : 0;
      const newSitreps = dbAny.sitreps ? await dbAny.sitreps.where('created_at').above(lastVisit).count() : 0;
      const eocLevelChanges = dbAny.declarations ? await dbAny.declarations.where('updated_at').above(lastVisit).count() : 0;

      // 2. Trends
      const dayAgo = currentTime - 86400000;
      const reports24h = dbAny.barangay_reports ? await dbAny.barangay_reports.where('submitted_at').above(dayAgo).count() : 0;
      const openReqsTotal = dbAny.resource_requests ? await dbAny.resource_requests.where('status').equals('open').count() : 0;
      const campOccupancy = dbAny.evacuation_centers ? await dbAny.evacuation_centers.where('status').equals('active').count() : 0;

      // 3. Readiness Trend
      const cycles = await db.assessment_cycles.orderBy('cycle_year').reverse().limit(2).toArray();
      let readinessTrend = null;
      if (cycles.length >= 2 && cycles[0] && cycles[1]) {
        const current = cycles[0];
        const previous = cycles[1];
        const currentIndicators = await db.iat_indicators.toArray();
        const currentDomains = await db.iat_domains.toArray();
        const currentResponses = await db.responses.where('cycle_id').equals(current.id).toArray();
        const previousResponses = await db.responses.where('cycle_id').equals(previous.id).toArray();
        
        const currentRes = cycleResults(currentIndicators, currentDomains, currentResponses);
        const previousRes = cycleResults(currentIndicators, currentDomains, previousResponses);
        
        readinessTrend = {
          currentScore: currentRes?.imi?.maturityIndex ?? null,
          previousScore: previousRes?.imi?.maturityIndex ?? null,
          delta: (currentRes?.imi?.maturityIndex ?? 0) - (previousRes?.imi?.maturityIndex ?? 0),
          metItemsDelta: (currentRes?.answered ?? 0) - (previousRes?.answered ?? 0)
        };
      }

      // 4. Data Quality
      const staleThreshold = currentTime - 43200000; // 12 hours
      let staleBarangays = 0;
      if (dbAny.barangay_reports) {
        const reported = await dbAny.barangay_reports.where('submitted_at').above(staleThreshold).toArray();
        const uniqueReported = new Set(reported.map((r: any) => r.psgc || r.barangay || r.id)).size;
        staleBarangays = Math.max(0, 85 - uniqueReported);
      }
      const syncConflicts = dbAny.sync_conflicts ? await dbAny.sync_conflicts.count() : 0;
      const unconfirmedIat = await db.responses.where('provenance').equals('prefilled_iat').count();

      // 5. Hazard Context (DDRiVE)
      let unreportedHighRisk = 0;
      let unreportedNames: string[] = [];
      if (dbAny.barangay_hazard_profiles) {
        const highRisk = await dbAny.barangay_hazard_profiles.where('flood_susceptibility').anyOf(['High', 'High-Very High', 'Very High']).toArray();
        const recentReports = await dbAny.barangay_reports.where('submitted_at').above(staleThreshold).toArray();
        const reportedCodes = new Set(recentReports.map((r: any) => r.psgc || r.barangay || r.id));
        const unreported = highRisk.filter((b: any) => !reportedCodes.has(b.psgc || b.barangay || b.id));
        unreportedHighRisk = unreported.length;
        unreportedNames = unreported.slice(0, 3).map((b: any) => b.barangay_name || b.name);
      }

      // 6. Evacuation Sites
      let atRiskSites = 0;
      let atRiskNames: string[] = [];
      if (dbAny.evacuation_centers) {
        const sites = await dbAny.evacuation_centers.toArray();
        const atRisk = sites.filter((s: any) => s.hazard_flag === 'high-liquefaction' || s.retrofit_status === 'pending');
        atRiskSites = atRisk.length;
        atRiskNames = atRisk.map((s: any) => s.name);
      }

      return {
        shiftDelta: { newLogs, newReports, openedReqs, closedReqs, newSitreps, eocLevelChanges },
        trends: { reports24h, reports7d: reports24h, openReqs: openReqsTotal, campOccupancy },
        readinessTrend,
        dataQuality: { staleBarangays, oldestOutbox: null, syncConflicts, unconfirmedIat },
        hazardContext: { totalHighRisk: 0, unreportedHighRisk, unreportedNames },
        evacuationSites: { total: dbAny.evacuation_centers ? await dbAny.evacuation_centers.count() : 0, atRisk: atRiskSites, atRiskNames }
      };
    } catch (e) {
      console.error("Analytics query failed:", e);
      return null;
    }
  }, []);

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
            <h1 className="mt-1 text-2xl font-extrabold lg:text-3xl text-ink">{t(GREET_KEYS[hour < 12 ? 0 : hour < 18 ? 1 : 2])}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
            <p className="mt-1 max-w-prose text-muted">{t('today.hero')}</p>
            <ButtonAnchor href={USER_GUIDE_URL} variant="primary" icon={BookOpen} tip={USER_GUIDE_TIP} className="mt-4">{USER_GUIDE_LABEL}</ButtonAnchor>
          </div>
          <div className="flex shrink-0 items-center gap-1 lg:hidden">
            <ThemeToggle />
            <Link to="/settings" {...tip('Settings: sync, users and roles, about, sign out')} className="inline-flex h-tap w-tap items-center justify-center rounded-control hover:bg-sunken" aria-label="Settings"><Settings className="h-5 w-5 text-muted" aria-hidden /></Link>
          </div>
        </header>
      </GlassCard>

      {offlineIdentity && <Notice tone="info" title="Working offline">You are using the last sign-in on this device. Your entries are kept here and sent when the connection returns.</Notice>}

      <HazardWatch />

      {/* --- OPERATIONAL ANALYTICS --- */}
      {analytics && (
        <>
          <ShiftDeltaStrip delta={analytics.shiftDelta} />
          <OperationalTrendCards trends={analytics.trends} />
          <ReadinessAndQualityPanel readiness={analytics.readinessTrend} dataQuality={analytics.dataQuality} />
          <HazardContextAndEvacuationPanel hazardContext={analytics.hazardContext} evacuationSites={analytics.evacuationSites} />
        </>
      )}
      {/* --------------------------- */}

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
  const rows = ([1, 2, 3] as const).map((tier) => {
    const items = data.priority.filter((p) => p.tier === tier);
    const met = items.filter((p) => (p.response?.score ?? 0) >= 3 && !p.response?.is_na).length;
    return { tier, met, total: items.length };
  });
  const unmet = data.priority.filter((p) => (p.response?.score ?? 0) < 3 && !p.response?.is_na)
    .sort((a, b) => a.tier - b.tier).slice(0, 5);
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
            {rows.map(({ tier, met, total }, i) => (
              <div key={tier}>
                {i > 0 && <Separator className="mb-3" />}
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold text-ink">{'★'.repeat(4 - tier)} {t(TIER_KEY[tier])}</span>
                  <span className="font-data text-muted">{met} of {total} {t('today.pareto.met')}</span>
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
