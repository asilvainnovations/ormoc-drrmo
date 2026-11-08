import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { canOperate } from '@/domain/eoc';
import { relative } from '@/lib/time';
import { Badge, Button, Checkbox, EmptyState, List, ListRow, Notice, Section, TextLink } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { ProtocolCategory, ProtocolTemplate } from '@/types';
import { CATEGORY, KIND_LABEL, templateIsWorkflow } from './labels';
import { RefText } from '@/components/RefText';
import { DrrmHeader } from './DrrmHeader';
import { startProtocol } from './actions';

export function ProtocolsPage({ kind }: { kind: 'workflows' | 'protocols' }) {
  const wanted = (t: ProtocolTemplate) => (kind === 'workflows') === templateIsWorkflow(t);
  const { roles, userId } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState<ProtocolTemplate | null>(null);
  const data = useLiveQuery(async () => {
    const all = await db.protocol_templates.toArray();
    const templates = all.filter((t) => t.status !== 'retired' && wanted(t));
    const mine = new Set(all.filter((t) => wanted(t)).map((t) => t.id));
    const running = (await db.protocol_runs.where('status').equals('running').reverse().sortBy('started_at')).filter((r) => mine.has(r.template_id));
    const recent = (await db.protocol_runs.where('status').anyOf('completed', 'aborted').reverse().sortBy('started_at')).filter((r) => mine.has(r.template_id)).slice(0, 10);
    const forms = new Map((await db.form_templates.toArray()).map((f) => [f.code, f]));
    const stepCounts = new Map<string, { total: number; open: number }>();
    for (const r of running) {
      const s = await db.protocol_run_steps.where('run_id').equals(r.id).toArray();
      stepCounts.set(r.id, { total: s.length, open: s.filter((x) => x.status === 'pending').length });
    }
    return { templates, running, recent, stepCounts, forms };
  }, [kind]);
  const steps = useLiveQuery(() => (open ? db.protocol_steps.where('template_id').equals(open.id).sortBy('seq') : []), [open?.id], []);
  const doc = useLiveQuery(() => (open?.document_id ? db.moo_documents.get(open.document_id) : undefined), [open?.document_id]);

  const [drill, setDrill] = useState(false);
  const start = async (t: ProtocolTemplate) => {
    const id = await startProtocol(t, userId, drill ? { type: 'drill', id: null } : undefined, drill ? `Drill: ${t.title}` : t.title);
    setOpen(null); setDrill(false); toast(drill ? `Drill started: ${t.title}` : `${t.title} started`); nav(`/drrm/run/${id}`);
  };

  const groups = new Map<ProtocolCategory, ProtocolTemplate[]>();
  for (const t of data?.templates ?? []) groups.set(t.category, [...(groups.get(t.category) ?? []), t]);

  return (
    <div className="page">
      <DrrmHeader />
      {data?.templates.some((t) => t.status === 'draft') && (
        <Notice tone="warn" title={kind === 'workflows' ? 'Draft workflows' : 'Draft protocols'}>These are drafts for CDRRMO validation. Use them for drills and validation sessions until the CDRRMO Head approves them.</Notice>
      )}
      {data && data.templates.length === 0 && <EmptyState title={kind === 'workflows' ? 'No workflows yet' : 'No protocols yet'} body="They arrive with the reference data. Open Settings, then Sync, if this stays empty." />}
      {data && data.running.length > 0 && (
        <Section title="Running now">
          <List>
            {data.running.map((r) => {
              const c = data.stepCounts.get(r.id);
              return <ListRow tip="Continue this run" key={r.id} to={`/drrm/run/${r.id}`} title={r.title} meta={`Started ${relative(r.started_at)}`}
                trailing={c && <Badge tone="info">{c.total - c.open} of {c.total} done</Badge>} />;
            })}
          </List>
        </Section>
      )}
      {Array.from(groups.entries()).map(([cat, ts]) => (
        <Section key={cat} title={CATEGORY[cat]}>
          <List>
            {ts.map((t) => <ListRow tip="See the steps, the process owner and the forms, then start it" key={t.id} onClick={() => setOpen(t)} title={t.title}
              meta={[t.process_owner && `Owner: ${t.process_owner}`, t.trigger_text].filter(Boolean).join('. ') || undefined}
              trailing={t.status === 'draft' ? <Badge tone="warn">Draft</Badge> : <Badge tone="ok">Approved</Badge>} />)}
          </List>
        </Section>
      ))}
      {data && data.recent.length > 0 && (
        <Section title="Recent runs">
          <List>{data.recent.map((r) => <ListRow tip="Open the record of this run" key={r.id} to={`/drrm/run/${r.id}`} title={r.title} meta={relative(r.started_at)}
            trailing={<Badge tone={r.status === 'completed' ? 'ok' : 'bad'}>{r.status === 'completed' ? 'Completed' : 'Stopped'}</Badge>} />)}</List>
        </Section>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}
        footer={open && (canOperate(roles)
          ? <div className="flex flex-wrap items-center gap-3">
              <Checkbox tip="Tick for an exercise. The run is recorded as a drill, which counts as evidence of testing" checked={drill} onChange={() => setDrill((d) => !d)}>This is a drill</Checkbox>
              <Button tip="Start now. Each step records who closed it and when" icon={Play} size="lg" onClick={() => start(open)}>{drill ? 'Start drill' : 'Start protocol'}</Button>
            </div>
          : <p className="text-sm text-muted">Duty officers and EOC staff start protocols.</p>)}>
        {open && <>
          <p>{open.purpose}</p>
          <p className="text-sm text-muted"><span className="font-semibold text-ink">When: </span>{open.trigger_text}</p>
          <p className="text-sm text-muted"><span className="font-semibold text-ink">Usually run by: </span>{ROLE_LABEL[open.owner_role]}</p>
          <SopControl t={open} />
          {doc && <p className="text-sm">Procedure source: <TextLink tip="Open the manual section this protocol comes from" to={`/library/doc/${doc.id}`}>{doc.code} {doc.title}</TextLink></p>}
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold">{s.seq}</span>
                <span>{s.instruction}{s.is_critical && <Badge tone="bad" className="ml-2">Critical</Badge>}
                  {s.due_offset_minutes !== null && <span className="block text-xs text-muted">Target: {s.due_offset_minutes} min after start</span>}
                  {s.form_code && <span className="block text-xs text-muted">Form: {s.form_code === 'STEP-RECORD' ? 'one-tap step record' : `${s.form_code} ${data?.forms.get(s.form_code)?.title ?? ''}`}</span>}</span>
              </li>
            ))}
          </ol>
        </>}
      </Sheet>
    </div>
  );
}

/** The SOP control block (ADR-019): the same five elements for every protocol and workflow. */
function SopControl({ t }: { t: ProtocolTemplate }) {
  const rows: [string, React.ReactNode][] = [
    ['Type', KIND_LABEL[t.kind ?? (templateIsWorkflow(t) ? 'workflow' : 'protocol')]],
    ['Controlling SOP', t.sop_ref ?? '—'],
    ['Process owner', t.process_owner ?? 'To be assigned'],
    ['Policy basis', t.policy_refs?.length ? <RefText text={t.policy_refs.join('; ')} /> : '—'],
    ['IAT indicators', t.indicator_ids?.length ? t.indicator_ids.join(', ') : '—'],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-1 rounded-control border border-line bg-sunken px-3 py-2 text-sm sm:grid-cols-[minmax(0,10rem)_1fr]" aria-label="SOP control block">
      {rows.map(([k, v]) => <div key={k} className="contents"><dt className="font-semibold">{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}
