// One checklist item: its status, evidence, gap, recommended action and tool links (ADR-035).
// The assessment team records or confirms the answer online; saving makes a pre-filled answer observed.
// The CDRRMO Head validates or reopens an observed answer; a validated run locks them all.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Badge, Button, ChoiceGroup, Field, Notice, Textarea, Input } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import { NeedsConnectionError } from '@/lib/store';
import type { EocAssessmentItem, EocAssessmentResponse, EocAssessmentSite, EocAssessmentStatus, EocAssessmentToolLink } from '@/types';
import { OBSERVED_STATUSES } from '@/domain/eoc_assessment';
import { SITE_LABEL, STATUS, TOOL_LINK_HINT } from './labels';
import { createResponse, saveResponse, setResponseState } from './actions';

export interface ItemDraft {
  item: EocAssessmentItem;
  /** Undefined when this site has no answer yet (e.g. the alternate EOC). */
  response?: EocAssessmentResponse;
  runId: string;
  site: EocAssessmentSite;
}

export function ItemSheet({ draft, canEdit, canValidate, onClose }: { draft: ItemDraft | null; canEdit: boolean; canValidate: boolean; onClose: () => void }) {
  const toast = useToast();
  const [statusV, setStatusV] = useState<EocAssessmentStatus>('not_assessed');
  const [evidence, setEvidence] = useState('');
  const [gap, setGap] = useState('');
  const [action, setAction] = useState('');
  const [links, setLinks] = useState<EocAssessmentToolLink[]>([]);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const st = draft?.response?.status;
    setStatusV(st && st !== 'no_direct_indicator' ? st : 'not_assessed');
    setEvidence(draft?.response?.evidence ?? '');
    setGap(draft?.response?.gap ?? '');
    setAction(draft?.response?.recommended_action ?? '');
    setLinks(draft?.response?.tool_links ?? []);
    setCode('');
    setTitle('');
  }, [draft]);

  if (!draft) return null;
  const { item, response, runId, site } = draft;
  const status = STATUS[response?.status ?? 'not_assessed'];
  const prefilled = response?.provenance === 'prefilled_iat';
  const validated = response?.state === 'validated';
  const editable = canEdit && !validated;

  const dirty = !response || prefilled || statusV !== response.status || evidence !== (response.evidence ?? '') || gap !== (response.gap ?? '')
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
    if (statusV === 'not_applicable' && !gap.trim()) { toast('Give the reason it does not apply in Gap / remarks.'); return; }
    setBusy(true);
    const values = { status: statusV, evidence: evidence.trim() || null, gap: gap.trim() || null,
      recommended_action: action.trim() || null, tool_links: links };
    try {
      if (response) await saveResponse(response, values); else await createResponse(runId, item.id, site, values);
      toast(prefilled ? 'Answer confirmed on site.' : 'Answer saved.');
      onClose();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };
  const changeState = async (state: 'validated' | 'draft') => {
    if (!response) return;
    setBusy(true);
    try {
      await setResponseState(response, state);
      toast(state === 'validated' ? 'Answer validated.' : 'Answer reopened.');
      onClose();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!draft} onClose={onClose} title={`Item ${item.item_no} — ${item.section}`}
      footer={(editable || canValidate) ? <>
        <Button variant="secondary" disabled={busy} onClick={onClose} tip="Close without saving">Cancel</Button>
        {canValidate && response && !validated && (
          <Button variant="secondary" icon={ShieldCheck} busy={busy} disabled={prefilled} onClick={() => changeState('validated')}
            tip={prefilled ? 'Confirm this pre-filled answer on site first: only observed answers can be validated' : 'Validate this answer (CDRRMO Head; needs a connection)'}>Validate</Button>
        )}
        {canValidate && validated && (
          <Button variant="secondary" icon={RotateCcw} busy={busy} onClick={() => changeState('draft')}
            tip="Reopen this answer so the team can change it (CDRRMO Head; needs a connection)">Reopen</Button>
        )}
        {editable && (
          <Button variant="primary" busy={busy} disabled={!dirty} onClick={save}
            tip={prefilled ? 'Confirm this answer as observed on site, with any changes (needs a connection)' : 'Save this answer (needs a connection)'}>
            {prefilled ? 'Confirm' : 'Save'}
          </Button>
        )}
      </> : undefined}>
      <p className="font-semibold">{item.item_text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span {...tip(status.definition)} className={`inline-flex items-center rounded-full px-2 py-0.5 font-data text-[0.8125rem] font-semibold leading-5 tracking-wide ${status.chip}`}>
          {status.label}
        </span>
        {item.iat_links.length > 0
          ? item.iat_links.map((l) => <Badge key={l} tone="info">{l}</Badge>)
          : <Badge tone="neutral">No IAT link</Badge>}
        <Badge tone="neutral">{SITE_LABEL[site]}</Badge>
        {validated && <Badge tone="ok">Validated</Badge>}
      </div>
      {prefilled && (
        <Notice tone="warn" title="Pre-filled from IAT v1-7, not observed">
          The status and text were copied from the IAT crosswalk (the weakest mapped indicator score). Check them on site, change what differs, and confirm.
        </Notice>
      )}
      {validated && <Notice tone="ok" title="Validated">Validated by the CDRRMO Head. Ask the Head to reopen it to make changes.</Notice>}

      {editable ? (<>
        <ChoiceGroup legend="Status on site" value={statusV} onChange={setStatusV} columns={2}
          options={OBSERVED_STATUSES.map((st) => ({ value: st, label: STATUS[st].label, tip: `Mark this item ${STATUS[st].label.toLowerCase()} for the ${SITE_LABEL[site].toLowerCase()}` }))} />
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
          ['Evidence observed', response?.evidence ?? null],
          ['Gap / remarks', response?.gap ?? null],
          ['Recommended action', response?.recommended_action ?? null],
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
        This checklist does not change any IAT score: scores stay in <Link to="/assess" {...tip('Open the institutional assessment')} className="font-semibold text-info underline">Assess</Link>.
        Record positions and offices only, never personal names.
      </p>
    </Sheet>
  );
}
