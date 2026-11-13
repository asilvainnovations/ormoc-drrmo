// Local-first store (ADR-003). Every screen reads from IndexedDB; writes go here
// first and reach Supabase through the outbox in src/lib/sync.ts.
import Dexie, { type Table } from 'dexie';
import type * as T from '@/types';

export interface OutboxItem {
  seq?: number;
  kind: 'write' | 'rpc' | 'upload';
  table?: string;
  pk?: string;                       // primary-key value of the row
  row?: Record<string, unknown>;
  fn?: string;
  args?: Record<string, unknown>;
  fileId?: string;
  path?: string;
  bucket?: 'evidence' | 'vault' | 'geo';     // storage bucket for uploads (evidence when absent)
  label: string;                     // human description for the Sync screen
  createdAt: string;
  attempts: number;
  /** The server's reason for the last failed attempt (shown on the Sync screen). */
  lastError?: string;
  /** Do not try again before this time (backoff after a server problem, 1.7). */
  nextAttemptAt?: string;
  /** Account that made the change. Only that account's session sends it (v1.2). */
  userId?: string | null;
  /** The row did not exist yet when this was queued: send as an insert, not an update. */
  isNew?: boolean;
  /** The row as it was before this edit (fields the user did not change keep the server's value on "Apply my change on top"). */
  base?: Record<string, unknown> | null;
}
export interface FailedItem {
  id?: number; label: string; error: string; at: string; table?: string; pk?: string;
  /** What the person entered, kept so a refused entry is never lost (this edit and any later queued edits of the row). */
  rows?: Record<string, unknown>[];
  /**
   * A refused upload (1.5.1). The file stays in `files` under this id until the upload
   * succeeds or the person discards it; Retry queues it again with the same path.
   */
  fileId?: string;
  path?: string;
  bucket?: 'evidence' | 'vault' | 'geo';
  fileName?: string;
  /** Account that queued the upload (a retry is sent only under that account). */
  userId?: string | null;
}
export interface ConflictItem {
  id?: number; table: string; pk: string; local: Record<string, unknown>; server: Record<string, unknown> | null; at: string; label: string;
  base?: Record<string, unknown> | null;
  /** Account whose change this was (1.7). Only that account resolves it. */
  userId?: string | null;
}
export interface StoredFile { id: string; blob: Blob; name: string; type: string; createdAt: string }
export interface Meta { key: string; value: unknown }

