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
  /** Primary functional area of the manual (Traceability Dictionary v1.1). Since v1.6. */
  functional_area?: number | null;
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
/** IRR Rule II Sec. 2 hazard families: graduated AA disbursement covers hydromet and geological (Rule V Sec. 2). */
export type AaFamily = 'hydromet' | 'geological' | 'climatic' | 'other';
export interface Hazard { code: string; name: string; forecastable: boolean; typical_lead_hours: number | null; declaration_eligible: boolean; note: string | null; aa_family?: AaFamily | null; sort: number }

// ------------------------------------------------------------------ IAT
export type CycleStatus = 'draft' | 'fieldwork' | 'validation' | 'final' | 'archived';
export interface Cycle extends Versioned { name: string; cycle_year: number; iat_version: string; status: CycleStatus; period_from: string | null; period_to: string | null; notes: string | null }
export type EvidenceStrength = 'verbal' | 'partial' | 'approved_in_use' | 'tested_improved';
/** IAT v1-6 Evidence Validation Status (migration 20261111002400_evidence_check.sql). */
export type EvidenceCheck = 'pending' | 'verified' | 'partially_verified' | 'unverified' | 'missing';
export type EvidenceKind = 'document' | 'observation' | 'interview' | 'fgd' | 'test' | 'photo';
export interface Response extends Versioned {
  cycle_id: string; indicator_id: string; score: number | null; is_na: boolean; na_justification: string | null;
  gap_remarks: string | null; recommended_action: string | null; status: 'draft' | 'provisional' | 'validated';
  assessed_by?: string | null; validated_by?: string | null; validated_at?: string | null;
  /** Server-stamped who and when; optional because rows synced before 1.13.0 lack them. */
  evidence_check?: EvidenceCheck; evidence_checked_by?: string | null; evidence_checked_at?: string | null;
  /** 1.15.0 (migration 20261112002700): server-stamped; validation_note is the validator's reason for a revision. */
  scored_by?: string | null; validation_decision?: 'confirmed' | 'revised' | null; validation_note?: string | null;
  score_before_validation?: number | null;
}
/** Per cycle and domain (view v_validation_progress). */
export interface ValidationProgress { cycle_id: string; part: 'A' | 'B' | 'C'; domain: string; indicators: number; draft: number;
  submitted: number; validated: number; confirmed: number; revised: number; evidence_verified: number; evidence_pending: number }
export interface Evidence extends Versioned {
  response_id: string; kind: EvidenceKind; strength: EvidenceStrength; title: string; doc_date: string | null;
  source: string | null; storage_path: string | null; note: string | null;
}
export interface Action extends Versioned {
  cycle_id: string; indicator_id: string; action: string; responsible_office_id: string | null; responsible_person: string | null;
  target_date: string | null; budget_source: string | null; status: 'not_started' | 'ongoing' | 'done' | 'dropped';
}

// ------------------------------------------------------------------ EOC capability checklist (1.20.0, ADR-035)
export type EocCapStatus = 'not_assessed' | 'met' | 'partially_met' | 'largely_unmet' | 'not_met' | 'not_applicable';
export type EocCapSite = 'primary' | 'alternate';
export interface EocCapItem extends Versioned {
  section_group: string; section: string; item_no: number; item: string; iat_indicators: string[]; assess_locally: boolean; sort: number;
  source_ref: string;
}
export interface EocCapResponse extends Versioned {
  cycle_id: string; item_id: string; site: EocCapSite; status: EocCapStatus;
  /** Server-set: 'prefilled_iat' (copied from the IAT crosswalk, not observed) until a person edits or confirms it. */
  provenance?: 'prefilled_iat' | 'observed';
  evidence_observed: string | null; gap_remarks: string | null; recommended_action: string | null; vault_document_id: string | null;
  /** Changed only by the CDRRMO Head, online. */
  state?: 'draft' | 'validated';
  assessed_by?: string | null; assessed_at?: string | null; validated_by?: string | null; validated_at?: string | null;
}

