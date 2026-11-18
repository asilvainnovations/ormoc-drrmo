// Anticipatory action (1.25.0): each live declaration is a card with a six-step track and one countdown, so anyone can see
// where it stands and what is due next. The rules and deadlines are unchanged (RA 12287 and its IRR); this only shows them.
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Plus, Wallet } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { useNow } from '@/lib/hooks';
import { nextDeadline } from '@/domain/aa';
import { AA_STAGES, declarationStage } from '@/domain/aaStages';
import { duration, fmtDateTime } from '@/lib/time';
import { Badge, ButtonLink, EmptyState, PageHeader, Tabs } from '@/components/ui';
import { Block, Tile } from '../kit';
import { EOC_TABS } from '../labels';
import { DECISION, DECL_STATUS, IMPACT } from './labels';

function StageTrack({ stage }: { stage: number }) {
  return (
    <ol className="flex items-start" aria-label="Progress">
      {AA_STAGES.map((name, i) => {
        const done = i < stage; const current = i === stage;
        return (
          <li key={name} className="flex min-w-0 flex-1 flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={clsx('h-0.5 flex-1', i === 0 ? 'bg-transparent' : i <= stage ? 'bg-ok' : 'bg-line')} />
              <span className={clsx('grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-extrabold',
                done ? 'border-ok bg-ok text-on-level' : current ? 'border-accent bg-surface text-ink ring-4 ring-accent/20' : 'border-line bg-surface text-muted')}>
                {done ? <Check size={14} /> : i + 1}
              </span>
              <span className={clsx('h-0.5 flex-1', i === AA_STAGES.length - 1 ? 'bg-transparent' : i < stage ? 'bg-ok' : 'bg-line')} />
            </div>
            <span className={clsx('mt-1 px-0.5 text-[11px] font-bold leading-tight', current ? 'text-ink' : 'text-muted')}>{name}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function AaHomePage() {
  const { has } = useAuth();
  const now = useNow();
  const data = useLiveQuery(async () => ({
    decls: await db.declarations.orderBy('expected_impact_at').reverse().toArray(),
    pdras: await db.pdra_sessions.orderBy('conducted_at').reverse().limit(20).toArray(),
    hazards: new Map((await db.hazards.toArray()).map((h) => [h.code, h.name])),
  }), []);
  const live = data?.decls.filter((d) => ['draft', 'requested', 'recommended', 'declared'].includes(d.status) || (d.status === 'lifted' && !d.report_submitted_at)) ?? [];
  const past = data?.decls.filter((d) => !live.includes(d)) ?? [];
  const soonest = live.map((d) => nextDeadline(d, now)).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => a.due.localeCompare(b.due))[0];
  const hz = (code: string) => data?.hazards.get(code) ?? code;

  return (
    <div className="page">
      <PageHeader title="Anticipatory Action" subtitle="Act before the hazard arrives: assess the forecast (PDRA), request a State of Imminent Disaster when the law allows, then run the actions."
        actions={<>
          {has('cdrrmo_head', 'eoc_manager', 'eoc_staff') && <ButtonLink tip="Record a pre-disaster risk assessment for a forecast hazard" to="/eoc/aa/pdra/new" variant="primary" icon={Plus}>Start a PDRA</ButtonLink>}
          <ButtonLink tip="See the anticipatory action fund for the year: the 10% cap and the 30%/70% tranches" to="/eoc/aa/funds" icon={Wallet}>AA funds</ButtonLink>
        </>} />
      <Tabs items={EOC_TABS} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label="Declarations in progress" value={live.length} tone={live.some((d) => nextDeadline(d, now)?.overdue) ? 'bad' : undefined} />
        <Tile label="Next deadline" value={soonest ? (soonest.overdue ? 'Overdue' : duration(soonest.hoursLeft)) : '–'} tone={soonest?.overdue ? 'bad' : undefined} hint={soonest ? soonest.label : 'Nothing due'} />
        <Tile label="PDRAs recorded" value={data?.pdras.length ?? 0} hint="most recent 20" />
      </div>

      {live.length === 0 ? (
        <EmptyState title="No declaration in progress" body="A declaration starts from a PDRA that finds severe impacts with a lead time of at least three (3) days (RA 12287 Sec. 6(b)). Below that, the City acts early under its own authority." />
      ) : (
        <div className="space-y-4">
          {live.map((d) => {
            const dl = nextDeadline(d, now); const stage = declarationStage(d) ?? 0;
            return (
              <Link key={d.id} to={`/eoc/aa/d/${d.id}`} className={clsx('block rounded-sheet border bg-surface p-4 shadow-raised hover:border-sky', dl?.overdue ? 'border-bad' : 'border-line')}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xl font-extrabold">{hz(d.hazard_code)}</p><p className="text-sm text-muted">Expected impact {fmtDateTime(d.expected_impact_at)}{d.eo_number ? ` · EO ${d.eo_number}` : ''}</p></div>
                  <div className="text-right">
                    <Badge tone={d.status === 'declared' ? 'bad' : 'info'}>{DECL_STATUS[d.status]}</Badge>
                    {dl && <p className={clsx('mt-1 text-sm font-bold', dl.overdue ? 'text-bad' : 'text-ink')}>{dl.label}: {dl.overdue ? `overdue by ${duration(dl.hoursLeft)}` : `in ${duration(dl.hoursLeft)}`}</p>}
                  </div>
                </div>
                <StageTrack stage={stage} />
              </Link>
            );
          })}
        </div>
      )}

      <Block title="Pre-disaster risk assessments" className="mt-5">
        {data?.pdras.length === 0 ? <p className="text-muted">None recorded. Start a PDRA when a hazard is forecast.</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data?.pdras.map((p) => (
              <li key={p.id}>
                <Link to={`/eoc/aa/pdra/${p.id}`} className="block rounded-control border border-line p-3 hover:border-sky">
                  <div className="flex items-start justify-between gap-2"><p className="font-bold">{hz(p.hazard_code)}</p><Badge tone={p.impact_class === 'severe' ? 'bad' : p.impact_class === 'moderate' ? 'warn' : 'neutral'}>{IMPACT[p.impact_class]}</Badge></div>
                  <p className="text-sm text-muted">{p.forecast_source}</p>
                  <p className="mt-1 text-xs text-muted">{fmtDateTime(p.conducted_at)} · impact expected {fmtDateTime(p.expected_impact_at)}</p>
                  <p className="mt-1 text-sm font-semibold">{DECISION[p.decision].label}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>

      {past.length > 0 && (
        <details className="mt-5"><summary className="cursor-pointer text-sm font-bold text-muted">Closed declarations ({past.length})</summary>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">{past.map((d) => (
            <li key={d.id}><Link to={`/eoc/aa/d/${d.id}`} className="flex items-center justify-between gap-2 rounded-control border border-line p-3 hover:border-sky"><span className="font-bold">{hz(d.hazard_code)}<span className="block text-xs font-normal text-muted">{d.eo_number ?? ''}</span></span><Badge>{DECL_STATUS[d.status]}</Badge></Link></li>))}
          </ul>
        </details>
      )}
      <p className="mt-6 text-xs text-muted">NDRRMC guidelines on hazard triggers and thresholds, and DBM–COA guidelines on AA funds, are still to be issued. The rules here follow the IRR signed 14 September 2026; an administrator updates them when those guidelines arrive.</p>
    </div>
  );
}
