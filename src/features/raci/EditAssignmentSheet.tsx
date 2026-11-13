// Add / edit / remove one RACI assignment (CDRRMO Head or admin only, online — ADR-006, ADR-033).
import { useEffect, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button, ChoiceGroup, Field, Input, Notice } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { NeedsConnectionError } from '@/lib/store';
import type { RaciAssignment, RaciDuty } from '@/types';
import { DUTIES, DUTY_ORDER } from './labels';
import { addRaciAssignment, editRaciAssignment, removeRaciAssignment } from './actions';

export interface AssignmentDraft {
  activity_id: string;
  activityLabel: string;
  /** Present when editing an existing row. */
  row?: RaciAssignment;
}

export function EditAssignmentSheet({ draft, onClose }: { draft: AssignmentDraft | null; onClose: () => void }) {
  const toast = useToast();
  const [actor, setActor] = useState('');
  const [duty, setDuty] = useState<RaciDuty>('R');
  const [qualifier, setQualifier] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setActor(draft?.row?.actor ?? '');
    setDuty(draft?.row?.duty ?? 'R');
    setQualifier(draft?.row?.qualifier ?? '');
  }, [draft]);

  if (!draft) return null;

  const showError = (e: unknown) =>
    toast(e instanceof NeedsConnectionError
      ? 'This change needs a connection. Try again when you are online.'
      : e instanceof Error ? e.message : 'The change was not saved.');

  const save = async () => {
    setBusy(true);
    try {
      if (draft.row) {
        await editRaciAssignment(draft.row, { actor: actor.trim(), duty, qualifier: qualifier.trim() || null });
        toast('Assignment updated.');
      } else {
        await addRaciAssignment({ activity_id: draft.activity_id, actor: actor.trim(), duty, qualifier: qualifier.trim() || null });
        toast('Assignment added.');
      }
      onClose();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!draft.row) return;
    setBusy(true);
    try {
      await removeRaciAssignment(draft.row);
      toast('Assignment removed.');
      onClose();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!draft} onClose={onClose} title={draft.row ? 'Edit assignment' : 'Add assignment'}
      footer={<>
        {draft.row && <Button variant="danger" disabled={busy} onClick={remove} tip="Remove this duty from the activity">Remove</Button>}
        <Button variant="secondary" disabled={busy} onClick={onClose} tip="Close without saving">Cancel</Button>
        <Button variant="primary" busy={busy} disabled={actor.trim().length < 2} onClick={save} tip="Save this RACI assignment (needs a connection)">
          Save
        </Button>
      </>}>
      <p className="text-sm text-muted">Activity: <span className="font-semibold text-ink">{draft.activityLabel}</span></p>
      <Field label="Who holds the duty" hint="A position, office or body — never a person's name." tip="The actor, e.g. EOC Manager / team">
        {(fid) => <Input id={fid} value={actor} onChange={(e) => setActor(e.target.value)} maxLength={120} placeholder="e.g. CDRRMO, EOC Manager / team" />}
      </Field>
      <ChoiceGroup<RaciDuty> legend="Duty" value={duty} onChange={setDuty} columns={2}
        options={DUTY_ORDER.map((d) => ({ value: d, label: `${d} – ${DUTIES[d].label}`, detail: DUTIES[d].definition }))} />
      <Field label="Scope note" optional hint="Copied from the Manual cell, e.g. “documentation”, “within mandate”." tip="An optional qualifier shown under the actor">
        {(fid) => <Input id={fid} value={qualifier} onChange={(e) => setQualifier(e.target.value)} maxLength={200} />}
      </Field>
      <Notice tone="info">There should normally be one Accountable per activity. The board warns when an activity has none or several.</Notice>
    </Sheet>
  );
}
