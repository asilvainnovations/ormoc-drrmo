import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardCheck, ListChecks, NotebookPen, Settings, Siren, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { useActiveDeclaration, useNow } from '@/lib/hooks';
import { cycleResults } from '@/domain/scoring';
import { nextDeadline } from '@/domain/aa';
import { canOperate } from '@/domain/eoc';
import { duration, fmtDateTime, fmtLongDate, fmtTime, manilaHour, relative } from '@/lib/time';
import { env } from '@/lib/env';
import { Badge, List, ListRow, Meter, Notice, Section, TextLink } from '@/components/ui';
import { DECL_STATUS } from '@/features/eoc/aa/labels';
import { CYCLE_STATUS } from '@/features/iat/labels';

const greeting = (h: number) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

export function TodayPage() {
  const { profile, roles, has } = useAuth();
  const now = useNow();
  const decl = useActiveDeclaration();
  const data = useLiveQuery(async () => {
    const cycle = (await db.assessment_cycles.orderBy('cycle_year').reverse().toArray()).find((c) => c.status !== 'archived');
    const res = cycle ? cycleResults(await db.iat_indicators.toArray(), await db.iat_domains.toArray(), await db.responses.where('cycle_id').equals(cycle.id).toArray()) : null;
    return {
      cycle, res,
      runs: await db.protocol_runs.where('status').equals('running').toArray(),
      log: await db.logbook_entries.orderBy('occurred_at').reverse().limit(5).toArray(),
      hazard: decl ? await db.hazards.get(decl.hazard_code) : undefined,
      overdueReport: (await db.declarations.where('status').equals('lifted').toArray()).find((d) => !d.report_submitted_at),
    };
  }, [decl?.id]);
  const hour = manilaHour(now);
  const dl = decl ? nextDeadline(decl, now) : null;
  const quick = [
    canOperate(roles) && { to: '/eoc/log', label: 'Log an entry', icon: NotebookPen },
    canOperate(roles) && { to: '/protocols', label: 'Run a protocol', icon: ListChecks },
    canOperate(roles) && { to: '/eoc/barangays', label: 'Barangay status', icon: Users },
    has('cdrrmo_head', 'eoc_manager', 'eoc_staff') && { to: '/eoc/aa/pdra/new', label: 'New PDRA', icon: Siren },
    has('assessor', 'validator', 'lead_office_focal') && { to: data?.cycle ? `/assess/${data.cycle.id}` : '/assess', label: 'Continue assessment', icon: ClipboardCheck },
  ].filter(Boolean) as { to: string; label: string; icon: typeof NotebookPen }[];

  return (
    <div className="page">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">{greeting(hour)}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
          <p className="mt-1 text-muted">{fmtLongDate(now)}</p>
        </div>
        <Link to="/settings" className="inline-flex h-tap w-tap items-center justify-center rounded-control hover:bg-sunken lg:hidden" aria-label="Settings"><Settings className="h-5 w-5" aria-hidden /></Link>
      </header>

      {!env.demo && roles.length === 0 && (
        <Notice tone="warn" title="Your account has no roles yet">You are signed in, but the system administrator has not assigned you a role, so there is nothing to show. Ask them to assign one in Settings → Users and roles.</Notice>
      )}
      {env.demo && <Notice tone="info" title="Demo mode">Nothing is sent to a server. Data stays in this browser. Change your demo roles in Settings to see what each role can do.</Notice>}

      {decl && (
        <Link to={`/eoc/aa/d/${decl.id}`} className="mb-6 block rounded-sheet border-2 border-bad bg-bad-soft p-4 hover:opacity-95">
          <p className="font-bold text-bad">{DECL_STATUS[decl.status]}: {data?.hazard?.name ?? decl.hazard_code}</p>
          {dl && <p className="mt-1 text-lg font-bold text-ink">{dl.label} {dl.overdue ? 'was' : 'is'} {fmtDateTime(dl.due)}{!dl.overdue && `, ${duration(dl.hoursLeft)} from now`}</p>}
          <p className="mt-1 text-sm text-ink">Open the declaration for the next step, the anticipatory action checklist and funds.</p>
        </Link>
      )}
      {data?.overdueReport && !decl && (
        <Notice tone={new Date(data.overdueReport.report_due_at ?? 0) < now ? 'bad' : 'warn'} title="Report to OCD outstanding"
          action={<TextLink to={`/eoc/aa/d/${data.overdueReport.id}`}>Open the declaration</TextLink>}>
          Due {fmtDateTime(data.overdueReport.report_due_at)}.
        </Notice>
      )}

      {quick.length > 0 && (
        <nav aria-label="Quick actions" className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {quick.map(({ to, label, icon: Icon }) => (
            <Link key={label} to={to} className="flex min-h-[4.5rem] flex-col justify-between rounded-control border border-line bg-surface p-3 font-semibold hover:bg-sunken">
              <Icon className="h-5 w-5" aria-hidden />{label}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <Section title="Protocols running">
          {data?.runs.length ? <List>{data.runs.map((r) => <ListRow key={r.id} to={`/protocols/run/${r.id}`} title={r.title} meta={`Started ${relative(r.started_at, now.getTime())}`} />)}</List>
            : <p className="text-muted">None running.</p>}
        </Section>
        <Section title="Latest logbook entries" action={<TextLink size="sm" to="/eoc/log">Logbook</TextLink>}>
          {data?.log.length ? <List>{data.log.map((l) => <ListRow key={l.id} title={l.entry} meta={fmtTime(l.occurred_at)} />)}</List> : <p className="text-muted">No entries yet.</p>}
        </Section>
        <Section title="Institutional assessment" action={<TextLink size="sm" to="/assess">All cycles</TextLink>}>
          {data?.cycle && data.res ? (
            <Link to={`/assess/${data.cycle.id}`} className="block rounded-control hover:bg-sunken">
              <p className="font-semibold">{data.cycle.name} <Badge className="ml-1">{CYCLE_STATUS[data.cycle.status]}</Badge></p>
              <p className="mb-2 text-sm text-muted">{data.res.answered} of {data.res.total} answered{data.res.imi.maturityIndex !== null && `. Maturity ${data.res.imi.maturityIndex.toFixed(2)}, ${data.res.imi.band}`}</p>
              <Meter value={data.res.answered} max={data.res.total} label="Indicators answered" />
            </Link>
          ) : <p className="text-muted">No assessment cycle yet.</p>}
        </Section>
      </div>
    </div>
  );
}
