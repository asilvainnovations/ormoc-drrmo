import type { CycleStatus, EvidenceCheck, EvidenceKind, Response } from '@/types';

export const CYCLE_STATUS: Record<CycleStatus, string> = {
  draft: 'Draft', fieldwork: 'Fieldwork', validation: 'Validation', final: 'Final', archived: 'Archived',
};
export const CYCLE_NEXT: Partial<Record<CycleStatus, CycleStatus>> = { draft: 'fieldwork', fieldwork: 'validation', validation: 'final' };
export const CYCLE_NEXT_LABEL: Partial<Record<CycleStatus, string>> = { draft: 'Start fieldwork', fieldwork: 'Open validation', validation: 'Finalize results' };

export const RESPONSE_STATUS: Record<Response['status'], string> = { draft: 'Draft', provisional: 'For validation', validated: 'Validated' };
/** Same colour code as the Library and Workflows (components/StatusBadge.tsx): draft ochre, for validation blue, validated green. */
export const RESPONSE_TONE: Record<Response['status'], 'warn' | 'info' | 'ok'> = { draft: 'warn', provisional: 'info', validated: 'ok' };

export const EVIDENCE_KIND: Record<EvidenceKind, string> = {
  document: 'Document', observation: 'Site observation', interview: 'Key informant interview', fgd: 'Focus group discussion',
  test: 'Live test or exercise', photo: 'Photo',
};

/** IAT v1-6 Evidence Validation Status. "Verified" does not by itself change the score. */
export const EVIDENCE_CHECK: Record<EvidenceCheck, string> = {
  pending: 'Pending validation', verified: 'Verified', partially_verified: 'Partially verified',
  unverified: 'Unverified', missing: 'Missing evidence',
};
export const EVIDENCE_CHECK_HELP: Record<EvidenceCheck, string> = {
  pending: 'Not yet checked against the source record.',
  verified: 'The cited record was checked and supports the indicator.',
  partially_verified: 'The record supports part of the indicator.',
  unverified: 'The record was checked but does not support the indicator.',
  missing: 'The cited record could not be found.',
};
export const EVIDENCE_CHECK_TONE: Record<EvidenceCheck, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  pending: 'neutral', verified: 'ok', partially_verified: 'warn', unverified: 'bad', missing: 'bad',
};