// ------------------------------------------------------------------ Library & protocols
/** One manual since v1.6 (ADR-012): five Parts, ten functional areas. */
export interface ManualPart { no: number; title: string; summary: string | null; sort: number }
export interface ManualArea {
  no: number; part_no: number; title: string; scope: string | null; mcr_primary: string | null; mcr_supporting: string | null; sort: number;
}
export interface MooDocument extends Versioned {
  /** Legacy (MOO or EOC); not shown since v1.6. */
  manual: 'MOO' | 'EOC'; kind: 'chapter' | 'sop' | 'form' | 'annex' | 'area'; code: string; title: string; parent_id?: string | null;
  summary: string | null; status: 'draft' | 'in_review' | 'approved' | 'superseded'; current_version_id: string | null; sort: number;
  area_no?: number | null; chapter_no?: number | null; aliases?: string[]; also_areas?: number[];
}
export interface MooVersion extends Versioned {
  document_id: string; label: string; body_md: string; change_note: string | null;
  status: 'draft' | 'in_review' | 'approved' | 'rejected'; author?: string | null; approved_by?: string | null; approved_at?: string | null; review_note?: string | null;
}
export interface MooDocumentIndicator { document_id: string; indicator_id: string }
export type ProtocolCategory = 'daily_operations' | 'warning' | 'eoc' | 'anticipatory_action' | 'council' | 'reporting' | 'recovery'
  | 'governance' | 'workforce' | 'budget' | 'response_clusters' | 'geospatial'
  | 'risk_information' | 'risk_planning' | 'contingency_planning' | 'continuity';
export interface ProtocolTemplate extends Versioned {
  code: string; title: string; purpose: string | null; trigger_text: string | null; document_id: string | null;
  owner_role: Role; category: ProtocolCategory; status: 'draft' | 'approved' | 'retired'; template_rev: number;
  /** SOP registry (1.10, ADR-019): the same control block for every protocol and workflow. */
  kind?: 'protocol' | 'workflow'; sop_ref?: string | null; process_owner?: string | null; policy_refs?: string[]; indicator_ids?: string[];
}
export interface ProtocolStep extends Versioned {
  template_id: string; seq: number; instruction: string; is_critical: boolean; requires_note: boolean; due_offset_minutes: number | null;
  form_code?: string | null;
}
export interface ProtocolRun extends Versioned {
  template_id: string; template_rev: number; title: string; context_type: string | null; context_id: string | null;
  status: 'running' | 'completed' | 'aborted'; started_by?: string | null; started_at: string; completed_at: string | null; abort_reason: string | null;
}
export type StepStatus = 'pending' | 'done' | 'skipped' | 'not_applicable';
export interface ProtocolRunStep extends Versioned {
  run_id: string; step_id: string; seq: number; instruction: string; is_critical: boolean; requires_note: boolean;
  due_at: string | null; status: StepStatus; done_by: string | null; done_at: string | null; note: string | null;
  /** Snapshot of the step's form when the run started (1.9, migration 20261106001700). */
  form_code?: string | null; form_rev?: number | null; form_schema?: FormSchema | null; form_data?: FormValues;
}

// ------------------------------------------------------------------ forms (1.9)
export type FormFieldType = 'text' | 'textarea' | 'number' | 'integer' | 'date' | 'datetime' | 'time' | 'select' | 'multiselect' | 'checkbox';
export interface FormField {
  key: string; label: string; type: FormFieldType; required?: boolean; options?: string[]; hint?: string; min?: number; max_length?: number;
}
export interface FormSchema { fields: FormField[] }
export type FormValue = string | number | boolean | string[] | null;
export type FormValues = Record<string, FormValue>;
export interface FormTemplate extends Versioned {
  code: string; title: string; purpose: string | null; document_id: string | null; schema: FormSchema;
  status: 'draft' | 'approved' | 'retired'; rev: number;
}

// ------------------------------------------------------------------ EOC
export type EocLevel = 'white' | 'blue' | 'red';
export interface Activation extends Versioned {
  level: EocLevel; reason: string; hazard_code: string | null; authority_ref: string | null;
  started_by?: string | null; started_at: string; ended_at: string | null; plan_id?: string | null;
}

