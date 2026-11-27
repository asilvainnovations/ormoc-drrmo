// Behaviour panels (1.34.0, B = MAP). Each shows the one action this viewer can take now, with what it needs:
// the lead office acknowledges, recommends and gives evidence; the CDRRMO assigns, verifies, records the disposition
// and closes; the CDRRMO Head records the competent authority's decision. Who may act is enforced on the server.
import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { tip } from '@/components/Tooltip';
import { Button, Input, Textarea } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { fmtDateTime } from '@/lib/time';
import {
  NEXT_LABEL, STAGE_LABEL, decisionFollowUp, decisionNextAction, decisionStage, itemFollowUp, itemHistory, itemNextAction,
  itemStage, manilaToday, type FollowUp, type Viewer,
} from '@/domain/bmap';
import type { GovernanceDisposition, ManualReviewItem, OutstandingDecision } from '@/types';
import { acknowledge, assignTasks, closeItem, recordDecision, recordDecisionResponse, recordItemResponse, verifyEvidence } from './actions';
import { Pill, type PillTone } from './kit';

export const FOLLOW_TONE: Record<FollowUp, PillTone> = { done: 'green', blocked: 'red', escalated: 'red', overdue: 'orange', due_soon: 'orange', on_track: 'blue', no_date: 'grey' };
const DISPOSITIONS: GovernanceDisposition[] = ['accepted', 'revised', 'rejected', 'deferred', 'superseded'];
const DISPOSITION_TIP: Record<GovernanceDisposition, string> = {
  accepted: 'The provision stands as drafted', revised: 'The provision is changed as recommended', rejected: 'The recommendation is not taken up',
  deferred: 'Taken up later; closes without evidence', superseded: 'Overtaken by another item or instrument; closes without evidence',
};

function Chips<V extends string>({ label, value, onChange, options }: { label: string; value: V | null; onChange: (v: V) => void; options: { v: V; label: string; tip: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} {...tip(o.tip)}
          className={clsx('min-h-tap rounded-full border px-3 text-sm font-semibold', value === o.v ? 'border-action bg-sky-soft text-ink ring-1 ring-action' : 'border-line bg-surface text-muted hover:border-sky')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function useRun() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); return true; } catch (e) { toast((e as Error).message, 'bad'); return false; } finally { setBusy(false); }
  };
  return { busy, run };
}

function Box({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 rounded-panel border border-line bg-surface p-4">
      <h3 className="font-bold text-ink">{title}</h3>
      {note && <p className="text-xs leading-relaxed text-muted">{note}</p>}
      {children}
    </section>
  );
}

export function StatusLine({ stage, follow }: { stage: keyof typeof STAGE_LABEL; follow: { state: FollowUp; reason: string } }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <Pill tone={stage === 'closed' ? 'green' : 'blue'}>{STAGE_LABEL[stage]}</Pill>
      <Pill tone={FOLLOW_TONE[follow.state]}>{follow.reason}</Pill>
    </p>
  );
}

function AssignBox({ onAssign, busy, current }: { onAssign: (due: string) => void; busy: boolean; current: string | null | undefined }) {
  const [due, setDue] = useState(current ?? '');
  return (
    <Box title={current ? 'Change the response date' : 'Assign and set the response date'} note="Assigning is the prompt: the lead office sees the task, the date and who issued it. The date is agreed with the office, not guessed.">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm font-semibold" {...tip('The date the lead office answers by')}>Response date
          <Input type="date" min={manilaToday()} value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 w-44" /></label>
        <Button tip="Assign the task with this response date" busy={busy} disabled={!due} onClick={() => onAssign(due)}>{current ? 'Change date' : 'Assign'}</Button>
      </div>
    </Box>
  );
}

/** Evidence from the Vault, or a written reference (a signed memo, minutes, an issuance number). */
function EvidenceInput({ value, onChange, vaultId, onVault }: { value: string; onChange: (v: string) => void; vaultId: string; onVault: (v: string) => void }) {
  const docs = useLiveQuery(async () => (await db.vault_documents.toArray()).filter((d) => d.status !== 'superseded').sort((a, b) => a.title.localeCompare(b.title)), [], []);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-sm font-semibold" {...tip('Pick the evidence from the Document Vault, if it is there')}>From the Vault
        <select value={vaultId} onChange={(e) => onVault(e.target.value)} className="mt-1 min-h-tap w-full rounded-control border border-line bg-surface px-3 text-sm">
          <option value="">Not in the Vault</option>
          {docs.map((d) => <option key={d.id} value={d.id}>{d.title.slice(0, 70)}</option>)}
        </select></label>
      <label className="text-sm font-semibold" {...tip('A short reference: issuance number, signed memo, minutes and date')}>Or a reference
        <Input value={value} maxLength={500} onChange={(e) => onChange(e.target.value)} placeholder="e.g. CPDO memo 2026-118, 1 Dec 2026" className="mt-1" /></label>
    </div>
  );
}

