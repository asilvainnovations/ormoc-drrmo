// Row types mirror the Supabase schema (supabase/migrations). Timestamps are ISO strings.

export type Role =
  | 'admin' | 'cdrrmo_head' | 'assessor' | 'validator' | 'eoc_manager' | 'eoc_staff'
  | 'duty_officer' | 'lead_office_focal' | 'author' | 'viewer';

export interface Versioned { id: string; version: number; created_at?: string; updated_at?: string }

// ------------------------------------------------------------------ reference
export interface Part { code: 'A' | 'B' | 'C'; name: string; in_imi: boolean; sort: number }
export interface Domain { code: string; part: 'A' | 'B' | 'C'; name: string; scope: string; functional_area: string; platform_module: string; sort: number }
export interface Indicator {
  id: string; domain: string; statement: string; reference: string; type: 'M' | 'GP'; weight: 1 | 2 | 3;
  means_of_verification: string | null; methods: string | null; moo_chapter: string | null;
  lead_office: string | null; tags: string[]; version_status: string; sort: number;
}
export interface MasterRequirement {
  id: string; title: string; statement: string; source_basis: string; iat_coverage: string; evidence: string;
  sa_output: string; moo_output: string; platform_req: string; data_entities: string; escalation_rule: string | null;
  priority: 'Critical' | 'High' | 'Medium' | 'Low'; sort: number;
}
export interface IndicatorRequirement { indicator_id: string; mr_id: string }
export interface Office { id: string; code: string; name: string; kind: string; version?: number }
export interface IndicatorLeadOffice { indicator_id: string; office_id: string }
export interface Crosswalk { framework: 'UNDRR DRSC' | 'RA 12287 IRR'; ref: string; subject: string; treatment: string; indicators: string | null; note: string | null; sort: number }
export interface Hazard { code: string; name: string; forecastable: boolean; typical_lead_hours: number | null; declaration_eligible: boolean; note: string | null; sort: number }

// ------------------------------------------------------------------ IAT
export type CycleStatus = 'draft' | 'fieldwork' | 'validation' | 'final' | 'archived';
export interface Cycle extends Versioned { name: string; cycle_year: number; iat_version: string; status: CycleStatus; period_from: string | null; period_to: string | null; notes: string | null }
export type EvidenceStrength = 'verbal' | 'partial' | 'approved_in_use' | 'tested_improved';
export type EvidenceKind = 'document' | 'observation' | 'interview' | 'fgd' | 'test' | 'photo';
export interface Response extends Versioned {
  cycle_id: string; indicator_id: string; score: number | null; is_na: boolean; na_justification: string | null;
  gap_remarks: string | null; recommended_action: string | null; status: 'draft' | 'provisional' | 'validated';
  assessed_by?: string | null; validated_by?: string | null; validated_at?: string | null;
}
export interface Evidence extends Versioned {
  response_id: string; kind: EvidenceKind; strength: EvidenceStrength; title: string; doc_date: string | null;
  source: string | null; storage_path: string | null; note: string | null;
}
export interface Action extends Versioned {
  cycle_id: string; indicator_id: string; action: string; responsible_office_id: string | null; responsible_person: string | null;
  target_date: string | null; budget_source: string | null; status: 'not_started' | 'ongoing' | 'done' | 'dropped';
}

// ------------------------------------------------------------------ Library & protocols
export interface MooDocument extends Versioned {
  manual: 'MOO' | 'EOC'; kind: 'chapter' | 'sop' | 'form' | 'annex'; code: string; title: string; parent_id?: string | null;
  summary: string | null; status: 'draft' | 'in_review' | 'approved' | 'superseded'; current_version_id: string | null; sort: number;
}
export interface MooVersion extends Versioned {
  document_id: string; label: string; body_md: string; change_note: string | null;
  status: 'draft' | 'in_review' | 'approved' | 'rejected'; author?: string | null; approved_by?: string | null; approved_at?: string | null; review_note?: string | null;
}
export interface MooDocumentIndicator { document_id: string; indicator_id: string }
export type ProtocolCategory = 'daily_operations' | 'warning' | 'eoc' | 'anticipatory_action' | 'council' | 'reporting' | 'recovery';
export interface ProtocolTemplate extends Versioned {
  code: string; title: string; purpose: string | null; trigger_text: string | null; document_id: string | null;
  owner_role: Role; category: ProtocolCategory; status: 'draft' | 'approved' | 'retired'; template_rev: number;
}
export interface ProtocolStep extends Versioned {
  template_id: string; seq: number; instruction: string; is_critical: boolean; requires_note: boolean; due_offset_minutes: number | null;
}
export interface ProtocolRun extends Versioned {
  template_id: string; template_rev: number; title: string; context_type: string | null; context_id: string | null;
  status: 'running' | 'completed' | 'aborted'; started_by?: string | null; started_at: string; completed_at: string | null; abort_reason: string | null;
}
export type StepStatus = 'pending' | 'done' | 'skipped' | 'not_applicable';
export interface ProtocolRunStep extends Versioned {
  run_id: string; step_id: string; seq: number; instruction: string; is_critical: boolean; requires_note: boolean;
  due_at: string | null; status: StepStatus; done_by: string | null; done_at: string | null; note: string | null;
}

