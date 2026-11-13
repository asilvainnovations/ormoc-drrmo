// Save a Tool run as a server-side training record and file it as IAT evidence (1.21.0, ADR-037).
// Positions and counts ONLY in counts — never personal names (RA 10173). Saving the record and
// filing it are authority actions (ADR-006): they go online only. Filing adds an evidence row
// (kind 'test') through the normal evidence flow; it never touches the score itself.
import { insertOnline, save, saveMany, updateOnline } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { db } from '@/lib/db';
import type { Evidence, EvidenceStrength, Response, TrainingRun, TrainingTool } from '@/types';

export const TOOL_LABEL: Record<TrainingTool, string> = {
  ics_tool: 'ICS exercise simulator',
  echo_simulator: 'ECHO simulator',
  pscp: 'PSCP workbench',
  gk: 'Gawad KALASAG self-check',
};

/** The indicators a Tool run can support (the assessment of 14 Nov 2026). */
export const EVIDENCE_INDICATORS = ['B7.2', 'B7.3', 'B7.4', 'B2.7'] as const;

export type RunCounts = TrainingRun['counts'];

export async function saveRunRecord(input: { tool: TrainingTool; title: string; run_at: string; summary: string; counts: RunCounts }): Promise<TrainingRun> {
  const row: TrainingRun = {
    id: uuid(), tool: input.tool, title: input.title, run_at: input.run_at, summary: input.summary, counts: input.counts,
    filed_evidence: false, filed_to_indicator: null, filed_by: null, filed_at: null, created_by: null, version: 1,
  };
  return insertOnline<TrainingRun>('training_runs', row, 'Save the run record');
}

/** File a saved run as evidence on an indicator of the latest assessment cycle. The response is
 *  opened if the cycle does not have one yet, exactly like the Assess evidence sheet. */
export async function fileAsEvidence(run: TrainingRun, indicatorId: string, strength: EvidenceStrength): Promise<string> {
  const cycles = (await db.assessment_cycles.toArray())
    .filter((c) => c.status !== 'archived')
    .sort((a, b) => b.cycle_year - a.cycle_year || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const cycle = cycles[0];
  if (!cycle) throw new Error('No assessment cycle on this device yet. Open Assess once, online, then file again.');
  let resp = (await db.responses.where('cycle_id').equals(cycle.id).toArray()).find((r) => r.indicator_id === indicatorId);
  if (!resp) {
    resp = { _new: true, id: uuid(), cycle_id: cycle.id, indicator_id: indicatorId, score: null, is_na: false, na_justification: null,
      gap_remarks: null, recommended_action: null, status: 'draft', evidence_check: 'pending', version: 1 } as Response & { _new: true };
    await saveMany([{ table: 'responses', row: resp, label: `Open ${indicatorId}` }]);
  }
  const ev: Evidence & { _new: true } = {
    _new: true, id: uuid(), response_id: resp.id, kind: 'test', strength, title: run.title,
    doc_date: run.run_at.slice(0, 10), source: TOOL_LABEL[run.tool], storage_path: null, note: run.summary,
    training_run_id: run.id, version: 1,
  };
  await save('evidence', ev, `Evidence for ${indicatorId}: ${run.title}`);
  await updateOnline<TrainingRun>('training_runs', run, { filed_evidence: true, filed_to_indicator: indicatorId }, 'File the run as evidence');
  return cycle.name;
}
