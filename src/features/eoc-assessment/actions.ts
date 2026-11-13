// Authority edits of the EOC capability assessment (ADR-035, ADR-006): recording evidence, gap,
// recommended action and tool links, and validating a run. These go straight to the server with
// the row's version, never the outbox; a stale screen gets PT409 ("Someone changed this record…").
// The local copy follows the server answer.
import { updateOnline } from '@/lib/store';
import type { EocAssessmentResponse, EocAssessmentRun } from '@/types';

/** Save the editable columns of one checklist response. Status is never edited here: it derives
 *  from the mapped IAT B_EOC scores (app.eoc_assessment_status), so scoring stays in Assess. */
export async function saveResponse(
  row: EocAssessmentResponse,
  patch: Partial<Pick<EocAssessmentResponse, 'evidence' | 'gap' | 'recommended_action' | 'tool_links'>>,
): Promise<EocAssessmentResponse> {
  return updateOnline<EocAssessmentResponse>('eoc_assessment_responses', row, patch, 'Update the checklist response');
}

/** Validate a run (CDRRMO Head or admin only — the SQL guard refuses anyone else and stamps
 *  validated_by / validated_at). A validated run and its responses are locked for the record. */
export async function validateRun(run: EocAssessmentRun): Promise<EocAssessmentRun> {
  return updateOnline<EocAssessmentRun>('eoc_assessment_runs', run, { status: 'validated' }, 'Validate the capability run');
}
