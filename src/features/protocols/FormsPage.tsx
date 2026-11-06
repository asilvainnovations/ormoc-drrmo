import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { updateOnline } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { Badge, Button, List, ListRow, Notice, Section, TextLink } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { FormFieldType, FormTemplate } from '@/types';
import { DrrmHeader } from './DrrmHeader';
import { FORM_STATUS } from './labels';

const FIELD_TYPE: Record<FormFieldType, string> = {
  text: 'Short text', textarea: 'Text', number: 'Number', integer: 'Whole number', date: 'Date', datetime: 'Date and time',
  time: 'Time', select: 'One choice', multiselect: 'Several choices', checkbox: 'Tick box',
};
const STATUS_TONE = { draft: 'warn', approved: 'ok', retired: 'neutral' } as const;

export function FormsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const isHead = has('cdrrmo_head');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const data = useLiveQuery(async () => {
    const forms = (await db.form_templates.toArray()).sort((a, b) => a.code.localeCompare(b.code));
    const steps = await db.protocol_steps.toArray();
    const templates = new Map((await db.protocol_templates.toArray()).map((t) => [t.id, t]));
    const uses = new Map<string, { title: string; seq: number }[]>();
    for (const s of steps) if (s.form_code) uses.set(s.form_code, [...(uses.get(s.form_code) ?? []), { title: templates.get(s.template_id)?.title ?? '', seq: s.seq }]);
    const docs = new Map((await db.moo_documents.toArray()).map((d) => [d.id, d]));
    return { forms, uses, docs };
  }, []);
  const open = data?.forms.find((f) => f.id === openId) ?? null;

  const setStatus = async (f: FormTemplate, status: FormTemplate['status'], verb: string) => {
    setBusy(true);
    try { await updateOnline('form_templates', f, { status }, `${verb} ${f.code}`); toast(`${verb}: ${f.code}`); }
    catch (e) { toast((e as Error).message, 'bad'); }
    finally { setBusy(false); }
  };

  const byStatus = (st: FormTemplate['status']) => (data?.forms ?? []).filter((f) => f.status === st);
  return (
    <div className="page">
      <DrrmHeader />
      <Notice tone="info" title="Every step has a form">
        A step is closed on its form: the Manual's form where there is one, otherwise the one-tap step record. A run keeps the form as it was when the run started, so later revisions never change a past record.
      </Notice>
      {(['draft', 'approved', 'retired'] as const).map((st) => byStatus(st).length > 0 && (
        <Section key={st} title={`${FORM_STATUS[st]} (${byStatus(st).length})`}>
          <List>
            {byStatus(st).map((f) => {
              const n = data?.uses.get(f.code)?.length ?? 0;
              return <ListRow key={f.id} tip="See the fields and the steps that use this form" onClick={() => setOpenId(f.id)}
                title={`${f.code} ${f.title}`} meta={`${f.schema.fields.length} fields. Used by ${n} step${n === 1 ? '' : 's'}. Rev. ${f.rev}`}
                trailing={<Badge tone={STATUS_TONE[f.status]}>{FORM_STATUS[f.status]}</Badge>} />;
            })}
          </List>
        </Section>
      ))}
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
          {open.document_id && data?.docs.get(open.document_id) && (
            <p className="text-sm">Source: <TextLink tip="Open the manual section this form comes from" to={`/library/doc/${open.document_id}`}>{data.docs.get(open.document_id)!.code} {data.docs.get(open.document_id)!.title}</TextLink></p>
          )}
          <h3 className="mt-4 font-semibold">Fields</h3>
          <ol className="space-y-2">
            {open.schema.fields.map((f, i) => (
              <li key={f.key} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold">{i + 1}</span>
                <span>{f.label} <span className="text-sm text-muted">({FIELD_TYPE[f.type]}{f.required ? ', required' : ''})</span>
                  {f.options && <span className="block text-xs text-muted">{f.options.join(' · ')}</span>}
                  {f.hint && <span className="block text-xs text-muted">{f.hint}</span>}</span>
              </li>
            ))}
          </ol>
          <h3 className="mt-4 font-semibold">Used by</h3>
          {(data?.uses.get(open.code) ?? []).length === 0 ? <p className="text-sm text-muted">No step uses this form yet.</p>
            : <ul className="list-disc space-y-1 pl-5 text-sm">{data!.uses.get(open.code)!.map((u, i) => <li key={i}>{u.title}, step {u.seq}</li>)}</ul>}
        </>}
      </Sheet>
    </div>
  );
}
