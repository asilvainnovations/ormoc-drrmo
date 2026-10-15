import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { Check, CircleSlash, SkipForward, Undo2 } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { canOperate } from '@/domain/eoc';
import { completionProblem, dueState, stepProblem } from '@/domain/protocol';
import { fmtDateTime, fmtTime } from '@/lib/time';
import { useNow, useProfiles } from '@/lib/hooks';
import { Badge, Button, Field, Loading, Notice, PageHeader, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { ProtocolRunStep, StepStatus } from '@/types';

export function RunPage() {
  const { runId } = useParams();
  const { roles } = useAuth();
  const toast = useToast();
  const now = useNow(15_000);
  const people = useProfiles();
  const run = useLiveQuery(() => (runId ? db.protocol_runs.get(runId) : undefined), [runId]);
  const steps = useLiveQuery(() => (runId ? db.protocol_run_steps.where('run_id').equals(runId).sortBy('seq') : []), [runId], []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [abortOpen, setAbortOpen] = useState(false);
  const [abortWhy, setAbortWhy] = useState('');
  if (!run) return <Loading />;
  const active = run.status === 'running' && canOperate(roles);
  const done = steps.filter((s) => s.status !== 'pending').length;

  const setStep = async (s: ProtocolRunStep, status: StepStatus) => {
    const note = notes[s.id] ?? s.note ?? '';
    const problem = stepProblem(s, status, note);
    setErrors((e) => ({ ...e, [s.id]: problem }));
    if (problem) return;
    const stamp = status === 'pending' ? { done_at: null, done_by: null } : { done_at: new Date().toISOString() };
    await save('protocol_run_steps', { ...s, status, note: note.trim() || null, ...stamp }, `Step ${s.seq} of ${run.title}`);
  };

  const complete = async () => {
    const p = completionProblem(steps);
    if (p) { toast(p, 'bad'); return; }
    await save('protocol_runs', { ...run, status: 'completed', completed_at: new Date().toISOString() }, `Complete ${run.title}`);
    toast('Protocol completed');
  };
  const abort = async () => {
    await save('protocol_runs', { ...run, status: 'aborted', abort_reason: abortWhy.trim() }, `Stop ${run.title}`);
    setAbortOpen(false); toast('Protocol stopped', 'info');
  };

  return (
    <div className="page">
      <PageHeader title={run.title} back="/protocols"
        subtitle={`${run.context_type === 'drill' ? 'Drill. ' : ''}Started ${fmtDateTime(run.started_at)}. ${done} of ${steps.length} steps closed.`}
        actions={active && <>
          <Button variant="secondary" onClick={() => setAbortOpen(true)}>Stop</Button>
          <Button onClick={complete}>Complete</Button>
        </>} />
      {run.status === 'completed' && <Notice tone="ok" title="Completed">{`Completed ${fmtDateTime(run.completed_at)}.`}</Notice>}
      {run.status === 'aborted' && <Notice tone="bad" title="Stopped">{run.abort_reason}</Notice>}
      <ol className="space-y-3">
        {steps.map((s) => {
          const due = dueState(s, now);
          const closed = s.status !== 'pending';
          return (
            <li key={s.id} className={clsx('rounded-control border bg-surface p-4', closed ? 'border-line' : due === 'overdue' ? 'border-bad' : 'border-line')}>
              <div className="flex items-start gap-3">
                <span className={clsx('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  s.status === 'done' ? 'bg-ok text-on-strong' : closed ? 'bg-sunken text-muted' : 'bg-ink text-paper')} aria-hidden>
                  {s.status === 'done' ? <Check className="h-4 w-4" /> : s.seq}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={clsx('text-lg leading-7', closed && s.status !== 'done' && 'text-muted line-through')}>{s.instruction}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {s.is_critical && <Badge tone="bad">Critical</Badge>}
                    {s.requires_note && <Badge>Note needed</Badge>}
                    {s.due_at && !closed && <Badge tone={due === 'overdue' ? 'bad' : due === 'due_soon' ? 'warn' : 'neutral'}>{due === 'overdue' ? 'Overdue, was due' : 'Due'} {fmtTime(s.due_at)}</Badge>}
                    {closed && <Badge tone={s.status === 'done' ? 'ok' : 'neutral'}>{s.status === 'done' ? 'Done' : s.status === 'skipped' ? 'Skipped' : 'Not applicable'} {fmtTime(s.done_at)}{s.done_by && people.get(s.done_by) ? `, ${people.get(s.done_by)!.full_name}` : ''}</Badge>}
                  </p>
                  {s.note && closed && <p className="mt-2 text-sm">{s.note}</p>}
                  {active && !closed && (
                    <div className="mt-3 space-y-2">
                      <Field label="Note" optional={!s.requires_note} error={errors[s.id]}>
                        {(id, d) => <Textarea id={id} aria-describedby={d} rows={2} value={notes[s.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))} />}
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <Button icon={Check} onClick={() => setStep(s, 'done')}>Done</Button>
                        <Button variant="secondary" icon={SkipForward} onClick={() => setStep(s, 'skipped')}>Skip</Button>
                        <Button variant="quiet" icon={CircleSlash} onClick={() => setStep(s, 'not_applicable')}>Not applicable</Button>
                      </div>
                    </div>
                  )}
                  {active && closed && <Button className="mt-2" variant="quiet" icon={Undo2} onClick={() => setStep(s, 'pending')}>Reopen</Button>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Sheet open={abortOpen} onClose={() => setAbortOpen(false)} title="Stop this protocol"
        footer={<><Button variant="secondary" onClick={() => setAbortOpen(false)}>Keep running</Button><Button variant="danger" disabled={!abortWhy.trim()} onClick={abort}>Stop protocol</Button></>}>
        <Field label="Reason" hint="Recorded in the run history.">{(id, d) => <Textarea id={id} aria-describedby={d} value={abortWhy} onChange={(e) => setAbortWhy(e.target.value)} />}</Field>
      </Sheet>
    </div>
  );
}
