import type React from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, MousePointerClick, Play } from 'lucide-react';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { useAuth, ROLE_LABEL } from '@/lib/auth';
import { canOperate } from '@/domain/eoc';
import { relative } from '@/lib/time';
import { Badge, Button, Checkbox, EmptyState, List, ListRow, Notice, Section, TextLink } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { FormTemplate, ProtocolCategory, ProtocolStep, ProtocolTemplate } from '@/types';
import { CATEGORY, KIND_LABEL, THEMATIC, templateIsWorkflow } from './labels';
import { Separator } from '@/components/ui/separator';
import { StatusBadge, StatusLegend } from '@/components/StatusBadge';
import { RefText } from '@/components/RefText';
import { DrrmHeader } from './DrrmHeader';
import { startProtocol } from './actions';
import { Tabs as KitTabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input as KitInput } from '@/components/ui/input';
import { Badge as KitBadge } from '@/components/ui/badge';
import { tip } from '@/components/Tooltip';

export function ProtocolsPage({ kind }: { kind: 'workflows' | 'protocols' }) {
  const wanted = (t: ProtocolTemplate) => (kind === 'workflows') === templateIsWorkflow(t);
  const { roles, userId } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState<ProtocolTemplate | null>(null);
  // 1.11: ?open=CODE opens a template directly (search palette, links from the Library).
  const [params, setParams] = useSearchParams();
  const wantedCode = params.get('open');
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
  useEffect(() => {
    if (!wantedCode || !data) return;
    const t = data.templates.find((x) => x.code === wantedCode);
    if (t) setOpen(t);
    setParams((p) => { p.delete('open'); return p; }, { replace: true });
  }, [wantedCode, data, setParams]);
  const steps = useLiveQuery(() => (open ? db.protocol_steps.where('template_id').equals(open.id).sortBy('seq') : []), [open?.id], []);
  const doc = useLiveQuery(() => (open?.document_id ? db.moo_documents.get(open.document_id) : undefined), [open?.document_id]);

  const [drill, setDrill] = useState(false);
  const start = async (t: ProtocolTemplate) => {
    const id = await startProtocol(t, userId, drill ? { type: 'drill', id: null } : undefined, drill ? `Drill: ${t.title}` : t.title);
    setOpen(null); setDrill(false); toast(drill ? `Drill started: ${t.title}` : `${t.title} started`); nav(`/drrm/run/${id}`);
  };

  // 1.11: filter by title, code, controlling SOP or owner.
  const [q, setQ] = useState('');
  const match = (t: ProtocolTemplate) => {
    const w = q.trim().toLowerCase();
    return !w || [t.title, t.code, t.sop_ref, t.process_owner].join(' ').toLowerCase().includes(w);
  };
  const groups = new Map<ProtocolCategory, ProtocolTemplate[]>();
  for (const t of (data?.templates ?? []).filter(match)) groups.set(t.category, [...(groups.get(t.category) ?? []), t]);
  const total = data?.templates.length ?? 0;
  const drafts = data?.templates.filter((t) => t.status === 'draft').length ?? 0;

  return (
    <div className="page">
      <DrrmHeader />
      <StatusLegend subject={kind === 'workflows' ? 'Each workflow' : 'Each protocol'} />
      {data && total > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)]">
          {[[kind === 'workflows' ? 'Workflows' : 'Protocols', total, 'In the Manual, not retired'], ['Drafts', drafts, 'Awaiting validation and approval'], ['Running now', data.running.length, 'On any device']].map(([l, n, d]) => (
            <Card key={String(l)} className="rounded-sheet"><CardContent className="p-4"><p className="font-data text-3xl font-bold text-action">{n}</p><p className="font-semibold">{l}</p><p className="text-xs text-muted">{d}</p></CardContent></Card>
          ))}
          <div className="flex items-end">
            <label className="w-full text-sm font-semibold" {...tip('Type a word, a code such as SOP 4-06, or an office to narrow the list')}>Find
              <KitInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, SOP 4-06, owner…" className="mt-1 min-h-tap" />
            </label>
          </div>
        </div>
      )}
      {data && q && groups.size === 0 && <Notice tone="info">Nothing matches “{q}”.</Notice>}
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
      {THEMATIC.map((area, i) => {
        const cats = area.categories.filter((c) => groups.has(c));
        if (q && cats.length === 0) return null;
        return (
          <div key={area.key}>
            {i > 0 && <Separator className="my-6" />}
            <Section title={area.label}>
              <p className="mb-3 -mt-1 max-w-prose text-sm text-muted">{area.about}</p>
              {cats.length === 0 && <p className="text-sm text-muted">No {kind === 'workflows' ? 'workflow' : 'protocol'} in this area yet.</p>}
              {cats.map((cat) => (
                <div key={cat} className="mb-4">
                  <h3 className="mb-1 text-sm font-semibold text-muted">{CATEGORY[cat]}</h3>
                  <List>
                    {groups.get(cat)!.map((t) => <ListRow tip="See the steps, the process owner and the forms, then start it" key={t.id} onClick={() => setOpen(t)} title={<>{t.title}{t.sop_ref && <KitBadge variant="outline" size="sm" className="ml-2 align-middle font-data">{t.sop_ref.split(' (')[0]}</KitBadge>}</>}
                      meta={[t.process_owner && `Owner: ${t.process_owner}`, t.trigger_text].filter(Boolean).join('. ') || undefined}
                      trailing={<StatusBadge status={t.status} />} />)}
                  </List>
                </div>
              ))}
            </Section>
          </div>
        );
      })}
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
          <KitTabs defaultValue="steps" className="w-full">
            <TabsList className="h-auto w-full justify-start gap-1">
              <TabsTrigger value="steps" className="min-h-tap" {...tip('The steps in order, with the form each one is recorded on')}>Steps ({steps.length})</TabsTrigger>
              <TabsTrigger value="control" className="min-h-tap" {...tip('Controlling SOP, process owner, policy basis and IAT indicators')}>SOP control</TabsTrigger>
              <TabsTrigger value="when" className="min-h-tap" {...tip('When to use it and who usually runs it')}>When and who</TabsTrigger>
            </TabsList>
            <TabsContent value="steps">
              <FlowDiagram steps={steps} forms={data?.forms ?? new Map()} />
            </TabsContent>
            <TabsContent value="control">
              <SopControl t={open} />
              {doc && <p className="mt-2 text-sm">Procedure source: <TextLink tip="Open the manual section this protocol comes from" to={`/library/doc/${doc.id}`}>{doc.code} {doc.title}</TextLink></p>}
              {/* 1.19 (ADR-033): jump to this protocol's RACI assignments on the board. */}
              <p className="mt-2 text-sm">Who does what: <TextLink tip="See who is Responsible, Accountable, Consulted and Informed for this protocol" to={`/raci?template=${encodeURIComponent(open.code)}`}>RACI for {open.code}</TextLink></p>
            </TabsContent>
            <TabsContent value="when" className="space-y-2">
              <p className="text-sm text-muted"><span className="font-semibold text-ink">When: </span>{open.trigger_text}</p>
              <p className="text-sm text-muted"><span className="font-semibold text-ink">Usually run by: </span>{ROLE_LABEL[open.owner_role]}</p>
              {open.process_owner && <p className="text-sm text-muted"><span className="font-semibold text-ink">Process owner: </span>{open.process_owner}</p>}
            </TabsContent>
          </KitTabs>
        </>}
      </Sheet>
    </div>
  );
}

