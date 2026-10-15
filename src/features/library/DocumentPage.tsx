import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FilePen } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { fmtDateTime } from '@/lib/time';
import { Badge, Button, Field, Input, List, ListRow, Loading, Notice, PageHeader, Section, Textarea, TextLink } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { MooVersion } from '@/types';
import { Markdown } from './Markdown';
import { DOC_STATUS } from './labels';

export function DocumentPage() {
  const { id } = useParams();
  const { has } = useAuth();
  const toast = useToast();
  const data = useLiveQuery(async () => {
    const doc = id ? await db.moo_documents.get(id) : undefined;
    if (!doc) return null;
    const versions = (await db.moo_versions.where('document_id').equals(doc.id).toArray()).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.label.localeCompare(a.label));
    const links = await db.moo_document_indicators.where('document_id').equals(doc.id).toArray();
    const indicators = await db.iat_indicators.bulkGet(links.map((l) => l.indicator_id));
    const cycle = (await db.assessment_cycles.orderBy('cycle_year').reverse().toArray())[0];
    const responses = cycle ? await db.responses.where('cycle_id').equals(cycle.id).toArray() : [];
    const protocols = (await db.protocol_templates.toArray()).filter((p) => p.document_id === doc.id);
    return { doc, versions, indicators: indicators.filter(Boolean), byInd: new Map(responses.map((r) => [r.indicator_id, r])), cycle, protocols };
  }, [id]);
  const [viewId, setViewId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ label: string; body: string; note: string } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  if (!data) return <Loading />;
  const { doc, versions } = data;
  const isAuthor = has('author', 'cdrrmo_head');
  const current = versions.find((v) => v.id === doc.current_version_id);
  const shown = versions.find((v) => v.id === viewId) ?? (isAuthor ? versions[0] : current) ?? current;

  const startEdit = () => {
    const base = versions[0];
    const n = versions.length;
    setEdit({ label: `v0.${n + 1} draft`, body: base?.body_md ?? `# ${doc.code} ${doc.title}\n`, note: '' });
  };
  const persist = async () => {
    if (!edit) return;
    const v: MooVersion & { _new: true } = { _new: true, id: uuid(), document_id: doc.id, label: edit.label.trim(), body_md: edit.body, change_note: edit.note.trim() || null, status: 'draft', version: 1 };
    await save('moo_versions', v, `New version of ${doc.code}`);
    setEdit(null); setViewId(v.id); toast('Draft saved');
  };
  const setStatus = async (v: MooVersion, status: MooVersion['status']) => {
    await save('moo_versions', { ...v, status, review_note: reviewNote.trim() || v.review_note || null }, `${status === 'approved' ? 'Approve' : status === 'in_review' ? 'Submit' : 'Return'} ${doc.code} ${v.label}`);
    // The server promotes the approved version (trigger promote_moo_version); mirror it locally only in demo mode.
    if (status === 'approved' && env.demo) await db.moo_documents.put({ ...doc, status: 'approved', current_version_id: v.id });
    setReviewNote(''); toast(status === 'approved' ? 'Approved and published' : status === 'in_review' ? 'Sent for review' : 'Returned to the author');
  };

  return (
    <div className="page">
      <PageHeader title={`${doc.code} ${doc.title}`} back="/library"
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={doc.status === 'approved' ? 'ok' : 'neutral'}>{DOC_STATUS[doc.status]}</Badge>{doc.summary}</span>}
        actions={isAuthor && <Button tip="Write a new draft version of this section. Published versions stay unchanged" icon={FilePen} onClick={startEdit}>New version</Button>} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <article>
          {shown ? (
            <>
              <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
                <Badge tone={shown.status === 'approved' ? 'ok' : shown.status === 'in_review' ? 'info' : 'neutral'}>{shown.label}: {DOC_STATUS[shown.status]}</Badge>
                {shown.approved_at && `Approved ${fmtDateTime(shown.approved_at)}`}
              </p>
              {shown.status !== 'approved' && current && <Notice tone="info">You are reading a draft. The approved text is {current.label}.</Notice>}
              {shown.review_note && <Notice tone="warn" title="Reviewer's note">{shown.review_note}</Notice>}
              <Markdown source={shown.body_md} />
              {isAuthor && shown.status === 'draft' && <div className="mt-6"><Button tip="Send this draft to the CDRRMO Head for review" onClick={() => setStatus(shown, 'in_review')}>Submit for review</Button></div>}
              {has('cdrrmo_head') && shown.status === 'in_review' && (
                <div className="mt-6 space-y-3 rounded-control border border-line p-4">
                  <Field label="Review note" optional>{(fid) => <Textarea id={fid} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />}</Field>
                  <div className="flex flex-wrap gap-2"><Button tip="Approve and publish. It becomes the current version and cannot be changed" onClick={() => setStatus(shown, 'approved')}>Approve and publish</Button><Button tip="Send back to the author for changes" variant="secondary" onClick={() => setStatus(shown, 'rejected')}>Return to author</Button></div>
                </div>
              )}
            </>
          ) : <p className="text-muted">No approved text yet.</p>}
        </article>
        <aside className="space-y-6">
          <Section title="Versions">
            <List>{versions.map((v) => <ListRow tip="Show this version" key={v.id} onClick={() => setViewId(v.id)} title={v.label} meta={v.change_note ?? undefined}
              trailing={<Badge tone={v.status === 'approved' ? 'ok' : 'neutral'}>{DOC_STATUS[v.status]}</Badge>} />)}</List>
          </Section>
          <Section title="Indicators this section answers">
            <ul className="space-y-2">{data.indicators.map((i) => {
              const r = data.byInd.get(i!.id);
              return <li key={i!.id} className="text-sm">
                {data.cycle ? <TextLink tip="Open this indicator in the current assessment" to={`/assess/${data.cycle.id}/i/${encodeURIComponent(i!.id)}`}>{i!.id}</TextLink> : <span className="font-semibold">{i!.id}</span>}
                {r && <Badge className="ml-2">{r.is_na ? 'NA' : `Score ${r.score ?? '–'}`}</Badge>}
                <span className="block text-muted">{i!.statement}</span></li>;
            })}</ul>
          </Section>
          {data.protocols.length > 0 && (
            <Section title="Protocols from this section">
              <ul className="space-y-1">{data.protocols.map((p) => <li key={p.id}><TextLink tip={`Open ${p.title} in Protocols`} to="/protocols">{p.title}</TextLink></li>)}</ul>
            </Section>
          )}
        </aside>
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={`New version of ${doc.code}`}
        footer={<><Button tip="Close without saving" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button tip="Save as a draft version" disabled={!edit?.label.trim()} onClick={persist}>Save draft</Button></>}>
        {edit && <>
          <Field label="Version label">{(fid) => <Input id={fid} value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />}</Field>
          <Field label="Text" hint="Markdown: # heading, ## subheading, - list item, **bold**.">{(fid, d) => <Textarea id={fid} aria-describedby={d} rows={16} className="font-sans" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />}</Field>
          <Field label="What changed" optional>{(fid) => <Input id={fid} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />}</Field>
        </>}
      </Sheet>
    </div>
  );
}
