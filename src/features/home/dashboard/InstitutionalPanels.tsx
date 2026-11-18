// Institutional intelligence on the Today page (1.24.0). Two panels from two controlled sources, side by side
// and never combined: the IAT (what is in place) and the Validation Tracker (what the Manual still needs).
// Loaded lazily by TodayPage; reads Dexie only. All figures come from src/domain/dashboard.ts.
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardCheck, Scale } from 'lucide-react';
import { Badge, TextLink } from '@/components/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { tip } from '@/components/Tooltip';
import { db } from '@/lib/db';
import { fmtLongDate } from '@/lib/time';
import { indexDelta, iatSnapshot, trackerSnapshot } from '@/domain/dashboard';
import { CYCLE_STATUS } from '@/features/iat/labels';

const fmtIndex = (n: number | null) => (n === null ? 'Not scored' : n.toFixed(2));

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'bad' | 'warn' }) {
  return (
    <div className="rounded-control bg-sunken/60 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-data text-2xl font-bold ${tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Loading() {
  return <div className="space-y-2" aria-hidden><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-5 w-2/3" /></div>;
}

function IatPanel() {
  const d = useLiveQuery(async () => {
    const cycles = (await db.assessment_cycles.orderBy('cycle_year').reverse().toArray()).filter((c) => c.status !== 'archived');
    const cycle = cycles[0];
    if (!cycle) return { cycle: null as null };
    const [indicators, domains] = [await db.iat_indicators.toArray(), await db.iat_domains.toArray()];
    const now = iatSnapshot(indicators, domains, await db.responses.where('cycle_id').equals(cycle.id).toArray());
    const before = cycles[1] ? iatSnapshot(indicators, domains, await db.responses.where('cycle_id').equals(cycles[1].id).toArray()) : null;
    return { cycle, now, before, previousName: cycles[1]?.name ?? null };
  }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-ink"><ClipboardCheck className="h-5 w-5 text-sky" aria-hidden />Institutional assessment (IAT)</CardTitle>
          <CardDescription>What the CDRRMO and EOC have in place, scored 0 to 4 against evidence.</CardDescription>
        </div>
        {d?.cycle && <TextLink tip="Open this assessment cycle" size="sm" to={`/assess/${d.cycle.id}`}>Open</TextLink>}
      </CardHeader>
      <CardContent className="space-y-4">
        {!d ? <Loading /> : !d.cycle ? <p className="text-muted">No assessment cycle yet.</p> : (() => {
          const s = d.now;
          const delta = d.before ? indexDelta(s.imi, d.before.imi) : null;
          const metDelta = d.before ? s.mandatoryMet - d.before.mandatoryMet : null;
          return <>
            <p className="text-sm text-muted">{d.cycle.name} <Badge className="ml-1">{CYCLE_STATUS[d.cycle.status]}</Badge></p>
            <div className="grid grid-cols-2 gap-2">
              <Figure label="Maturity index (IMI)" value={fmtIndex(s.imi)} hint={s.band ? `${s.band}. ${s.scored} of ${s.indicators} indicators scored` : `${s.scored} of ${s.indicators} indicators scored`} />
              <Figure label="Mandatory items met" value={`${s.mandatoryMet} of ${s.mandatoryTotal}`} hint="Scored 3 or 4, out of all Mandatory items" />
              <Figure label="High-priority gaps" value={String(s.highGaps)} tone={s.highGaps > 0 ? 'bad' : undefined} hint="Parts A and B" />
              <Figure label="Interface index (Part C)" value={fmtIndex(s.interfaceIndex)} hint="Kept apart from the IMI" />
            </div>
            {d.before && d.previousName && (
              <p className="text-sm text-muted">
                Against {d.previousName}: {delta === null ? 'index not comparable (one cycle has no scores)' : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} on the index`}
                {metDelta !== null && `, ${metDelta >= 0 ? '+' : ''}${metDelta} Mandatory items met`}.
              </p>
            )}
            <ul className="space-y-2" aria-label="Domains">
              {s.domains.map((r) => (
                <li key={r.code}>
                  <Link to={`/assess/${d.cycle!.id}/d/${r.code}`} {...tip(`Open domain ${r.code}: ${r.name}`)} className="block rounded-control p-1 hover:bg-sky-soft/60">
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-semibold text-ink">{r.code} <span className="font-normal text-muted">{r.name}</span></span>
                      <span className="font-data text-muted">{r.index === null ? 'Not scored' : `${r.index.toFixed(2)} ${r.band ?? ''}`}</span>
                    </div>
                    <Progress value={r.index === null ? 0 : (100 * r.index) / 4} aria-label={`${r.code} maturity index`} />
                  </Link>
                </li>
              ))}
            </ul>
          </>;
        })()}
      </CardContent>
    </Card>
  );
}

function TrackerPanel() {
  const d = useLiveQuery(async () => trackerSnapshot(await db.manual_review_items.toArray(), await db.outstanding_decisions.toArray(), await db.workshop_sessions.toArray()), []);
  const empty = d && d.items.total + d.decisions.total + d.sessions.total === 0;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-ink"><Scale className="h-5 w-5 text-sky" aria-hidden />Manual validation</CardTitle>
          <CardDescription>What the Manual still needs before the workshop: reviews, decisions and sessions.</CardDescription>
        </div>
        <TextLink tip="Open the review register" size="sm" to="/governance/reviews">Open</TextLink>
      </CardHeader>
      <CardContent className="space-y-4">
        {!d ? <Loading /> : empty ? <p className="text-muted">The Validation Tracker arrives with the next reference-data sync.</p> : <>
          <div className="grid grid-cols-2 gap-2">
            <Figure label="Review items open" value={`${d.items.open} of ${d.items.total}`} hint={`${d.items.closed} closed, ${d.items.deferred} deferred`} />
            <Figure label="Critical, still open" value={String(d.items.criticalOpen)} tone={d.items.criticalOpen > 0 ? 'bad' : undefined} />
            <Figure label="Decisions waiting" value={`${d.decisions.forDecision} of ${d.decisions.total}`} hint={`${d.decisions.decided} decided`} tone={d.decisions.criticalForDecision > 0 ? 'warn' : undefined} />
            <Figure label="Authority to confirm" value={String(d.decisions.authorityToConfirm)} hint="Open decisions whose deciding office is not yet confirmed" />
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">Review items closed</span>
              <span className="font-data text-muted">{d.items.closed} of {d.items.total}</span>
            </div>
            <Progress value={d.items.total ? (100 * d.items.closed) / d.items.total : 0} aria-label="Review items closed" />
          </div>
          <p className="text-sm text-muted">
            {d.items.awaitingDecision > 0 && `${d.items.awaitingDecision} items wait on a decision. `}
            {d.items.awaitingEvidence > 0 && `${d.items.awaitingEvidence} items wait on evidence. `}
            {d.sessions.next
              ? <>Next session: <Link to="/governance/workshop" {...tip('Open the workshop sessions')} className="font-semibold text-action underline-offset-4 hover:underline">{d.sessions.next.title}</Link>{d.sessions.next.scheduled_date ? `, ${fmtLongDate(new Date(d.sessions.next.scheduled_date))}` : ' (date to be set)'}.</>
              : `${d.sessions.completed} of ${d.sessions.total} sessions completed.`}
          </p>
          <p className="text-xs text-muted">Review status is the consultant's working record. It does not change any IAT score, and these figures are never added to the IAT.</p>
        </>}
      </CardContent>
    </Card>
  );
}

export default function InstitutionalPanels() {
  return (
    <section aria-label="Institutional intelligence" className="mb-6 grid gap-4 lg:grid-cols-2">
      <IatPanel />
      <TrackerPanel />
    </section>
  );
}