// ------------------------------------------------------------------ review items
export function ItemActions({ item, viewer }: { item: ManualReviewItem; viewer: Viewer }) {
  const { busy, run } = useRun();
  const next = itemNextAction(item, viewer);
  const stage = itemStage(item);
  const [rec, setRec] = useState(item.recommendation ?? '');
  const [ev, setEv] = useState('');
  const [vault, setVault] = useState('');
  const [note, setNote] = useState('');
  const [disp, setDisp] = useState<GovernanceDisposition | null>(null);
  const [authRef, setAuthRef] = useState(item.authority_ref ?? '');
  const history = itemHistory(item);

  return (
    <div className="space-y-3">
      <StatusLine stage={stage} follow={itemFollowUp(item)} />
      {(item.recommendation || item.evidence_ref || item.evidence_vault_id) && (
        <dl className="grid gap-2 rounded-panel bg-sunken/50 p-3 text-sm">
          {item.recommendation && <div><dt className="text-xs font-bold text-muted">Recommendation</dt><dd>{item.recommendation}</dd></div>}
          {(item.evidence_ref || item.evidence_vault_id) && <div><dt className="text-xs font-bold text-muted">Evidence</dt><dd>{item.evidence_ref ?? 'Vault entry'}{item.evidence_verified_at ? ' · verified' : ' · not yet verified'}</dd></div>}
          {item.evidence_note && <div><dt className="text-xs font-bold text-muted">Evidence check</dt><dd>{item.evidence_note}</dd></div>}
          {item.authority_ref && <div><dt className="text-xs font-bold text-muted">Authority decision</dt><dd>{item.authority_ref}</dd></div>}
        </dl>
      )}

      {next === 'assign' && <AssignBox current={item.due_date} busy={busy} onAssign={(d) => void run(() => assignTasks([item.id], [], d), `${item.source_tracker_id} assigned, due ${d}`)} />}

      {next === 'acknowledge' && (
        <Box title="Acknowledge the task" note={`Tell the CDRRMO your office has ${item.source_tracker_id} and will answer by ${item.due_date}.`}>
          <Button tip="Confirm your office has the task" busy={busy} onClick={() => void run(() => acknowledge('item', item.id), 'Acknowledged')}>Acknowledge</Button>
        </Box>
      )}

      {(next === 'respond' || next === 'add_evidence' || next === 'acknowledge') && (
        <Box title={next === 'add_evidence' ? 'Add the evidence' : 'Record your recommendation'} note="This is a recommendation, not an approval. The Manual editor records the disposition; the competent authority decides where required.">
          {next !== 'add_evidence' && <label className="block text-sm font-semibold" {...tip('What should happen to the provision, and why')}>Recommendation
            <Textarea rows={3} maxLength={2000} value={rec} onChange={(e) => setRec(e.target.value)} placeholder="Accept, revise (how), reject or defer, with the reason" className="mt-1" /></label>}
          <EvidenceInput value={ev} onChange={setEv} vaultId={vault} onVault={setVault} />
          {item.evidence_expected && <p className="text-xs text-muted">Expected: {item.evidence_expected}</p>}
          <Button tip="Send the recommendation and evidence to the CDRRMO" busy={busy} disabled={next !== 'add_evidence' ? !rec.trim() : !(ev.trim() || vault)}
            onClick={() => void run(() => recordItemResponse(item.id, next !== 'add_evidence' ? rec.trim() : '', ev.trim(), vault || null), 'Response recorded')}>Send</Button>
        </Box>
      )}

      {next === 'verify' && (
        <Box title="Verify the evidence" note={`Check it against: ${item.evidence_expected ?? 'the closure criterion'}. You cannot verify evidence on an item you recommended.`}>
          <Input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="What you checked, or what is missing" />
          <div className="flex flex-wrap gap-2">
            <Button tip="The evidence meets what was expected" busy={busy} onClick={() => void run(() => verifyEvidence(item.id, true, note), 'Evidence verified')}>Evidence is sufficient</Button>
            <Button tip="Return to the lead office with what is missing" variant="secondary" busy={busy} disabled={!note.trim()} onClick={() => void run(() => verifyEvidence(item.id, false, note), 'Returned to the lead office')}>Return for evidence</Button>
          </div>
        </Box>
      )}

      {(next === 'close' || (stage === 'awaiting_authority' && viewer.roles.some((r) => r === 'validator' || r === 'cdrrmo_head' || r === 'admin'))) && (
        <Box title="Record the disposition and close" note={item.closure_criterion ?? 'Close only with the recommendation, verified evidence, the disposition and any required authority decision.'}>
          <Chips label="Disposition" value={disp} onChange={setDisp} options={DISPOSITIONS.map((v) => ({ v, label: v.charAt(0).toUpperCase() + v.slice(1), tip: DISPOSITION_TIP[v] }))} />
          {item.needs_authority && <Input value={authRef} maxLength={300} onChange={(e) => setAuthRef(e.target.value)} placeholder="Authority decision: ordinance, EO, resolution or minutes, and date" {...tip('This item needs the competent authority’s decision before it closes')} />}
          <Button tip="Close the item with this disposition" busy={busy} disabled={!disp || (item.needs_authority && !authRef.trim() && disp !== 'deferred' && disp !== 'superseded')}
            onClick={() => disp && void run(() => closeItem(item, disp, authRef.trim(), ''), `${item.source_tracker_id} closed`)}>Close {item.source_tracker_id}</Button>
        </Box>
      )}

      {next === null && stage !== 'closed' && stage !== 'deferred' && (
        <p className="text-sm text-muted">{itemIsWaitingText(item, viewer)}</p>
      )}

      {history.length > 0 && (
        <ol aria-label="What has happened" className="border-l-2 border-line pl-3 text-xs text-muted">
          {history.map((h) => <li key={h.what} className="py-0.5"><span className="font-data">{fmtDateTime(h.at)}</span> · {h.what}</li>)}
        </ol>
      )}
    </div>
  );
}

