/** ADR-043 Manual Review and Validation Workspace (1.23.0 Slice 1). Merge into src/types.ts. */

export type GovernancePriority = 'critical_urgent' | 'important' | 'standard';

export type ReviewStatus =
  | 'open'
  | 'in_review'
  | 'pending_evidence'
  | 'pending_decision'
  | 'closed'
  | 'deferred';

export type ValidationStatus = 'not_started' | 'in_progress' | 'validated' | 'rejected';

export type DecisionStatus =
  | 'for_decision'
  | 'in_progress'
  | 'decided'
  | 'deferred'
  | 'withdrawn';

export type WorkshopStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export type AuthorityStatus = 'confirmed' | 'to_be_confirmed';

export type GovernanceDisposition =
  | 'accepted'
  | 'revised'
  | 'rejected'
  | 'deferred'
  | 'superseded';

export interface ManualGovernanceStakeholder {
  id: string;
  source_key: string;
  institution: string;
  role_in_validation: string | null;
  responsibility: string | null;
  relevant_chapters: string | null;
  criticality: GovernancePriority;
  designation_status: string | null;
  source_workbook?: string | null;
  source_sheet?: string | null;
  import_batch_id?: string | null;
  created_at?: string;
  updated_at?: string;
  version: number;
}

export interface ManualReviewItem {
  id: string;
  source_tracker_id: string;
  title: string;
  description: string | null;
  chapter_ref: string | null;
  section_ref: string | null;
  source_register: string | null;
  source_used: string | null;
  required_action: string | null;
  priority: GovernancePriority;
  priority_raw: string | null;
  review_status: ReviewStatus;
  validation_status: ValidationStatus;
  lead_office: string | null;
  lead_position: string | null;
  workshop_slot: string | null;
  closure_test: string | null;
  disposition: GovernanceDisposition | null;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  source_workbook?: string | null;
  source_sheet?: string | null;
  source_row?: number | null;
  import_batch_id?: string | null;
  status_raw?: string | null;
  created_at?: string;
  updated_at?: string;
  version: number;
}

export interface OutstandingDecision {
  id: string;
  source_decision_id: string;
  question: string;
  domain: string | null;
  priority: GovernancePriority;
  priority_raw: string | null;
  accountable_owner_office: string;
  accountable_owner_position: string | null;
  decision_authority_office: string | null;
  decision_authority_position: string | null;
  authority_status: AuthorityStatus;
  supporting_validators: string | null;
  manual_coverage: string | null;
  evidence_required: string | null;
  decision_status: DecisionStatus;
  target_date: string | null;
  target_workshop: string | null;
  decision_reference: string | null;
  decision_date: string | null;
  disposition: GovernanceDisposition | null;
  decided_by: string | null;
  source_workbook?: string | null;
  source_sheet?: string | null;
  source_row?: number | null;
  import_batch_id?: string | null;
  status_raw?: string | null;
  created_at?: string;
  updated_at?: string;
  version: number;
}

export interface WorkshopSession {
  id: string;
  source_session_key: string;
  session_number: number;
  title: string;
  purpose: string | null;
  manual_coverage: string | null;
  key_questions: string | null;
  expected_output: string | null;
  lead_office: string | null;
  scheduled_date: string | null;
  scheduled_date_raw: string | null;
  status: WorkshopStatus;
  outcome_summary: string | null;
  source_workbook?: string | null;
  source_sheet?: string | null;
  import_batch_id?: string | null;
  created_at?: string;
  updated_at?: string;
  version: number;
}

export interface ManualGovernanceImportBatch {
  id: string;
  source_workbook: string;
  source_date: string | null;
  imported_at: string;
  imported_by: string | null;
  reviews_inserted: number;
  reviews_unchanged: number;
  decisions_inserted: number;
  decisions_unchanged: number;
  sessions_inserted: number;
  sessions_unchanged: number;
  stakeholders_inserted: number;
  stakeholders_unchanged: number;
  notes: string | null;
}
