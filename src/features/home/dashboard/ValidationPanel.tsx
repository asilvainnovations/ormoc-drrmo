// Validation on the Today page (1.26.0): one card with the progress ring and four figures. The IAT is not here; it lives in
// Assess. Reads Dexie only, figures from src/domain/dashboard.ts. Loaded lazily by TodayPage.
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Scale } from 'lucide-react';
import { TextLink } from '@/components/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { tip } from '@/components/Tooltip';
import { db } from '@/lib/db';
import { fmtLongDate } from '@/lib/time';
import { latestStamp, trackerSnapshot } from '@/domain/dashboard';
import { fmtDateTime } from '@/lib/time';
import { Ring } from '@/features/eoc/kit';

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'bad' | 'warn' }) {
  return (
    <div className="rounded-control bg-sunken/60 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-data text-2xl font-bold ${tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function ValidationPanel() {
  const d = useLiveQuery(async () => {
    const [items, decisions, sessions] = await Promise.all([db.manual_review_items.toArray(), db.outstanding_decisions.toArray(), db.workshop_sessions.toArray()]);
    return { ...trackerSnapshot(items, decisions, sessions), asOf: latestStamp([...items, ...decisions, ...sessions]) };
  }, []);
  const empty = d && d.items.total + d.decisions.total + d.sessions.total === 0;
  const pct = d && d.items.total ? Math.round((100 * d.items.closed) / d.items.total) : 0;
  return (
    <Card className="mb-6">
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-ink"><Scale className="h-5 w-5 text-sky" aria-hidden />Validation</CardTitle>
          <CardDescription>What the operations drafts still need before the workshop: reviews, decisions and sessions.</CardDescription>
        </div>
        <TextLink tip="Open the validation workspace" size="sm" to="/governance">Open</TextLink>
      </CardHeader>
      <CardContent>
        {!d ? <div className="space-y-2" aria-hidden><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-1/2" /></div> : empty ? (
          <p className="text-muted">The validation register arrives with the next reference-data sync.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-4">
              <Ring value={d.items.closed} max={d.items.total || 1} size={96}>{pct}%</Ring>
              <div><p className="font-data text-2xl font-bold">{d.items.closed} of {d.items.total}</p><p className="text-sm text-muted">review items closed</p></div>
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
              <Figure label="Open items" value={String(d.items.open)} hint={`${d.items.deferred} deferred`} />
              <Figure label="Critical, still open" value={String(d.items.criticalOpen)} tone={d.items.criticalOpen > 0 ? 'bad' : undefined} />
              <Figure label="Decisions waiting" value={`${d.decisions.forDecision} of ${d.decisions.total}`} hint={`${d.decisions.decided} decided`} tone={d.decisions.criticalForDecision > 0 ? 'warn' : undefined} />
              <Figure label="Authority to confirm" value={String(d.decisions.authorityToConfirm)} hint="Deciding office not yet confirmed" />
            </div>
            <p className="w-full text-sm text-muted">
              {d.items.awaitingDecision > 0 && `${d.items.awaitingDecision} items wait on a decision. `}
              {d.items.awaitingEvidence > 0 && `${d.items.awaitingEvidence} items wait on evidence. `}
              {d.sessions.next
                ? <>Next session: <Link to="/governance/workshop" {...tip('Open the workshop sessions')} className="font-semibold text-action underline-offset-4 hover:underline">{d.sessions.next.title}</Link>{d.sessions.next.scheduled_date ? `, ${fmtLongDate(new Date(d.sessions.next.scheduled_date))}` : ' (date to be set)'}.</>
                : `${d.sessions.completed} of ${d.sessions.total} sessions completed.`}
            </p>
          </div>
        )}
        {d && !empty && <p className="mt-3 text-xs text-muted">Source: Validation Tracker register (review items, decisions, sessions); scored separately from the institutional assessment · last change {d.asOf ? fmtDateTime(d.asOf) : 'not recorded'}</p>}
      </CardContent>
    </Card>
  );
}
