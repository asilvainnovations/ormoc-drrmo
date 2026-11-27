// CDRRMO coordination (1.34.0, B = MAP): assign, monitor, follow up, verify, close. Progress is counted in behaviours
// with evidence (assigned, acknowledged, recommended, evidenced, verified, closed), never in logins or page views.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { tip } from '@/components/Tooltip';
import { Button, Input, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  FOLLOW_UP_LABEL, GAP_ACTION, PROMPT_LABEL, STAGE_LABEL, coordinationSummary, decisionFollowUp, decisionStage, isCoordinator,
  itemFollowUp, itemStage, manilaToday, officesIn, type FollowUp, type PromptElement,
} from '@/domain/bmap';
import type { GovernancePriority } from '@/types';
import { BarRow, Metric, Panel, Pill, WorkspaceHead } from './kit';
import { PRIORITY } from './labels';
import { FOLLOW_TONE } from './ActionPanel';
import { assignTasks, useViewer } from './actions';

const ATTENTION: FollowUp[] = ['escalated', 'overdue', 'blocked', 'due_soon', 'no_date'];

export function CoordinationPage() {
  const data = useLiveQuery(async () => ({ items: await db.manual_review_items.toArray(), decisions: await db.outstanding_decisions.toArray() }), []);
  const viewer = useViewer();
  const toast = useToast();
  const [due, setDue] = useState('');
  const [prio, setPrio] = useState<GovernancePriority | 'all'>('critical_urgent');
  const [busy, setBusy] = useState(false);
  const today = manilaToday();

  const view = useMemo(() => {
    if (!data) return null;
    const { items, decisions } = data;
    const sum = coordinationSummary(items, decisions, today);
    const rows = [
      ...items.map((i) => ({ id: i.source_tracker_id, title: i.title, lead: i.lead_office, f: itemFollowUp(i, today), stage: itemStage(i), to: `/governance/reviews?item=${i.source_tracker_id}`, codes: i.lead_office_codes ?? officesIn(i.lead_office) })),
      ...decisions.map((d) => ({ id: d.source_decision_id, title: d.question, lead: d.accountable_owner_office, f: decisionFollowUp(d, today), stage: decisionStage(d), to: '/governance/decisions', codes: d.owner_office_codes ?? officesIn(d.accountable_owner_office) })),
    ];
    const attention = rows.filter((r) => ATTENTION.slice(0, 3).includes(r.f.state)).sort((a, b) => ATTENTION.indexOf(a.f.state) - ATTENTION.indexOf(b.f.state) || (b.f.days ?? 0) - (a.f.days ?? 0));
    const byOffice = new Map<string, { open: number; late: number }>();
    for (const r of rows) if (r.f.state !== 'done') for (const c of r.codes) {
      const o = byOffice.get(c) ?? { open: 0, late: 0 };
      o.open += 1; if (r.f.state === 'overdue' || r.f.state === 'escalated') o.late += 1;
      byOffice.set(c, o);
    }
    const unassigned = (p: GovernancePriority | 'all') => ({
      items: items.filter((i) => !i.due_date && itemStage(i) !== 'closed' && itemStage(i) !== 'deferred' && (p === 'all' || i.priority === p)).map((i) => i.id),
      decisions: decisions.filter((d) => !d.target_date && decisionStage(d) !== 'closed' && decisionStage(d) !== 'deferred' && (p === 'all' || d.priority === p)).map((d) => d.id),
    });
    return { sum, attention, byOffice: [...byOffice].sort((a, b) => b[1].open - a[1].open), unassigned };
  }, [data, today]);

  if (!view) return <Loading />;
  const { sum, attention, byOffice, unassigned } = view;
  const pool = unassigned(prio);
  const coord = isCoordinator(viewer);
  const assign = async () => {
    setBusy(true);
    try { const n = await assignTasks(pool.items, pool.decisions, due); toast(`${n} task${n === 1 ? '' : 's'} assigned, due ${due}`); }
    catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  const maxFunnel = Math.max(1, sum.total);

  return (
    <div>
      <WorkspaceHead eyebrow="CDRRMO coordination" title="Follow-Through" subtitle="Assign, follow up, verify and close. Progress counts what offices did, with evidence and authority, not who logged in."
        aside={<Pill tone={sum.follow.escalated ? 'red' : 'blue'}>{sum.total} tasks</Pill>} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(['escalated', 'overdue', 'due_soon', 'blocked', 'no_date'] as FollowUp[]).map((k) => (
          <Link key={k} to={`/governance/reviews?follow=${k}`} {...tip(`Open the register items that are ${FOLLOW_UP_LABEL[k].toLowerCase()}`)}>
            <Metric label={FOLLOW_UP_LABEL[k]} value={sum.follow[k]} tone={sum.follow[k] && (k === 'escalated' || k === 'blocked') ? 'bad' : sum.follow[k] && k !== 'no_date' ? 'warn' : undefined}
              hint={k === 'escalated' ? 'More than 3 days overdue' : k === 'due_soon' ? 'Within 2 days' : k === 'no_date' ? 'Set a response date' : k === 'blocked' ? 'No lead, or awaiting authority' : 'Past the response date'} />
          </Link>
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <Panel title="Behaviour funnel" note="How many of the register items and decisions have reached each step. A step counts only when MODE holds its record.">
          {sum.funnel.map(({ stage, n }) => <BarRow key={stage} label={STAGE_LABEL[stage]} value={n} max={maxFunnel} tone={stage === 'closed' ? 'green' : 'grey'} labelWidth="9rem" />)}
        </Panel>
        <Panel title="Prompts not yet complete" note="Elements missing from open prompts. Each is a coordination task for the CDRRMO, not a gap for the office to guess.">
          {(Object.keys(sum.gaps) as PromptElement[]).filter((k) => sum.gaps[k] > 0).map((k) => (
            <BarRow key={k} label={PROMPT_LABEL[k]} value={sum.gaps[k]} max={maxFunnel} tone="orange" labelWidth="9rem" />
          ))}
          {Object.values(sum.gaps).every((n) => n === 0) && <p className="text-sm text-muted">Every open prompt names who, why, what, how, when, the response and the next step.</p>}
          {sum.gaps.when > 0 && <p className="mt-3 text-xs text-muted">{GAP_ACTION.when} Use the assignment panel below.</p>}
        </Panel>
      </div>

      {coord && (
        <Panel title="Assign a batch" note="Gives every open item and decision of the chosen priority that has no response date the same date. Agree the date with the workshop plan first." className="mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div role="radiogroup" aria-label="Priority" className="flex flex-wrap gap-2">
              {(['critical_urgent', 'important', 'standard', 'all'] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={prio === p} onClick={() => setPrio(p)} {...tip(p === 'all' ? 'Every priority' : PRIORITY[p].tip)}
                  className={clsx('min-h-tap rounded-full border px-3 text-sm font-semibold', prio === p ? 'border-action bg-sky-soft text-ink ring-1 ring-action' : 'border-line bg-surface text-muted')}>
                  {p === 'all' ? 'All' : PRIORITY[p].label} · {unassigned(p).items.length + unassigned(p).decisions.length}
                </button>
              ))}
            </div>
            <label className="text-sm font-semibold" {...tip('The date the lead offices answer by')}>Response date
              <Input type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 w-44" /></label>
            <Button tip="Assign these tasks with this date" busy={busy} disabled={!due || pool.items.length + pool.decisions.length === 0} onClick={() => void assign()}>
              Assign {pool.items.length + pool.decisions.length}
            </Button>
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Panel title="Needs follow-up now" note="Escalated first, then overdue and blocked.">
          {attention.length === 0 ? <p className="text-sm text-muted">Nothing is overdue or blocked.</p> : (
            <ul className="divide-y divide-line">
              {attention.slice(0, 15).map((r) => (
                <li key={r.id}>
                  <Link to={r.to} className="flex min-h-tap items-start gap-3 py-2 hover:bg-sky-soft/40" {...tip(`Open ${r.id}`)}>
                    <span className="w-16 shrink-0 font-data text-xs text-muted">{r.id}</span>
                    <span className="min-w-0 flex-1 text-sm"><b className="block truncate text-ink">{r.title}</b><span className="text-muted">{r.lead ?? 'No lead'} · {r.f.reason}</span></span>
                    <Pill tone={FOLLOW_TONE[r.f.state]}>{FOLLOW_UP_LABEL[r.f.state]}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Open tasks by office" note="Orange: overdue or escalated.">
          {byOffice.slice(0, 14).map(([code, o]) => (
            <div key={code} className="grid items-center gap-2 py-1 text-xs font-bold" style={{ gridTemplateColumns: '6rem 1fr 3rem' }}>
              <span className="truncate text-ink">{code}</span>
              <span className="flex h-3 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${code}: ${o.open} open, ${o.late} late`}>
                <span className="bg-warn" style={{ width: `${(100 * o.late) / (byOffice[0]?.[1].open ?? 1)}%` }} />
                <span className="bg-sky" style={{ width: `${(100 * (o.open - o.late)) / (byOffice[0]?.[1].open ?? 1)}%` }} />
              </span>
              <span className="text-right font-data">{o.open}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