// ------------------------------------------------------------------ EOC structure (1.9, migration 20261106001800)
export interface ResponseCluster extends Versioned {
  code: string; name: string; national_lead: string | null; lead_office_id: string | null; mandate: string | null; sort: number; is_active: boolean;
}
export type PlanStatus = 'to_prepare' | 'draft' | 'adopted' | 'expired' | 'retired';
export interface ContingencyPlan extends Versioned {
  code: string; title: string; hazard_code: string | null; scenario: string | null; warning_time: string | null; activation_triggers: string | null;
  status: PlanStatus; adopted_ref: string | null; adopted_on: string | null; valid_until: string | null; vault_document_id: string | null;
}
export type ItemKind = 'cluster' | 'module';
export interface CpActivationItem extends Versioned {
  plan_id: string; item_kind: ItemKind; item_code: string; state: 'on' | 'lead' | 'standby'; min_level: EocLevel; note: string | null;
}
export interface ActivationCluster extends Versioned {
  activation_id: string; item_kind: ItemKind; item_code: string; state: 'on' | 'lead' | 'standby' | 'stood_down';
  changed_by: string | null; changed_at: string;
}
export type EocSection = 'command' | 'command_staff' | 'operations' | 'planning' | 'logistics' | 'finance_admin' | 'cluster_desk' | 'barangay_desk';
export interface EocPosition extends Versioned {
  code: string; title: string; section: EocSection; min_level: EocLevel; cluster_code: string | null; required_depth: number; sort: number; is_active: boolean;
}
export interface EocDesignation extends Versioned {
  position_id: string; rank: 1 | 2 | 3; person_id: string | null; office_id: string | null; designee_position: string | null;
  status: 'proposed' | 'approved' | 'withdrawn'; valid_from: string; valid_until: string | null; note: string | null;
  proposed_by: string | null; approved_by: string | null; approved_at: string | null;
}
export interface BarangayCluster extends Versioned {
  code: string; name: string; is_pilot: boolean; pilot_from: string | null; pilot_to: string | null; note: string | null;
}

// ------------------------------------------------------------------ Geo-COP (1.9, migration 20261106001900)
export type GeoPointKind = 'eoc' | 'alternate_eoc' | 'opcen' | 'icp' | 'staging' | 'evacuation_hub' | 'other';
export interface GeoReferencePoint extends Versioned {
  code: string; name: string; kind: GeoPointKind; lat: number; lng: number; altitude_m: number | null; source: string;
  verification_status: 'pending_field_validation' | 'field_verified' | 'superseded'; verified_by: string | null; verified_at: string | null;
  superseded_by: string | null; vault_document_id: string | null; note: string | null; created_by: string | null;
}
export type GeoLayerGroup = 'eoc_facilities' | 'admin_boundaries' | 'hazard' | 'incident' | 'evacuation' | 'critical_facilities'
  | 'population_exposure' | 'resources' | 'lifelines';
export interface GeoLayer extends Versioned {
  code: string; title: string; layer_group: GeoLayerGroup; source: string; custodian_office_id: string | null; issued_on: string | null;
  crs: string; scale: string | null; validation_status: 'reported' | 'preliminary' | 'field_verified' | 'official';
  update_frequency: string | null; access_class: 'internal' | 'restricted'; storage_path: string | null; original_path: string | null;
  file_name: string | null; feature_count: number | null; bbox: number[] | null; status: 'current' | 'superseded';
  superseded_by: string | null; note: string | null; uploaded_by: string | null;
}

// ------------------------------------------------------------------ connected apps (1.9, migration 20261106001600)
export interface ConnectedApp extends Versioned {
  client_id: string; name: string; purpose: string; owner_office_id: string | null; contact_position: string | null; redirect_uri: string;
  data_scope: string; status: 'requested' | 'approved' | 'suspended' | 'retired'; reviewed_by: string | null; reviewed_at: string | null;
  review_due: string | null; created_by: string | null;
}
export type LogCategory = 'general' | 'decision' | 'warning' | 'request' | 'resource' | 'report' | 'level_change' | 'correction';
export interface LogEntry { id: string; activation_id: string | null; incident_id?: string | null; occurred_at: string; category: LogCategory; entry: string; corrects_id: string | null; author: string | null; created_at: string }
export interface Sitrep extends Versioned {
  activation_id: string | null; incident_id?: string | null; seq: number | null; period_start: string; period_end: string;
  status: 'draft' | 'submitted' | 'approved'; situation: string | null; actions_taken: string | null; needs: string | null;
  affected_families: number | null; affected_persons: number | null; evacuated_families: number | null; evacuated_persons: number | null;
  dead: number | null; injured: number | null; missing: number | null; submitted_at: string | null; approved_at: string | null;
}
export interface Barangay {
  psgc: string; name: string; classification: string[]; population: number | null; lat: number | null; lng: number | null; version?: number;
  cluster_id?: string | null; hazard_tags?: string[]; hazard_tag_source?: string | null;
}