export class DrrmDB extends Dexie {
  // reference
  iat_parts!: Table<T.Part, string>;
  iat_domains!: Table<T.Domain, string>;
  iat_indicators!: Table<T.Indicator, string>;
  master_requirements!: Table<T.MasterRequirement, string>;
  indicator_requirements!: Table<T.IndicatorRequirement, [string, string]>;
  offices!: Table<T.Office, string>;
  indicator_lead_offices!: Table<T.IndicatorLeadOffice, [string, string]>;
  framework_crosswalk!: Table<T.Crosswalk, number>;
  hazards!: Table<T.Hazard, string>;
  aa_rules!: Table<T.AaRule, string>;
  aa_action_templates!: Table<T.AaTemplate, string>;
  profiles!: Table<T.Profile, string>;
  // library & protocols
  manual_parts!: Table<T.ManualPart, number>;
  manual_areas!: Table<T.ManualArea, number>;
  moo_documents!: Table<T.MooDocument, string>;
  moo_versions!: Table<T.MooVersion, string>;
  moo_document_indicators!: Table<T.MooDocumentIndicator, [string, string]>;
  protocol_templates!: Table<T.ProtocolTemplate, string>;
  protocol_steps!: Table<T.ProtocolStep, string>;
  protocol_runs!: Table<T.ProtocolRun, string>;
  protocol_run_steps!: Table<T.ProtocolRunStep, string>;
  // assessment
  assessment_cycles!: Table<T.Cycle, string>;
  responses!: Table<T.Response, string>;
  evidence!: Table<T.Evidence, string>;
  actions!: Table<T.Action, string>;
  // EOC
  eoc_activations!: Table<T.Activation, string>;
  logbook_entries!: Table<T.LogEntry, string>;
  sitreps!: Table<T.Sitrep, string>;
  barangays!: Table<T.Barangay, string>;
  // DDRiVE (1.12.1, ADR-024)
  ddrive_barangay_profiles!: Table<T.DdriveBarangayProfile, string>;
  ddrive_flood!: Table<T.DdriveFlood, string>;
  ddrive_hazards!: Table<T.DdriveHazards, string>;
  ddrive_exposure!: Table<T.DdriveExposure, string>;
  ddrive_vulnerability!: Table<T.DdriveVulnerability, string>;
  ddrive_priority!: Table<T.DdrivePriority, string>;
  ddrive_city_scores!: Table<T.DdriveCityScore, string>;
  ddrive_risk_matrix!: Table<T.DdriveRiskMatrixRow, number>;
  ddrive_sources!: Table<T.DdriveSource, string>;
  barangay_reports!: Table<T.BarangayReport, string>;
  resource_requests!: Table<T.ResourceRequest, string>;
  // anticipatory action
  pdra_sessions!: Table<T.Pdra, string>;
  declarations!: Table<T.Declaration, string>;
  aa_actions!: Table<T.AaAction, string>;
  aa_fund_years!: Table<T.AaFundYear, number>;
  aa_disbursements!: Table<T.AaDisbursement, string>;
  // document vault
  vault_documents!: Table<T.VaultDocument, string>;
  // 1.9
  form_templates!: Table<T.FormTemplate, string>;
  barangay_clusters!: Table<T.BarangayCluster, string>;
  response_clusters!: Table<T.ResponseCluster, string>;
  contingency_plans!: Table<T.ContingencyPlan, string>;
  cp_activation_items!: Table<T.CpActivationItem, string>;
  activation_clusters!: Table<T.ActivationCluster, string>;
  eoc_positions!: Table<T.EocPosition, string>;
  eoc_designations!: Table<T.EocDesignation, string>;
  geo_reference_points!: Table<T.GeoReferencePoint, string>;
  evacuation_centers!: Table<T.EvacuationCentre, string>;
  camp_reports!: Table<T.CampReport, string>;
  camp_feedback!: Table<T.CampFeedback, string>;
  geo_layers!: Table<T.GeoLayer, string>;
  // local only
  outbox!: Table<OutboxItem, number>;
  failed!: Table<FailedItem, number>;
  conflicts!: Table<ConflictItem, number>;
  files!: Table<StoredFile, string>;
  meta!: Table<Meta, string>;
  // RACI board (1.19.0, ADR-033)
  raci_matrices!: Table<T.RaciMatrix, string>;
  raci_activities!: Table<T.RaciActivity, string>;
  raci_assignments!: Table<T.RaciAssignment, string>;
  // EOC capability assessment (1.20.0, ADR-035)
  eoc_assessment_items!: Table<T.EocAssessmentItem, string>;
  eoc_assessment_runs!: Table<T.EocAssessmentRun, string>;
  eoc_assessment_responses!: Table<T.EocAssessmentResponse, string>;
  // 1.21.0: indicator links, workshop flags, training runs (ADR-036/037); resources + cut-offs (ADR-038/039)
  iat_indicator_links!: Table<T.IatIndicatorLink, string>;
  iat_workshop_flags!: Table<T.IatWorkshopFlag, string>;
  training_runs!: Table<T.TrainingRun, string>;
  resources!: Table<T.Resource, string>;
  sitrep_cutoffs!: Table<T.SitrepCutoff, string>;

