// Validation actions (1.34.0, B = MAP). Each one is online-only and stamped by the server with who and when, so a
// recommendation, an evidence check or an assignment cannot be made up offline or recorded for someone else.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { callOnline, updateOnline } from '@/lib/store';
import { pull } from '@/lib/sync';
import type { Viewer } from '@/domain/bmap';
import type { GovernanceDisposition, ManualReviewItem, OutstandingDecision } from '@/types';

const refresh = () => pull(['manual_review_items', 'outstanding_decisions'], true);

/** Who is looking: their id, office code and roles. */
export function useViewer(): Viewer {
  const { userId, roles, profile } = useAuth();
  const officeCode = useLiveQuery(async () => (profile?.office_id ? (await db.offices.get(profile.office_id))?.code ?? null : null), [profile?.office_id], null);
  return { id: userId, officeCode: officeCode ?? null, roles };
}

export async function acknowledge(kind: 'item' | 'decision', id: string) {
  await callOnline('acknowledge_validation_task', { p_kind: kind, p_id: id }, 'Acknowledging the task');
  await refresh();
}
export async function recordItemResponse(id: string, recommendation: string, evidenceRef: string, vaultId: string | null) {
  await callOnline('record_review_response', {
    p_item: id, p_recommendation: recommendation || null, p_evidence_ref: evidenceRef || null, p_evidence_vault_id: vaultId || null,
  }, 'Recording the response');
  await refresh();
}
export async function recordDecisionResponse(id: string, response: string, evidenceRef: string) {
  await callOnline('record_decision_response', { p_decision: id, p_response: response, p_evidence_ref: evidenceRef || null }, 'Recording the response');
  await refresh();
}
export async function verifyEvidence(id: string, accepted: boolean, note: string) {
  await callOnline('verify_review_evidence', { p_item: id, p_accepted: accepted, p_note: note || null }, 'Checking the evidence');
  await refresh();
}
export async function assignTasks(items: string[], decisions: string[], due: string): Promise<number> {
  const n = await callOnline<number>('assign_validation_tasks', { p_items: items, p_decisions: decisions, p_due: due }, 'Assigning');
  await refresh();
  return n;
}
export async function closeItem(item: ManualReviewItem, disposition: GovernanceDisposition, authorityRef: string, notes: string) {
  await updateOnline('manual_review_items', item, {
    review_status: 'closed', disposition, validation_status: disposition === 'rejected' ? 'rejected' : 'validated',
    ...(authorityRef ? { authority_ref: authorityRef } : {}), ...(notes ? { notes } : {}),
  }, 'Closing the item');
}
export async function recordDecision(d: OutstandingDecision, disposition: GovernanceDisposition, reference: string, date: string) {
  await updateOnline('outstanding_decisions', d, {
    decision_status: 'decided', disposition, decision_reference: reference, ...(date ? { decision_date: date } : {}),
  }, 'Recording the decision');
}
