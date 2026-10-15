import type { CycleStatus, EvidenceKind, Response } from '@/types';

export const CYCLE_STATUS: Record<CycleStatus, string> = {
  draft: 'Draft', fieldwork: 'Fieldwork', validation: 'Validation', final: 'Final', archived: 'Archived',
};
export const CYCLE_NEXT: Partial<Record<CycleStatus, CycleStatus>> = { draft: 'fieldwork', fieldwork: 'validation', validation: 'final' };
export const CYCLE_NEXT_LABEL: Partial<Record<CycleStatus, string>> = { draft: 'Start fieldwork', fieldwork: 'Open validation', validation: 'Finalize results' };

export const RESPONSE_STATUS: Record<Response['status'], string> = { draft: 'Draft', provisional: 'Provisional', validated: 'Validated' };

export const EVIDENCE_KIND: Record<EvidenceKind, string> = {
  document: 'Document', observation: 'Site observation', interview: 'Key informant interview', fgd: 'Focus group discussion',
  test: 'Live test or exercise', photo: 'Photo',
};
