// Validation workshop (1.15.0; Methodology v1.1 section 6): the queue a validator works through, with progress by
// domain. Opening an indicator shows its evidence and the validate step. Works offline on synced data.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MonitorPlay, Printer } from 'lucide-react';
import { Badge, ButtonLink, EmptyState, Field, Input, List, ListRow, Loading, Meter, PageHeader, Section, Select } from '@/components/ui';
import { Separator } from '@/components/ui/separator';
import { tip } from '@/components/Tooltip';
import { agreement, queue, totals, validationProgress, type QueueFilter } from '@/domain/validation';
import type { EvidenceCheck } from '@/types';
import { useCycleData } from './data';
import { EVIDENCE_CHECK, EVIDENCE_CHECK_TONE, RESPONSE_STATUS, RESPONSE_TONE } from './labels';

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');

export function ValidationPage() {
  const { cycleId } = useParams();
  const data = useCycleData(cycleId);
  const [f, setF] = useState<QueueFilter>({ part: 'all', status: 'submitted', evidence: 'all', text: '' });
  const rows = useMemo(() => (data ? validationProgress(data.indicators, data.domains, data.responses) : []), [data]);
  const items = useMemo(() => (data ? queue(data.indicators, data.domains, data.responses, f) : []), [data, f]);
  if (data === undefined) return <Loading />;
  if (data === null) return <div className="page"><PageHeader title="Cycle not found" back="/assess" /></div>;
  const ab = totals(rows, ['A', 'B']);
  const c = totals(rows, ['C']);
  const agree = agreement(ab.confirmed + c.confirmed, ab.revised + c.revised);

  return (
    <div className="page">
      <PageHeader title="Validation Workshop" back={`/assess/${data.cycle.id}`}
        subtitle={`${data.cycle.name}. Validators check each score against its evidence, then confirm it or revise it with a reason. The person who set a score does not validate it.`}
        actions={<>
          <ButtonLink tip="Printable sheets for each domain, for validators to mark during the session" to={`/assess/${data.cycle.id}/validate/sheets`} icon={Printer}>Validation sheets</ButtonLink>
          <ButtonLink tip="A large-screen view of the results and validation progress, for the session room" to={`/assess/${data.cycle.id}/validate/board`} icon={MonitorPlay}>Results board</ButtonLink>
        </>} />

      <Section title="Progress">
        <div className="grid gap-4 sm:grid-cols-3">
          {[['Parts A and B', ab], ['Part C, interface', c]].map(([label, t]) => {
            const x = t as typeof ab;
            return (
              <div key={label as string} className="rounded-card border border-line bg-surface p-4">
                <p className="text-sm text-muted">{label as string}</p>
                <p className="font-data text-2xl font-bold">{x.validated} of {x.indicators} validated</p>
                <Meter value={x.validated} max={x.indicators} label={`${label as string}: validated`} tone="ok" />
                <p className="mt-2 text-sm text-muted">{x.submitted} waiting · {x.draft} not submitted · evidence verified {pct(x.evidenceVerified, x.indicators)}</p>
              </div>
            );
          })}
          <div className="rounded-card border border-line bg-surface p-4" {...tip('Share of validated scores the validator kept as submitted. Revisions are not errors: they are what validation is for')}>
            <p className="text-sm text-muted">Assessor and validator agreement</p>
            <p className="font-data text-2xl font-bold">{agree === null ? '—' : `${Math.round(agree * 100)}%`}</p>
            <p className="mt-2 text-sm text-muted">{ab.confirmed + c.confirmed} confirmed · {ab.revised + c.revised} revised</p>
          </div>
        </div>
        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">Validation progress by domain</caption>
          <thead><tr className="text-left text-muted"><th className="py-1 font-normal">Domain</th><th className="py-1 text-right font-normal">Validated</th>
            <th className="py-1 text-right font-normal">Waiting</th><th className="py-1 text-right font-normal">Revised</th><th className="py-1 text-right font-normal">Evidence pending</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.domain} className="border-t border-line">
              <td className="py-1.5"><span className="font-data font-semibold">{r.domain}</span> {r.name}</td>
              <td className="py-1.5 text-right tabular-nums">{r.validated}/{r.indicators}</td>
              <td className="py-1.5 text-right tabular-nums">{r.submitted}</td>
              <td className="py-1.5 text-right tabular-nums">{r.revised}</td>
              <td className="py-1.5 text-right tabular-nums">{r.evidencePending}</td>
            </tr>))}
          </tbody>
        </table>
      </Section>

      <Separator className="my-6" />
      <Section title="Queue">
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <Field label="Part" tip="Show one part of the assessment">{(id) => (
            <Select id={id} value={f.part} onChange={(e) => setF({ ...f, part: e.target.value as QueueFilter['part'] })}>
              <option value="all">All parts</option><option value="A">A, CDRRMO</option><option value="B">B, EOC</option><option value="C">C, Interface</option>
            </Select>)}</Field>
          <Field label="Status" tip="Waiting for validation is what validators work through">{(id) => (
            <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as QueueFilter['status'] })}>
              <option value="submitted">Waiting for validation</option><option value="validated">Validated</option><option value="draft">Not submitted</option><option value="all">All</option>
            </Select>)}</Field>
          <Field label="Evidence check" tip="Filter by whether the cited evidence was checked against the source record">{(id) => (
            <Select id={id} value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value as QueueFilter['evidence'] })}>
              <option value="all">Any</option>{(Object.keys(EVIDENCE_CHECK) as EvidenceCheck[]).map((k) => <option key={k} value={k}>{EVIDENCE_CHECK[k]}</option>)}
            </Select>)}</Field>
          <Field label="Find" tip="An indicator code or a word from its statement">{(id) => (
            <Input id={id} type="search" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="e.g. A4.5 or LDRRMF" />)}</Field>
        </div>
        {items.length === 0 ? <EmptyState title="Nothing in this view" body="Change the filters, or open a domain from the cycle overview." /> : (
          <List>
            {items.map(({ indicator: i, response: r }) => (
              <ListRow key={i.id} to={`/assess/${data.cycle.id}/i/${encodeURIComponent(i.id)}`} tip="Open the indicator: evidence, score and the validate step"
                title={<><span className="font-data font-semibold">{i.id}</span> {i.statement}</>}
                meta={r ? `Score ${r.is_na ? 'NA' : r.score ?? '—'}${r.validation_decision ? ` · ${r.validation_decision === 'revised' ? `revised from ${r.score_before_validation ?? 'NA'}` : 'confirmed'}` : ''}` : 'Not scored'}
                trailing={<span className="flex flex-wrap justify-end gap-1">
                  <Badge tone={EVIDENCE_CHECK_TONE[r?.evidence_check ?? 'pending']}>{EVIDENCE_CHECK[r?.evidence_check ?? 'pending']}</Badge>
                  <Badge tone={RESPONSE_TONE[r?.status ?? 'draft']}>{RESPONSE_STATUS[r?.status ?? 'draft']}</Badge>
                </span>} />
            ))}
          </List>
        )}
      </Section>
    </div>
  );
}