// ------------------------------------------------------------------ EOC
export type EocLevel = 'white' | 'blue' | 'red';
export interface Activation extends Versioned {
  level: EocLevel; reason: string; hazard_code: string | null; authority_ref: string | null;
  started_by?: string | null; started_at: string; ended_at: string | null;
}
export type LogCategory = 'general' | 'decision' | 'warning' | 'request' | 'resource' | 'report' | 'level_change' | 'correction';
export interface LogEntry { id: string; activation_id: string | null; incident_id?: string | null; occurred_at: string; category: LogCategory; entry: string; corrects_id: string | null; author: string | null; created_at: string }
export interface Sitrep extends Versioned {
  activation_id: string | null; incident_id?: string | null; seq: number | null; period_start: string; period_end: string;
  status: 'draft' | 'submitted' | 'approved'; situation: string | null; actions_taken: string | null; needs: string | null;
  affected_families: number | null; affected_persons: number | null; evacuated_families: number | null; evacuated_persons: number | null;
  dead: number | null; injured: number | null; missing: number | null; submitted_at: string | null; approved_at: string | null;
}
export interface Barangay { psgc: string; name: string; classification: string[]; population: number | null; lat: number | null; lng: number | null; version?: number }
export type BarangayCondition = 'normal' | 'monitoring' | 'affected' | 'isolated' | 'evacuating';
export interface BarangayReport {
  id: string; barangay_psgc: string; activation_id: string | null; reported_at: string; condition: BarangayCondition;
  families_evacuated: number; persons_evacuated: number; remarks: string | null; channel: string | null; reported_by?: string | null; created_at: string;
}
export type RequestStatus = 'requested' | 'approved' | 'mobilized' | 'delivered' | 'demobilized' | 'rejected';
export interface ResourceRequest extends Versioned {
  activation_id: string | null; requesting_party: string; item: string; quantity: number; unit: string;
  priority: 'life_safety' | 'urgent' | 'routine'; needed_by: string | null; status: RequestStatus; decision_note: string | null;
  requested_at: string; approved_at: string | null; mobilized_at: string | null; delivered_at: string | null; demobilized_at: string | null;
}

// ------------------------------------------------------------------ Anticipatory action
export type ImpactClass = 'severe' | 'moderate' | 'minor' | 'uncertain';
export type PdraDecision = 'monitor' | 'local_early_action' | 'request_declaration';
export interface Pdra extends Versioned {
  hazard_code: string; forecast_source: string; forecast_issued_at: string; expected_impact_at: string; conducted_at: string;
  impact_class: ImpactClass; affected_barangays: string[]; cascading_risks: string | null; sectors_at_risk: string[];
  summary: string | null; decision: PdraDecision; decision_basis: string | null;
}
export type DeclarationStatus = 'draft' | 'requested' | 'recommended' | 'not_recommended' | 'declared' | 'lifted' | 'withdrawn';
export type DeclarationOrigin = 'city_request' | 'adopted_provincial' | 'adopted_regional' | 'adopted_national';
export interface Declaration extends Versioned {
  pdra_id: string | null; hazard_code: string; scope_barangays: string[]; expected_impact_at: string; origin: DeclarationOrigin;
  status: DeclarationStatus; requested_at: string | null; rdrrmc_due_at: string | null; rdrrmc_responded_at: string | null;
  rdrrmc_reference: string | null; eo_number: string | null; declared_at: string | null; lifted_at: string | null;
  lifting_ground: 'hazard_occurred' | 'impacts_not_met' | null; lifting_basis: string | null; report_due_at: string | null;
  report_submitted_at: string | null; report_reference: string | null; costs_minimized_note: string | null;
}
export type AaTiming = 'before_impact_beyond_3d' | 'within_3d' | 'on_declaration' | 'after_lifting';
export interface AaTemplate { id: string; hazard_code: string | null; sector: string; title: string; irr_ref: string; lead_office: string; timing: AaTiming; seq: number }
export interface AaAction extends Versioned {
  declaration_id: string | null; pdra_id: string | null; template_id: string | null; sector: string; title: string;
  lead_office: string | null; timing: string | null; status: 'pending' | 'in_progress' | 'done' | 'not_applicable'; note: string | null; done_at: string | null;
}
export interface AaRule { key: string; value: number; label: string; source_ref: string; version?: number }
export interface AaFundYear { fiscal_year: number; ldrrmf_total: number; aa_allocation: number; appropriation_ref: string | null; version: number; id?: string }
export type FundSource = 'ldrrmf_aa' | 'special_trust_fund' | 'donation' | 'oda' | 'other_lgu' | 'other';
export interface AaDisbursement extends Versioned {
  declaration_id: string; fiscal_year: number; source: FundSource; amount: number; purpose: string; intervention_at: string;
  lead_hours: number | null; tranche: 'beyond_threshold' | 'within_threshold' | null; obligation_ref: string | null;
}

export interface Profile { id: string; full_name: string; position: string | null; office_id: string | null; is_active: boolean; version?: number }

export type VaultCategory = 'law' | 'irr' | 'issuance' | 'framework' | 'city_issuance' | 'plan' | 'report' | 'record' | 'other';
export interface VaultDocument extends Versioned {
  title: string; category: VaultCategory; ref_key: string | null; doc_number: string | null; issuer: string | null;
  doc_date: string | null; summary: string | null; indicator_ids: string[]; storage_path: string | null; file_name: string | null;
  mime_type: string | null; size_bytes: number | null; url: string | null; location: string | null;
  status: 'current' | 'superseded' | 'draft'; superseded_by: string | null; uploaded_by: string | null;
}
