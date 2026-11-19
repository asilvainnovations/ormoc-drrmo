// Chapter corrections (1.27.0): validators, assessors, authors, lead-office focals and the CDRRMO Head add, delete or
// revise text in a section, or add or replace a figure. Saved online through apply_manual_correction, which writes the
// change into the working draft and logs it (who, when, section, before, after, reason). Approved text never changes;
// the CDRRMO Head still approves the draft. Figures go to the private manual-figures bucket first.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { callOnline, NeedsConnectionError } from '@/lib/store';
import { syncNow } from '@/lib/sync';
import { uuid } from '@/lib/ids';
import { fmtDateTime } from '@/lib/time';
import { Badge, Button, ChoiceGroup, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import { correctedSection, figureMarkdown, figurePath, isFigure, paragraphDiff, paragraphs, splitSections, type CorrectionInput } from '@/domain/manualSections';
import type { CorrectionAction, ManualCorrection, MooDocument, MooVersion } from '@/types';

export const CORRECTION_ROLES = ['validator', 'assessor', 'author', 'lead_office_focal', 'cdrrmo_head'] as const;
export const ACTION_LABEL: Record<CorrectionAction, string> = { add: 'Added text', delete: 'Deleted text', revise: 'Revised text', figure: 'Figure' };
const FIGURE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const short = (t: string, n = 90) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export function CorrectionSheet({ open, onClose, doc, base }: { open: boolean; onClose: () => void; doc: MooDocument; base: MooVersion }) {
  const toast = useToast();
  const sections = useMemo(() => splitSections(base.body_md), [base.body_md]);
  const reviewItems = useLiveQuery(async () => (await db.manual_review_items.toArray())
    .filter((r) => r.review_status !== 'closed').sort((a, b) => a.source_tracker_id.localeCompare(b.source_tracker_id)), [], []);
  const [idx, setIdx] = useState(sections.length > 1 ? 1 : 0);
  const [action, setAction] = useState<CorrectionAction>('revise');
  const section = sections[Math.min(idx, sections.length - 1)]!;
  const paras = paragraphs(section);
  const [revised, setRevised] = useState<string | null>(null);
  const [added, setAdded] = useState('');
  const [after, setAfter] = useState<number | null>(null);
  const [remove, setRemove] = useState<number[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [replace, setReplace] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const pickSection = (i: number) => { setIdx(i); setRevised(null); setAfter(null); setRemove([]); setReplace(null); setProblem(null); };

  const save = async () => {
    setProblem(null);
    if (reason.trim().length < 5) { setProblem('Give a reason for the correction, for example the workshop session or review item.'); return; }
    let figurePathValue: string | null = null;
    const input: CorrectionInput = { action, revised: revised ?? section.text, added, afterParagraph: after, remove };
    try {
      if (action === 'figure') {
        if (!file) { setProblem('Choose the figure file (PNG, JPEG or WebP, up to 10 MB).'); return; }
        if (!FIGURE_TYPES.includes(file.type)) { setProblem(`${file.name} is not a PNG, JPEG or WebP image.`); return; }
        if (file.size > 10 * 1024 * 1024) { setProblem(`${file.name} is larger than 10 MB.`); return; }
        if (!caption.trim()) { setProblem('Give the figure a caption, for example "Figure 4-2: Warning-to-action flow".'); return; }
        figurePathValue = figurePath(doc.id, uuid(), file.name);
        input.figure = figureMarkdown(caption, figurePathValue);
        input.replaceParagraph = replace;
      }
      const afterText = correctedSection(section, input);
      setBusy(true);
      if (!navigator.onLine) throw new NeedsConnectionError('Saving a correction');
      if (figurePathValue && file) {
        const { error } = await supabase.storage.from('manual-figures').upload(figurePathValue, file, { contentType: file.type, upsert: false });
        if (error) throw new Error(`The figure could not be uploaded: ${error.message}`);
        await db.files.put({ id: `mf:${figurePathValue}`, blob: file, name: file.name, type: file.type, createdAt: new Date().toISOString() });
      }
      const res = await callOnline<{ version_label: string }>('apply_manual_correction', {
        p_document_id: doc.id, p_base_version_id: base.id, p_section_title: section.title, p_action: action,
        p_before: section.text, p_after: afterText, p_reason: reason.trim(), p_figure_path: figurePathValue, p_review_item_id: itemId || null,
      }, 'Saving a correction');
      await syncNow({ only: ['moo_versions', 'manual_corrections'] }).catch(() => undefined);
      toast(`Correction saved in ${res.version_label} and logged`);
      setRevised(null); setAdded(''); setRemove([]); setFile(null); setCaption(''); setReplace(null); setReason('');
      onClose();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Correct ${doc.code}`}
      footer={<><Button variant="secondary" tip="Close without saving" onClick={onClose}>Cancel</Button>
        <Button busy={busy} tip="Save the correction into the working draft and log it with your name, the time and the reason" onClick={() => void save()}>Save correction</Button></>}>
      <div className="space-y-4">
        <Notice tone="info">Corrections go into the working draft{base.status === 'draft' ? ` (${base.label})` : ', which is started from this version'}. They are logged with your name, the time and your reason, and nobody can edit or delete the log. The approved text stays as it is until the CDRRMO Head approves the draft. Saving needs a connection.</Notice>
        {problem && <Notice tone="bad">{problem}</Notice>}
        <Field label="Section" tip="The part of the chapter to correct">{(id) => (
          <Select id={id} value={idx} onChange={(e) => pickSection(Number(e.target.value))}>
            {sections.map((s) => <option key={s.index} value={s.index}>{`${'— '.repeat(Math.max(0, s.level - 1))}${s.title}`}</option>)}
          </Select>)}</Field>
        <ChoiceGroup<CorrectionAction> legend="What to do" value={action} onChange={(v) => { setAction(v); setProblem(null); }} columns={2} options={[
          { value: 'revise', label: 'Revise text', detail: 'Edit the section in place', tip: 'Edit the section text directly' },
          { value: 'add', label: 'Add text', detail: 'Insert a new paragraph', tip: 'Insert a new paragraph in this section' },
          { value: 'delete', label: 'Delete text', detail: 'Remove paragraphs', tip: 'Remove one or more paragraphs from this section' },
          { value: 'figure', label: 'Add or replace a figure', detail: 'Upload an image', tip: 'Upload an image and place it in this section' },
        ]} />

        {action === 'revise' && <Field label="Section text" hint="Markdown: # heading, ## subheading, - list item, **bold**, | table |.">{(id, d) =>
          <Textarea id={id} aria-describedby={d} rows={14} value={revised ?? section.text} onChange={(e) => setRevised(e.target.value)} />}</Field>}

        {action === 'add' && <>
          <Field label="Place it" tip="Where the new paragraph goes in this section">{(id) => (
            <Select id={id} value={after ?? ''} onChange={(e) => setAfter(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">At the end of the section</option>
              <option value={-1}>Right under the heading</option>
              {paras.map((p, i) => <option key={i} value={i}>After: {short(p, 70)}</option>)}
            </Select>)}</Field>
          <Field label="Text to add" hint="One or more paragraphs; leave a blank line between paragraphs.">{(id, d) =>
            <Textarea id={id} aria-describedby={d} rows={6} value={added} onChange={(e) => setAdded(e.target.value)} />}</Field>
        </>}

        {action === 'delete' && <fieldset className="space-y-2"><legend className="font-semibold">Paragraphs to delete</legend>
          {paras.length === 0 ? <p className="text-sm text-muted">This section has no paragraphs under its heading.</p> : paras.map((p, i) => (
            <label key={i} {...tip('Tick to delete this paragraph')} className="flex items-start gap-2 rounded-control border border-line p-2 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={remove.includes(i)} onChange={() => setRemove((r) => (r.includes(i) ? r.filter((x) => x !== i) : [...r, i]))} />
              <span className={remove.includes(i) ? 'text-bad line-through' : ''}>{short(p, 400)}</span>
            </label>))}
        </fieldset>}

        {action === 'figure' && <>
          <Field label="Figure file" hint="PNG, JPEG or WebP, up to 10 MB." tip="Choose the image to place in the chapter">{(id, d) =>
            <input id={id} aria-describedby={d} type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}</Field>
          <Field label="Caption" hint='APA style, for example "Figure 4-2: Warning-to-action flow".'>{(id, d) =>
            <Input id={id} aria-describedby={d} maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} />}</Field>
          <Field label="Place it" tip="Add the figure at the end of the section, or replace a figure already there">{(id) => (
            <Select id={id} value={replace ?? ''} onChange={(e) => setReplace(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">Add at the end of the section</option>
              {paras.map((p, i) => isFigure(p) ? <option key={i} value={i}>Replace: {short(p.replace(/^!\[([^\]]*)\].*$/, '$1') || 'figure', 70)}</option> : null)}
            </Select>)}</Field>
        </>}

        <Field label="Reason" hint="Why this change: the workshop session, review item, source or decision. Required.">{(id, d) =>
          <Textarea id={id} aria-describedby={d} rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <Field label="Review item" optional tip="Link the correction to an open item of the Validation Tracker">{(id) => (
          <Select id={id} value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Not linked</option>
            {reviewItems.map((r) => <option key={r.id} value={r.id}>{r.source_tracker_id}: {short(r.title, 60)}</option>)}
          </Select>)}</Field>
      </div>
    </Sheet>
  );
}

/** The corrections log of one document: newest first, who, when, what, why, and the change paragraph by paragraph. */
export function CorrectionsLog({ documentId }: { documentId: string }) {
  const data = useLiveQuery(async () => {
    const rows = (await db.manual_corrections.where('document_id').equals(documentId).toArray()).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    const people = new Map((await db.profiles.toArray()).map((p) => [p.id, p.full_name]));
    const versions = new Map((await db.moo_versions.where('document_id').equals(documentId).toArray()).map((v) => [v.id, v.label]));
    return { rows, people, versions };
  }, [documentId]);
  if (!data) return null;
  if (!data.rows.length) return <p className="text-sm text-muted">No corrections yet.</p>;
  return (
    <ul className="space-y-2">
      {data.rows.map((c: ManualCorrection) => (
        <li key={c.id} className="rounded-control border border-line p-2 text-sm">
          <details>
            <summary className="cursor-pointer">
              <Badge>{ACTION_LABEL[c.action]}</Badge> <span className="font-semibold text-ink">{short(c.section_title, 50)}</span>
              <span className="block text-xs text-muted">{data.people.get(c.corrected_by ?? '') || 'Unknown user'} · {fmtDateTime(c.created_at)} · {data.versions.get(c.version_id) ?? 'draft'}</span>
              <span className="block text-xs">{short(c.reason, 140)}</span>
            </summary>
            <div className="mt-2 space-y-1">
              {paragraphDiff(c.before_md, c.after_md).filter((p) => p.kind !== 'same').map((p, i) => (
                <p key={i} className={`whitespace-pre-wrap rounded px-2 py-1 text-xs ${p.kind === 'added' ? 'bg-ok-soft' : 'bg-bad-soft line-through'}`}>
                  <span className="sr-only">{p.kind === 'added' ? 'Added: ' : 'Removed: '}</span>{short(p.text, 600)}</p>
              ))}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