/** 1.12: the workflow as a flow — a vertical spine of numbered nodes, top to bottom, with the
 *  form each step records on drawn as a connector chip. Form chips link to the Forms page,
 *  which links back, so workflow ↔ form navigation works both ways. */
export function FlowDiagram({ steps, forms }: { steps: ProtocolStep[]; forms: Map<string, FormTemplate> }) {
  const critical = steps.filter((s) => s.is_critical).length;
  const onForm = steps.filter((s) => s.form_code && s.form_code !== 'STEP-RECORD').length;
  if (steps.length === 0) return <EmptyState title="No steps yet" body="Steps arrive with the reference data. Open Settings, then Sync, if this stays empty." />;
  return (
    <div>
      <p className="mb-4 text-sm text-muted" {...tip('Steps run top to bottom. A blue chip opens the Manual form the step is recorded on; a dashed chip closes with a one-tap record. Red numbers are critical steps.')}>
        {steps.length} step{steps.length === 1 ? '' : 's'} · {critical} critical · {onForm} recorded on a Manual form
      </p>
      <ol className="flow-spine">
        {steps.map((s, i) => {
          const form = s.form_code ? forms.get(s.form_code) : undefined;
          return (
            <li key={s.id} className="relative flex gap-3">
              <div className="flex w-9 flex-col items-center">
                <span className={clsx('z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-data text-sm font-bold',
                  s.is_critical ? 'bg-bad text-on-strong' : 'bg-action text-on-action')}
                  {...tip(s.is_critical ? `Critical step ${s.seq}: missing it breaks the sequence` : `Step ${s.seq} of ${steps.length}`)}>
                  {s.seq}
                </span>
                {i < steps.length - 1 && <span aria-hidden="true" className="spine-line w-0.5 flex-1" />}
              </div>
              <div className={clsx('min-w-0 flex-1', i < steps.length - 1 && 'pb-4')}>
                <div className="rounded-sheet border border-line bg-surface p-3">
                  <p className="leading-6">{s.instruction}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {s.is_critical && <Badge tone="bad">Critical</Badge>}
                    {s.requires_note && <Badge tone="neutral">Note required</Badge>}
                    {s.due_offset_minutes !== null && <Badge tone="info">Target: +{s.due_offset_minutes} min</Badge>}
                  </div>
                  {s.form_code === 'STEP-RECORD' ? (
                    <div className="mt-3 flex items-center gap-2 rounded-control border border-dashed border-line bg-sunken px-3 py-2"
                      {...tip('This step closes with a one-tap record: who closed it and when. No separate form.')}>
                      <MousePointerClick className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="text-sm text-muted">One-tap step record — no separate form.</span>
                    </div>
                  ) : s.form_code && (
                    <Link to={`/drrm/forms?open=${encodeURIComponent(s.form_code)}`}
                      {...tip(`Open form ${s.form_code}: its fields, options and every step that uses it`)}
                      className="mt-3 flex items-center gap-2 rounded-control border border-line bg-sky-soft px-3 py-2 no-underline hover:border-sky">
                      <FileText className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{s.form_code} {form?.title}</span>
                        <span className="block truncate text-xs text-muted">{form ? `${form.schema.fields.length} field${form.schema.fields.length === 1 ? '' : 's'} · opens in Forms` : 'Form opens in Forms'}</span>
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
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
