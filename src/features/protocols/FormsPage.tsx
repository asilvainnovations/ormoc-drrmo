import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { updateOnline } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { Badge, Button, List, ListRow, Notice, Section, TextLink } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import type { FormFieldType, FormTemplate, ProtocolCategory } from '@/types';
import { DrrmHeader } from './DrrmHeader';
import { AREA_SHORT, CATEGORY, FORM_STATUS, THEMATIC, formAreas, templateIsWorkflow, thematicOf, type ThematicArea } from './labels';
import GlassCard from '@/components/ui/GlassCard';
import { PILLAR_CLASS } from '@/features/library/pillars';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input as KitInput } from '@/components/ui/input';
import { Badge as KitBadge } from '@/components/ui/badge';

const FIELD_TYPE: Record<FormFieldType, string> = {
  text: 'Short text', textarea: 'Text', number: 'Number', integer: 'Whole number', date: 'Date', datetime: 'Date and time',
  time: 'Time', select: 'One choice', multiselect: 'Several choices', checkbox: 'Tick box',
};

export function FormsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const isHead = has('cdrrmo_head');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const wantedCode = params.get('open');
  const data = useLiveQuery(async () => {
    const forms = (await db.form_templates.toArray()).sort((a, b) => a.code.localeCompare(b.code));
    const steps = await db.protocol_steps.toArray();
    const templates = new Map((await db.protocol_templates.toArray()).map((t) => [t.id, t]));
    // 1.12: carry the owning template so "Used by" links back to the workflow/protocol sheet.
    const uses = new Map<string, { code: string; kind: 'workflow' | 'protocol'; title: string; sop_ref: string | null; seq: number; category: ProtocolCategory | null }[]>();
    for (const s of steps) if (s.form_code) {
      const t = templates.get(s.template_id);
      const kind = t ? (templateIsWorkflow(t) ? 'workflow' as const : 'protocol' as const) : 'protocol' as const;
      uses.set(s.form_code, [...(uses.get(s.form_code) ?? []), { code: t?.code ?? '', kind, title: t?.title ?? 'Unknown procedure', sop_ref: t?.sop_ref ?? null, seq: s.seq, category: t?.category ?? null }]);
    }
    for (const list of uses.values()) list.sort((a, b) => a.title.localeCompare(b.title) || a.seq - b.seq);
    const docs = new Map((await db.moo_documents.toArray()).map((d) => [d.id, d]));
    return { forms, uses, docs };
  }, []);
  useEffect(() => {   // 1.11: ?open=CODE from the search palette
    if (!wantedCode || !data) return;
    const f = data.forms.find((x) => x.code === wantedCode);
    if (f) setOpenId(f.id);
    setParams((p) => { p.delete('open'); return p; }, { replace: true });
  }, [wantedCode, data, setParams]);
  const open = data?.forms.find((f) => f.id === openId) ?? null;

  const setStatus = async (f: FormTemplate, status: FormTemplate['status'], verb: string) => {
    setBusy(true);
    try { await updateOnline('form_templates', f, { status }, `${verb} ${f.code}`); toast(`${verb}: ${f.code}`); }
    catch (e) { toast((e as Error).message, 'bad'); }
    finally { setBusy(false); }
  };

  // 1.29.0 (ADR-046): forms sit under the thematic area of the steps that record on them (most-used first),
  // so each area shows its workflows, protocols and forms together. A form also used elsewhere says where.
  const [status, setStatus2] = useState<'all' | FormTemplate['status']>('all');
  const [q, setQ] = useState('');
  const placed = (data?.forms ?? []).filter((f) => f.code !== 'STEP-RECORD').map((f) => {
    const u = data?.uses.get(f.code) ?? [];
    const cats = u.map((x) => x.category).filter((c): c is ProtocolCategory => !!c);
    const doc = f.document_id ? data?.docs.get(f.document_id) : undefined;
    const { primary, also } = formAreas(cats, doc?.code);
    const mainCat = cats.filter((c) => thematicOf(c) === primary).sort((a, b) => cats.filter((x) => x === b).length - cats.filter((x) => x === a).length)[0] ?? null;
    return { f, uses: u.length, primary, also, mainCat };
  }).filter(({ f }) => (status === 'all' || f.status === status)
    && (!q.trim() || `${f.code} ${f.title} ${f.purpose ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())));
  const stepRecord = data?.forms.find((f) => f.code === 'STEP-RECORD');
  const byArea = (a: ThematicArea) => placed.filter((p) => p.primary === a);
  const counts = { all: (data?.forms.length ?? 1) - 1, draft: 0, approved: 0, retired: 0 } as Record<'all' | FormTemplate['status'], number>;
  for (const f of data?.forms ?? []) if (f.code !== 'STEP-RECORD') counts[f.status] += 1;
  return (
    <div className="page">
      <DrrmHeader />
      <Notice tone="info" title="Every step has a form">
        A step is closed on its form: the Manual's form where there is one, otherwise the one-tap step record. A run keeps the form as it was when the run started, so later revisions never change a past record. Forms are grouped by the thematic area of the steps that use them.
      </Notice>
      {data && (
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <ToggleGroup type="single" value={status} onValueChange={(v) => v && setStatus2(v as typeof status)} className="flex-wrap justify-start" aria-label="Filter forms by status">
            {(['all', 'draft', 'approved', 'retired'] as const).map((k) => (
              <ToggleGroupItem key={k} value={k} className="min-h-tap px-3" {...tip(k === 'all' ? 'Show every form' : `Show ${FORM_STATUS[k].toLowerCase()} forms only`)}>
                {k === 'all' ? 'All' : FORM_STATUS[k]} <span className="ml-1 font-data text-xs text-muted">{counts[k]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <label className="min-w-[14rem] flex-1 text-sm font-semibold" {...tip('Type a code such as ME-F05, or a word from the title')}>Find
            <KitInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code or title…" className="mt-1 min-h-tap" />
          </label>
        </div>
      )}
      {data && q && placed.length === 0 && <Notice tone="info">Nothing matches “{q}”.</Notice>}
      {THEMATIC.map((area) => {
        const rows = byArea(area.key);
        if ((q || status !== 'all') && rows.length === 0) return null;
        return (
          <Section key={area.key} title={`${area.label} (${rows.length})`}>
            <GlassCard hover={false} className={`border-l-4 p-3 sm:p-4 ${PILLAR_CLASS[area.key].edge}`}>
              <p className="mb-3 max-w-prose text-sm text-muted">{area.about}</p>
              {rows.length === 0 ? <p className="text-sm text-muted">No form in this area yet.</p> : (
                <List>
                  {rows.map(({ f, uses, also, mainCat }) => (
                    <ListRow key={f.id} tip="See the fields and the steps that use this form" onClick={() => setOpenId(f.id)}
                      title={<>{f.code} {f.title}</>}
                      meta={<>
                        {mainCat ? CATEGORY[mainCat] : 'Not yet recorded on any step'} · {f.schema.fields.length} fields · used by {uses} step{uses === 1 ? '' : 's'} · Rev. {f.rev}
                        {also.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{also.map((a) => <KitBadge key={a} variant="outline" size="sm" {...tip(`Also recorded on steps in ${AREA_SHORT[a]}`)}>Also: {AREA_SHORT[a]}</KitBadge>)}</span>}
                      </>}
                      trailing={<StatusBadge status={f.status} />} />
                  ))}
                </List>
              )}
            </GlassCard>
          </Section>
        );
      })}
      {stepRecord && !q && status === 'all' && (
        <Section title="Shared by Every Area">
          <List>
            <ListRow tip="The one-tap record used where the Manual has no form for a step" onClick={() => setOpenId(stepRecord.id)}
              title={`${stepRecord.code} ${stepRecord.title}`} meta={`Used by ${data?.uses.get(stepRecord.code)?.length ?? 0} steps across all four areas`}
              trailing={<StatusBadge status={stepRecord.status} />} />
          </List>
        </Section>
      )}
      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open ? `${open.code} ${open.title}` : ''}
        footer={open && (isHead ? (
          <div className="flex flex-wrap gap-2">
            {open.status === 'draft' && <Button tip="Approve this form. Its fields are then fixed; new runs use it (CDRRMO Head; needs a connection)" disabled={busy} onClick={() => setStatus(open, 'approved', 'Approved')}>Approve form</Button>}
            {open.status === 'approved' && <Button tip="Set the form back to draft so its fields can be revised (CDRRMO Head; needs a connection)" variant="secondary" disabled={busy} onClick={() => setStatus(open, 'draft', 'Reopened')}>Reopen for revision</Button>}
            {open.status !== 'retired' && <Button tip="Retire the form. New runs record the step without it; past records keep it (CDRRMO Head; needs a connection)" variant="quiet" disabled={busy} onClick={() => setStatus(open, 'retired', 'Retired')}>Retire</Button>}
            {open.status === 'retired' && <Button tip="Bring the form back as a draft (CDRRMO Head; needs a connection)" variant="secondary" disabled={busy} onClick={() => setStatus(open, 'draft', 'Reopened')}>Reopen as draft</Button>}
          </div>
        ) : <p className="text-sm text-muted">The CDRRMO Head approves, reopens and retires forms.</p>)}>
        {open && <>
          {open.purpose && <p>{open.purpose}</p>}
          {open.code !== 'STEP-RECORD' && (() => {
            const cats = (data?.uses.get(open.code) ?? []).map((u) => u.category).filter((c): c is ProtocolCategory => !!c);
            const { primary, also } = formAreas(cats, open.document_id ? data?.docs.get(open.document_id)?.code : null);
            return <p className="mt-2 text-sm"><span className="font-semibold">Thematic area: </span>{AREA_SHORT[primary]}{also.length > 0 && `; also used in ${also.map((a) => AREA_SHORT[a]).join(', ')}`}</p>;
          })()}
          {open.document_id && data?.docs.get(open.document_id) && (
            <p className="text-sm">Source: <TextLink tip="Open the manual section this form comes from" to={`/library/doc/${open.document_id}`}>{data.docs.get(open.document_id)!.code} {data.docs.get(open.document_id)!.title}</TextLink></p>
          )}
          <h3 className="mt-4 font-semibold">Fields</h3>
          <ol className="space-y-2">
            {open.schema.fields.map((f, i) => (
              <li key={f.key} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold">{i + 1}</span>
                <span className="min-w-0">{f.label} <span className="text-sm text-muted">({FIELD_TYPE[f.type]}{f.required ? ', required' : ''}{f.min !== undefined ? `, from ${f.min}` : ''}{f.max_length ? `, up to ${f.max_length} characters` : ''})</span>
                  {f.options && (
                    <span className="mt-1 flex flex-wrap gap-1.5" {...tip(`${f.type === 'select' ? 'One choice' : 'Several choices'} — the dropdown shows these ${f.options.length} options`)}>
                      {f.options.map((o) => <span key={o} className="rounded-full border border-line bg-sunken px-2 py-0.5 font-data text-xs">{o}</span>)}
                    </span>)}
                  {f.hint && <span className="block text-xs text-muted">{f.hint}</span>}</span>
              </li>
            ))}
          </ol>
          <h3 className="mt-4 font-semibold">Used by</h3>
          {(data?.uses.get(open.code) ?? []).length === 0 ? <p className="text-sm text-muted">No step uses this form yet.</p>
            : <List>
                {data!.uses.get(open.code)!.map((u, i) => (
                  <ListRow key={`${u.code}-${u.seq}-${i}`}
                    tip={`Open the ${u.kind} “${u.title}” at step ${u.seq} of its flow diagram`}
                    to={u.kind === 'workflow' ? `/drrm?open=${encodeURIComponent(u.code)}` : `/drrm/protocols?open=${encodeURIComponent(u.code)}`}
                    title={u.title}
                    meta={`Step ${u.seq}${u.sop_ref ? ` · ${u.sop_ref.split(' (')[0]}` : ''}`}
                    trailing={<span className="flex flex-col items-end gap-1"><Badge tone={u.kind === 'workflow' ? 'info' : 'neutral'}>{u.kind === 'workflow' ? 'Workflow' : 'Protocol'}</Badge>
                      {u.category && <span className="font-data text-xs text-muted">{AREA_SHORT[thematicOf(u.category)]}</span>}</span>} />
                ))}
              </List>}
        </>}
      </Sheet>
    </div>
  );
}
