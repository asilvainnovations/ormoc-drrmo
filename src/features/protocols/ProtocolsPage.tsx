import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { canOperate } from '@/domain/eoc';
import { relative } from '@/lib/time';
import { Badge, Button, Checkbox, List, ListRow, Notice, PageHeader, Section, TextLink } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { ProtocolCategory, ProtocolTemplate } from '@/types';
import { CATEGORY } from './labels';
import { startProtocol } from './actions';

export function ProtocolsPage() {
  const { roles, userId } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState<ProtocolTemplate | null>(null);
  const data = useLiveQuery(async () => {
    const templates = (await db.protocol_templates.toArray()).filter((t) => t.status !== 'retired');
    const running = await db.protocol_runs.where('status').equals('running').reverse().sortBy('started_at');
    const recent = (await db.protocol_runs.where('status').anyOf('completed', 'aborted').reverse().sortBy('started_at')).slice(0, 10);
    const stepCounts = new Map<string, { total: number; open: number }>();
    for (const r of running) {
      const s = await db.protocol_run_steps.where('run_id').equals(r.id).toArray();
      stepCounts.set(r.id, { total: s.length, open: s.filter((x) => x.status === 'pending').length });
    }
    return { templates, running, recent, stepCounts };
  }, []);
  const steps = useLiveQuery(() => (open ? db.protocol_steps.where('template_id').equals(open.id).sortBy('seq') : []), [open?.id], []);
  const doc = useLiveQuery(() => (open?.document_id ? db.moo_documents.get(open.document_id) : undefined), [open?.document_id]);

  const [drill, setDrill] = useState(false);
  const start = async (t: ProtocolTemplate) => {
    const id = await startProtocol(t, userId, drill ? { type: 'drill', id: null } : undefined, drill ? `Drill: ${t.title}` : t.title);
    setOpen(null); setDrill(false); toast(drill ? `Drill started: ${t.title}` : `${t.title} started`); nav(`/protocols/run/${id}`);
  };

  const groups = new Map<ProtocolCategory, ProtocolTemplate[]>();
  for (const t of data?.templates ?? []) groups.set(t.category, [...(groups.get(t.category) ?? []), t]);

  return (
    <div className="page">
      <PageHeader title="CDRRMO protocols" subtitle="Step-by-step procedures from the Manual of Operations. Each run keeps a time-stamped record of who did what." />
      {data?.templates.some((t) => t.status === 'draft') && (
        <Notice tone="warn" title="Draft protocols">These protocols are drafts for CDRRMO validation. Use them for drills and validation sessions until the CDRRMO Head approves them.</Notice>
      )}
      {data && data.running.length > 0 && (
        <Section title="Running now">
          <List>
            {data.running.map((r) => {
              const c = data.stepCounts.get(r.id);
              return <ListRow tip="Continue this run" key={r.id} to={`/protocols/run/${r.id}`} title={r.title} meta={`Started ${relative(r.started_at)}`}
                trailing={c && <Badge tone="info">{c.total - c.open} of {c.total} done</Badge>} />;
            })}
          </List>
        </Section>
      )}
      {Array.from(groups.entries()).map(([cat, ts]) => (
        <Section key={cat} title={CATEGORY[cat]}>
          <List>
            {ts.map((t) => <ListRow tip="See the steps and start this protocol" key={t.id} onClick={() => setOpen(t)} title={t.title} meta={t.trigger_text}
              trailing={t.status === 'draft' ? <Badge tone="warn">Draft</Badge> : <Badge tone="ok">Approved</Badge>} />)}
          </List>
        </Section>
      ))}
      {data && data.recent.length > 0 && (
        <Section title="Recent runs">
          <List>{data.recent.map((r) => <ListRow tip="Open the record of this run" key={r.id} to={`/protocols/run/${r.id}`} title={r.title} meta={relative(r.started_at)}
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
          {doc && <p className="text-sm">Procedure source: <TextLink tip="Open the manual section this protocol comes from" to={`/library/doc/${doc.id}`}>{doc.code} {doc.title}</TextLink></p>}
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold">{s.seq}</span>
                <span>{s.instruction}{s.is_critical && <Badge tone="bad" className="ml-2">Critical</Badge>}
                  {s.due_offset_minutes !== null && <span className="block text-xs text-muted">Target: {s.due_offset_minutes} min after start</span>}</span>
              </li>
            ))}
          </ol>
        </>}
      </Sheet>
    </div>
  );
}