function itemIsWaitingText(item: ManualReviewItem, v: Viewer) {
  const s = itemStage(item);
  if (s === 'evidenced' && item.recommended_by === v.id) return 'Waiting for another validator to check the evidence.';
  if (s === 'evidenced') return 'Waiting for a validator to check the evidence.';
  if (s === 'awaiting_authority') return 'Waiting for the competent authority’s decision.';
  return `Waiting on ${item.lead_office ?? 'the lead office'}: ${NEXT_LABEL[s === 'assigned' ? 'acknowledge' : s === 'recommended' ? 'add_evidence' : 'respond'].toLowerCase()}.`;
}

// ------------------------------------------------------------------ decisions
export function DecisionActions({ decision, viewer }: { decision: OutstandingDecision; viewer: Viewer }) {
  const { busy, run } = useRun();
  const next = decisionNextAction(decision, viewer);
  const stage = decisionStage(decision);
  const [resp, setResp] = useState('');
  const [ev, setEv] = useState('');
  const [disp, setDisp] = useState<GovernanceDisposition | null>(null);
  const [ref, setRef] = useState('');
  const [date, setDate] = useState('');
  return (
    <div className="space-y-3">
      <StatusLine stage={stage} follow={decisionFollowUp(decision)} />
      {decision.owner_response && <p className="rounded-panel bg-sunken/50 p-3 text-sm"><b>Owner’s response:</b> {decision.owner_response}{decision.evidence_ref ? ` · Evidence: ${decision.evidence_ref}` : ''}</p>}
      {next === 'assign' && <AssignBox current={decision.target_date} busy={busy} onAssign={(d) => void run(() => assignTasks([], [decision.id], d), `${decision.source_decision_id} assigned, due ${d}`)} />}
      {next === 'acknowledge' && (
        <Box title="Acknowledge the decision task">
          <Button tip="Confirm your office has the decision task" busy={busy} onClick={() => void run(() => acknowledge('decision', decision.id), 'Acknowledged')}>Acknowledge</Button>
        </Box>
      )}
      {next === 'respond' && (
        <Box title="Record your office’s response" note="Your recommendation and its basis. The decision itself is made by the competent authority.">
          <Textarea rows={3} maxLength={2000} value={resp} onChange={(e) => setResp(e.target.value)} placeholder="Recommended decision and its basis" {...tip('Your office’s recommended decision')} />
          <Input value={ev} maxLength={500} onChange={(e) => setEv(e.target.value)} placeholder="Evidence reference (optional)" {...tip('The document that supports it')} />
          <Button tip="Send the response to the CDRRMO" busy={busy} disabled={!resp.trim()} onClick={() => void run(() => recordDecisionResponse(decision.id, resp.trim(), ev.trim()), 'Response recorded')}>Send</Button>
        </Box>
      )}
      {(next === 'record_decision' || (viewer.roles.some((r) => r === 'cdrrmo_head' || r === 'admin') && stage !== 'closed' && stage !== 'deferred' && next !== 'assign')) && (
        <Box title="Record the decision" note={`Only once ${decision.decision_authority_office ?? 'the competent authority'} has decided, with its formal reference.`}>
          <Chips label="Disposition" value={disp} onChange={setDisp} options={DISPOSITIONS.map((v) => ({ v, label: v.charAt(0).toUpperCase() + v.slice(1), tip: DISPOSITION_TIP[v] }))} />
          <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="EO, resolution, memo or minutes number" {...tip('The formal decision reference')} />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} {...tip('Date of the decision (today if left blank)')} />
          </div>
          <Button tip="Record the formal decision" busy={busy} disabled={!disp || !ref.trim()} onClick={() => disp && void run(() => recordDecision(decision, disp, ref.trim(), date), `${decision.source_decision_id} decided`)}>Record decision</Button>
        </Box>
      )}
    </div>
  );
}
