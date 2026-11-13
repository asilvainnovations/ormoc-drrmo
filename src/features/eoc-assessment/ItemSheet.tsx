// One checklist item: its status, evidence, gap, recommended action and tool links (ADR-035).
// The assessment team edits the text and links online; the CDRRMO Head's validated run locks them.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Plus, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Badge, Button, Field, Textarea, Input } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import { NeedsConnectionError } from '@/lib/store';
import type { EocAssessmentItem, EocAssessmentResponse, EocAssessmentToolLink } from '@/types';
import { STATUS, TOOL_LINK_HINT } from './labels';
import { saveResponse } from './actions';

export interface ItemDraft {
  item: EocAssessmentItem;
  response: EocAssessmentResponse;
}

export function ItemSheet({ draft, canEdit, onClose }: { draft: ItemDraft | null; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const [evidence, setEvidence] = useState('');
  const [gap, setGap] = useState('');
  const [action, setAction] = useState('');
  const [links, setLinks] = useState<EocAssessmentToolLink[]>([]);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEvidence(draft?.response.evidence ?? '');
    setGap(draft?.response.gap ?? '');
    setAction(draft?.response.recommended_action ?? '');
    setLinks(draft?.response.tool_links ?? []);
    setCode('');
    setTitle('');
  }, [draft]);

  if (!draft) return null;
  const { item, response } = draft;
  const status = STATUS[response.status];

  const dirty = evidence !== (response.evidence ?? '') || gap !== (response.gap ?? '')
    || action !== (response.recommended_action ?? '')
    || JSON.stringify(links) !== JSON.stringify(response.tool_links ?? []);

  const showError = (e: unknown) =>
    toast(e instanceof NeedsConnectionError
      ? 'This change needs a connection. Try again when you are online.'
      : e instanceof Error ? e.message : 'The change was not saved.');

  const addLink = () => {
    const c = code.trim();
    const t = title.trim();
    if (!c || !t) return;
    if (links.some((l) => l.code === c)) { toast(`"${c}" is already linked.`); return; }
    setLinks([...links, { code: c, title: t }]);
    setCode('');
    setTitle('');
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveResponse(response, {
        evidence: evidence.trim() || null,
        gap: gap.trim() || null,
        recommended_action: action.trim() || null,
        tool_links: links,
      });
      toast('Response updated.');
      onClose();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!draft} onClose={onClose} title={`Item ${item.item_no} — ${item.section}`}
      footer={canEdit ? <>
        <Button variant="secondary" disabled={busy} onClick={onClose} tip="Close without saving">Cancel</Button>
        <Button variant="primary" busy={busy} disabled={!dirty} onClick={save} tip="Save this checklist response (needs a connection)">Save</Button>
      </> : undefined}>
      <p className="font-semibold">{item.item_text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span {...tip(status.definition)} className={`inline-flex items-center rounded-full px-2 py-0.5 font-data text-[0.8125rem] font-semibold leading-5 tracking-wide ${status.chip}`}>
          {status.label}
        </span>
        {item.iat_links.length > 0
          ? item.iat_links.map((l) => <Badge key={l} tone="info">{l}</Badge>)
          : <Badge tone="neutral">No IAT link</Badge>}
        {item.applies_primary && <Badge tone="neutral">Primary EOC</Badge>}
        {item.applies_alternate && <Badge tone="neutral">Alternate EOC</Badge>}
      </div>

      {canEdit ? (<>
        <Field label="Evidence observed" optional tip="What the assessor saw, read or heard (workbook column, verbatim)">
          {(fid) => <Textarea id={fid} rows={5} value={evidence} onChange={(e) => setEvidence(e.target.value)} />}
        </Field>
        <Field label="Gap / remarks" optional tip="What is missing or provisional">
          {(fid) => <Textarea id={fid} rows={4} value={gap} onChange={(e) => setGap(e.target.value)} />}
        </Field>
        <Field label="Recommended action" optional tip="What closes the gap">
          {(fid) => <Textarea id={fid} rows={4} value={action} onChange={(e) => setAction(e.target.value)} />}
        </Field>
        <Field label="Linked tools" optional hint={TOOL_LINK_HINT} tip="SOP, Protocol, Workflow or Form records that close the gap">
          {() => (
            <div className="space-y-2">
              {links.length > 0 && (
                <ul className="space-y-1">
                  {links.map((l) => (
                    <li key={l.code} className="flex items-center gap-2 rounded-control border border-line px-2 py-1.5">
                      <ListChecks className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                      <span className="min-w-0 flex-1 text-sm"><span className="font-semibold">{l.code}</span> — {l.title}</span>
                      <button type="button" onClick={() => setLinks(links.filter((x) => x.code !== l.code))} {...tip(`Remove the link to ${l.code}`)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-control hover:bg-sunken" aria-label={`Remove ${l.code}`}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (e.g. PR-EOC-ACTIVATE)" aria-label="Tool code" className="w-48" />
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Tool title" className="min-w-40 flex-1" />
                <Button variant="secondary" icon={Plus} onClick={addLink} disabled={!code.trim() || !title.trim()} tip="Add this tool link" aria-label="Add tool link">Add</Button>
              </div>
            </div>
          )}
        </Field>
      </>) : (<>
        {[
          ['Evidence observed', response.evidence],
          ['Gap / remarks', response.gap],
          ['Recommended action', response.recommended_action],
        ].map(([label, text]) => (
          <div key={label as string}>
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6">{(text as string | null) ?? '—'}</p>
          </div>
        ))}
        {links.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-muted">Linked tools</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {links.map((l) => <Badge key={l.code} tone="info">{l.code} — {l.title}</Badge>)}
            </div>
          </div>
        )}
      </>)}
      <p className="text-sm text-muted">
        The status derives from the mapped IAT scores — change it in <Link to="/assess" {...tip('Open the institutional assessment')} className="font-semibold text-info underline">Assess</Link>, never here.
      </p>
    </Sheet>
  );
}