  constructor(name = 'ormoc-drrm-ops') {
    super(name);
    this.version(1).stores({
      iat_parts: 'code',
      iat_domains: 'code, part, sort',
      iat_indicators: 'id, domain, sort',
      master_requirements: 'id, sort',
      indicator_requirements: '[indicator_id+mr_id], indicator_id, mr_id',
      offices: 'id, code',
      indicator_lead_offices: '[indicator_id+office_id], indicator_id, office_id',
      framework_crosswalk: 'sort, framework',
      hazards: 'code, sort',
      aa_rules: 'key',
      aa_action_templates: 'id, hazard_code, seq',
      profiles: 'id',
      moo_documents: 'id, manual, code, sort',
      moo_versions: 'id, document_id, status',
      moo_document_indicators: '[document_id+indicator_id], document_id, indicator_id',
      protocol_templates: 'id, code, category',
      protocol_steps: 'id, template_id, [template_id+seq]',
      protocol_runs: 'id, template_id, status, started_at',
      protocol_run_steps: 'id, run_id, [run_id+seq]',
      assessment_cycles: 'id, cycle_year, status',
      responses: 'id, cycle_id, [cycle_id+indicator_id], indicator_id',
      evidence: 'id, response_id',
      actions: 'id, cycle_id, indicator_id, status',
      eoc_activations: 'id, started_at, ended_at',
      logbook_entries: 'id, activation_id, occurred_at',
      sitreps: 'id, activation_id, status, period_end',
      barangays: 'psgc, name',
      barangay_reports: 'id, barangay_psgc, reported_at, [barangay_psgc+reported_at]',
      resource_requests: 'id, activation_id, status, requested_at',
      pdra_sessions: 'id, hazard_code, conducted_at',
      declarations: 'id, status, expected_impact_at',
      aa_actions: 'id, declaration_id, pdra_id',
      aa_fund_years: 'fiscal_year',
      aa_disbursements: 'id, declaration_id, fiscal_year',
      outbox: '++seq, kind, table, pk',
      failed: '++id, at',
      conflicts: '++id, at',
      files: 'id',
      meta: 'key',
    });
    // v2 (1.1): Document Vault.
    this.version(2).stores({ vault_documents: 'id, category, ref_key, status, *indicator_ids, updated_at' });
    // v3 (1.6): one manual, five Parts, ten functional areas; documents carry an area and aliases.
    this.version(3).stores({
      manual_parts: 'no, sort',
      manual_areas: 'no, part_no, sort',
      moo_documents: 'id, manual, code, sort, area_no, parent_id, *aliases',
    });
    // v4 (1.9): step forms, EOC structure and contingency-plan clustering, Geo-COP.
    this.version(4).stores({
      form_templates: 'id, code, status',
      protocol_templates: 'id, code, category, status',
      barangays: 'psgc, name, cluster_id',
      barangay_clusters: 'id, code',
      response_clusters: 'id, code, sort',
      contingency_plans: 'id, code, status',
      cp_activation_items: 'id, plan_id',
      activation_clusters: 'id, activation_id, [activation_id+item_kind+item_code]',
      eoc_positions: 'id, code, section, sort',
      eoc_designations: 'id, position_id, status',
      geo_reference_points: 'id, code, verification_status',
      geo_layers: 'id, code, layer_group, status',
    });
    // v5 (1.12.1): DDRiVE risk-intelligence base layer (ADR-024). Read-only reference.
    this.version(5).stores({
      ddrive_barangay_profiles: 'psgc, name, cluster_no',
      ddrive_flood: 'psgc',
      ddrive_hazards: 'psgc',
      ddrive_exposure: 'psgc',
      ddrive_vulnerability: 'psgc',
      ddrive_priority: 'psgc, priority_rank',
      ddrive_city_scores: 'hazard_event, hazard_family',
      ddrive_risk_matrix: 'ranking, band',
      ddrive_sources: 'source_id',
    });
    // v6 (1.16.0): ECHO, the evacuation-centre inventory, camp reports and the feedback log (ADR-030). Aggregates only.
    this.version(6).stores({
      evacuation_centers: 'id, code, verification_status, barangay_psgc',
      camp_reports: 'id, centre_id, activation_id, reported_at, [centre_id+reported_at]',
      camp_feedback: 'id, activation_id, centre_id, status',
    });
    // v7 (1.19.0): RACI board (ADR-033).
    this.version(7).stores({
      raci_matrices: 'id, code, sort',
      raci_activities: 'id, matrix_id, template_id, [matrix_id+sort]',
      raci_assignments: 'id, activity_id, duty',
    });
    // v8 (1.20.0): EOC capability assessment board (ADR-035).
    this.version(8).stores({
      eoc_assessment_items: 'id, section, [section_sort+item_no]',
      eoc_assessment_runs: 'id, status, created_at',
      eoc_assessment_responses: 'id, run_id, item_id, [run_id+item_id], status',
    });
    // v9 (1.21.0): indicator links, workshop flags, training runs (ADR-036/037), resources and cut-offs (ADR-038/039).
    this.version(9).stores({
      iat_indicator_links: 'id, indicator_id, target_kind',
      iat_workshop_flags: 'indicator_id',
      training_runs: 'id, tool, run_at, filed_to_indicator',
      resources: 'id, category, owner_office_id',
      sitrep_cutoffs: 'id, alert_level',
    });
  }
}

export const db = new DrrmDB();

export async function getMeta<V>(key: string, fallback: V): Promise<V> {
  const m = await db.meta.get(key);
  return (m?.value as V | undefined) ?? fallback;
}
export const setMeta = (key: string, value: unknown) => db.meta.put({ key, value });