// ------------------------------------------------------------------ DDRiVE (1.12.1, ADR-024)
/** Data-Driven Risk and Vulnerability Estimation — the City's desk-assessment workbook,
 *  ingested read-only (migration 20261110002100). Missing values stay null; never 0. */
export interface DdriveBarangayProfile {
  psgc: string; name: string; former_name: string | null; urban_rural: string | null;
  population_2024: number | null; population_2020: number | null; growth_rate_2020_2024: number | null;
  households: number | null; density_per_ha: number | null; data_quality_flag: string | null;
  lat: number; lng: number; coord_source: string | null; coord_validation: string | null;
  cluster_no: number | null; cluster_label: string | null; district_zone: string | null;
  assigned_coordinator: string | null; cluster_validation: string | null; workbook_rev: string;
}
export interface DdriveFlood {
  psgc: string; susceptibility_class: string | null; hazard_source: string | null;
  prone_area_ha: number | null; land_area_ha: number | null; prone_pct: number | null;
  exposed_population: number | null; exposure_base_population: number | null; exposure_base_year: string | null;
  exposure_pct: number | null; depth_scenario: string | null; confidence: string | null; validation_status: string | null;
}
export interface DdriveHazards {
  psgc: string; rain_landslide: string | null; eq_landslide: string | null; ground_shaking: string | null;
  ground_rupture: string | null; liquefaction: string | null; tsunami: string | null; storm_surge: string | null;
  facilities_exposure: string | null; lifeline_exposure: string | null; vulnerable_population: string | null;
  evacuation_access: string | null; source_vintage: string | null; validation_status: string | null;
}
export interface DdriveExposure {
  psgc: string; population_2024: number | null; pop_0_4: number | null; pop_5_17: number | null;
  pop_18_59: number | null; pop_60_plus: number | null; schools: number | null; health_facilities: number | null;
  infrastructure: string | null; source: string | null; status: string | null;
}
export interface DdriveVulnerability {
  psgc: string; social_sensitivity: string | null; access_constraints: string | null;
  coping_capacity: string | null; adaptive_capacity: string | null; method_source: string | null; validation_status: string | null;
}
export interface DdrivePriority {
  psgc: string; priority_rank: number | null; basis: string | null; population_2024: number | null;
  confidence: string | null; validation_status: string | null;
}
export interface DdriveCityScore {
  hazard_event: string; hazard_family: string; exposure_infrastructure: string | null; exposure_productive: string | null;
  exposure_essential: string | null; exposure_human: string | null; vulnerability_rating: number | null;
  response_measures: string | null; likelihood: number; severity: number; evidence_anchor: string | null; validation_status: string | null;
}
export interface DdriveRiskMatrixRow {
  ranking: number; severity_min: number; severity_max: number; likelihood_min: number; likelihood_max: number;
  band: string; label: string;
}
/** A desk score with its band, mirroring view v_ddrive_city_risk (computed, never stored). */
export interface DdriveCityRisk extends DdriveCityScore { ranking: number; band: string; label: string }
export interface DdriveSource {
  source_id: string; name: string; owner: string | null; url: string | null; vintage: string | null;
  coverage: string | null; accessed_on: string | null; limitations: string | null;
}
export type BarangayCondition = 'normal' | 'monitoring' | 'affected' | 'isolated' | 'evacuating';
export interface BarangayReport {
  id: string; barangay_psgc: string; activation_id: string | null; reported_at: string; condition: BarangayCondition;
  families_evacuated: number | null; persons_evacuated: number | null; remarks: string | null; channel: string | null; reported_by?: string | null; created_at: string;
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
  /** RA 12287 Sec. 7: automatic lifting at occurrence (1.13.0). */ hazard_occurred_at?: string | null;
  /** Impacts not met: RDRRMC recommendation and lifting issuance (1.13.0). */ lifting_reference?: string | null;
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

// ------------------------------------------------------------------ RACI board (1.19.0, ADR-033)
export type RaciDuty = 'R' | 'A' | 'C' | 'I';
export interface RaciMatrix extends Versioned {
  code: string; title: string; source_ref: string; sort: number;
}
export interface RaciActivity extends Versioned {
  matrix_id: string; activity: string; note: string | null;
  /** The protocol or workflow that carries out this activity, when one exists. */
  template_id: string | null; sop_ref: string | null; sort: number;
}
export interface RaciAssignment extends Versioned {
  activity_id: string;
  /** Position, office or body — never a personal name (RA 10173). */
  actor: string; duty: RaciDuty;
  /** Scope note from the Manual cell, e.g. "documentation", "within mandate". */
  qualifier: string | null;
}

export type VaultCategory = 'law' | 'irr' | 'issuance' | 'framework' | 'city_issuance' | 'plan' | 'report' | 'record' | 'other';
export interface VaultDocument extends Versioned {
  title: string; category: VaultCategory; ref_key: string | null; doc_number: string | null; issuer: string | null;
  doc_date: string | null; summary: string | null; indicator_ids: string[]; storage_path: string | null; file_name: string | null;
  mime_type: string | null; size_bytes: number | null; url: string | null; location: string | null;
  status: 'current' | 'superseded' | 'draft'; superseded_by: string | null; uploaded_by: string | null;
  /** 1.9: restricted documents open only for the listed roles (and the CDRRMO Head). */
  access_class?: 'standard' | 'restricted'; allowed_roles?: Role[];
}

// ------------------------------------------------------------------ ECHO (1.16.0, migration 20261112002800, ADR-030)
export type CentreKind = 'ligtas_pinoy_center' | 'multipurpose' | 'covered_court' | 'barangay_hall' | 'school_last_resort' | 'other';
export type CentreVerification = 'training' | 'pending_field_validation' | 'field_verified' | 'superseded';
/** The evacuation-centre inventory. "field_verified" = inventory data checked in the field, never a safety certificate. */
export interface EvacuationCentre extends Versioned {
  code: string | null; name: string; barangay_psgc: string | null; kind: CentreKind; capacity_persons: number | null; covered_area_m2: number | null;
  toilets_male: number | null; toilets_female: number | null; toilets_accessible: number | null; bathing: number | null; water_l_day: number | null;
  is_school: boolean; is_permanent: boolean; accessible: boolean | null; hazard_screening: string | null; structural_ref: string | null;
  ra12076: Record<string, 'yes' | 'no' | 'unknown'>; verification_status: CentreVerification; verified_by?: string | null; verified_at?: string | null;
  custodian_office_id: string | null; point_id: string | null; lat: number | null; lng: number | null; note: string | null;
  created_by?: string | null; created_at?: string;
}
export type CampPhase = 'opening' | 'open' | 'consolidating' | 'closing' | 'closed';
/** One aggregate snapshot of a centre (append-only). Null = not reported. */
export interface CampReport {
  id: string; activation_id: string | null; centre_id: string; reported_at: string; phase: CampPhase;
  families: number | null; persons: number | null; female: number | null; male: number | null; children: number | null; older: number | null;
  pwd: number | null; pregnant_lactating: number | null; ip: number | null; arrivals: number | null; departures: number | null;
  water_l_day: number | null; toilets_functional: number | null; bathing_functional: number | null;
  services: Record<string, 'yes' | 'partial' | 'no'>; referrals_cp: number | null; referrals_gbv: number | null; referrals_health: number | null;
  unmet_needs: string | null; authority_ref: string | null; remarks: string | null; reported_by?: string | null; created_at: string;
}
export type FeedbackCategory = 'access_inclusion' | 'wash' | 'safety_privacy' | 'child_protection_referral' | 'gbv_referral' | 'health_mhpss' | 'food_nfi' | 'information' | 'other';
export interface CampFeedback extends Versioned {
  activation_id: string | null; centre_id: string | null; category: FeedbackCategory; status: 'open' | 'referred' | 'action_assigned' | 'closed';
  summary: string; action_office: string | null; closed_at: string | null; created_by?: string | null; created_at?: string;
}
