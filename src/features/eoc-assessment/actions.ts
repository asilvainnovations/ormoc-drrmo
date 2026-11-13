// Authority edits of the EOC capability assessment (ADR-035, ADR-006): recording evidence, gap,
// recommended action and tool links, and validating a run. These go straight to the server with
// the row's version, never the outbox; a stale screen gets PT409 ("Someone changed this record…").
// The local copy follows the server answer.
import { insertOnline, updateOnline } from '@/lib/store';
import { uuid } from '@/lib/ids';
import type { EocAssessmentResponse, EocAssessmentRun, EocAssessmentSite } from '@/types';

type Editable = Pick<EocAssessmentResponse, 'status' | 'evidence' | 'gap' | 'recommended_action' | 'tool_links'>;

/** Save (or confirm) one checklist answer. The server marks it observed: a pre-filled answer becomes
 *  a finding only when a person saves it (review fix, ADR-035). */
export async function saveResponse(row: EocAssessmentResponse, patch: Partial<Editable>): Promise<EocAssessmentResponse> {
  return updateOnline<EocAssessmentResponse>('eoc_assessment_responses', row, patch, 'Update the checklist answer');
}

/** Record a first answer for an item at a site (e.g. the alternate EOC once one is designated). */
export async function createResponse(runId: string, itemId: string, site: EocAssessmentSite, values: Editable): Promise<EocAssessmentResponse> {
  return insertOnline<EocAssessmentResponse>('eoc_assessment_responses',
    { id: uuid(), run_id: runId, item_id: itemId, site, ...values } as EocAssessmentResponse, 'Record the checklist answer');
}

/** Validate or reopen one observed answer (CDRRMO Head or admin; the SQL guard refuses anyone else,
 *  and refuses to validate an answer that is still pre-filled). */
export async function setResponseState(row: EocAssessmentResponse, state: 'validated' | 'draft'): Promise<EocAssessmentResponse> {
  return updateOnline<EocAssessmentResponse>('eoc_assessment_responses', row, { state },
    state === 'validated' ? 'Validate the checklist answer' : 'Reopen the checklist answer');
}

/** Validate a run (CDRRMO Head or admin only — the SQL guard refuses anyone else and stamps
 *  validated_by / validated_at). A validated run and its responses are locked for the record. */
export async function validateRun(run: EocAssessmentRun): Promise<EocAssessmentRun> {
  return updateOnline<EocAssessmentRun>('eoc_assessment_runs', run, { status: 'validated' }, 'Validate the capability run');
}
