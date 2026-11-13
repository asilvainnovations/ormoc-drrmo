// How each table syncs. Order matters: parents before children on first pull.
export type WriteMode = 'upsert' | 'update' | 'insert' | 'none';

export interface TableConfig {
  name: string;
  pk: string;                // primary key column (composite tables are reference-only)
  cursor: 'updated_at' | 'created_at' | null;   // null = small reference table, refreshed whole
  write: WriteMode;          // how the client is allowed to write it (matches RLS grants)
  omit?: string[];           // columns the server sets; never sent by the client
}

const STAMPS = ['created_at', 'updated_at'];

export const TABLES: TableConfig[] = [
  // reference (admin-maintained, refreshed whole)
  { name: 'manual_parts', pk: 'no', cursor: null, write: 'none' },
  { name: 'manual_areas', pk: 'no', cursor: null, write: 'none' },
  { name: 'iat_parts', pk: 'code', cursor: null, write: 'none' },
  { name: 'iat_domains', pk: 'code', cursor: null, write: 'none' },
  { name: 'iat_indicators', pk: 'id', cursor: null, write: 'none' },
  { name: 'master_requirements', pk: 'id', cursor: null, write: 'none' },
  { name: 'indicator_requirements', pk: 'indicator_id', cursor: null, write: 'none' },
  { name: 'offices', pk: 'id', cursor: null, write: 'none' },
  { name: 'indicator_lead_offices', pk: 'indicator_id', cursor: null, write: 'none' },
  { name: 'framework_crosswalk', pk: 'sort', cursor: null, write: 'none' },
  { name: 'hazards', pk: 'code', cursor: null, write: 'none' },
  { name: 'aa_rules', pk: 'key', cursor: null, write: 'none' },
  { name: 'aa_action_templates', pk: 'id', cursor: null, write: 'none' },
  { name: 'profiles', pk: 'id', cursor: 'updated_at', write: 'none' },
  { name: 'barangays', pk: 'psgc', cursor: 'updated_at', write: 'none' },
  // DDRiVE risk-intelligence base layer (1.12.1, ADR-024): the desk-assessment workbook,
  // read-only reference. The band of a city score is computed by v_ddrive_city_risk, not stored.
  { name: 'ddrive_barangay_profiles', pk: 'psgc', cursor: null, write: 'none' },
  { name: 'ddrive_flood', pk: 'psgc', cursor: null, write: 'none' },
  { name: 'ddrive_hazards', pk: 'psgc', cursor: null, write: 'none' },
  { name: 'ddrive_exposure', pk: 'psgc', cursor: null, write: 'none' },
  { name: 'ddrive_vulnerability', pk: 'psgc', cursor: null, write: 'none' },
  { name: 'ddrive_priority', pk: 'psgc', cursor: null, write: 'none' },
  { name: 'ddrive_city_scores', pk: 'hazard_event', cursor: null, write: 'none' },
  { name: 'ddrive_risk_matrix', pk: 'ranking', cursor: null, write: 'none' },
  { name: 'ddrive_sources', pk: 'source_id', cursor: null, write: 'none' },
  // 1.9 reference and registers (migrations 20261106001700-1900)
  { name: 'barangay_clusters', pk: 'id', cursor: 'updated_at', write: 'none' },
  { name: 'response_clusters', pk: 'id', cursor: 'updated_at', write: 'none' },
  { name: 'form_templates', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'rev'] },
  // library & protocols
  { name: 'moo_documents', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: STAMPS },
  { name: 'moo_versions', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'author', 'approved_by', 'approved_at'] },
  { name: 'moo_document_indicators', pk: 'document_id', cursor: null, write: 'none' },
  { name: 'protocol_templates', pk: 'id', cursor: 'updated_at', write: 'none' },
  { name: 'protocol_steps', pk: 'id', cursor: 'updated_at', write: 'none' },
  // Runs and steps are created by start_protocol(); the client only sends what changes
  // (status, notes). Snapshot columns are locked server-side (migration 0007).
  { name: 'protocol_runs', pk: 'id', cursor: 'updated_at', write: 'update',
    omit: [...STAMPS, 'started_by', 'completed_at', 'template_id', 'template_rev', 'started_at', 'context_type', 'context_id'] },
  { name: 'protocol_run_steps', pk: 'id', cursor: 'updated_at', write: 'update',
    omit: [...STAMPS, 'done_by', 'done_at', 'run_id', 'step_id', 'seq', 'instruction', 'is_critical', 'requires_note', 'due_at',
      'form_code', 'form_rev', 'form_schema'] },
  // assessment
  { name: 'assessment_cycles', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'created_by'] },
  { name: 'responses', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'assessed_by', 'validated_by', 'validated_at', 'scored_by', 'validation_decision', 'score_before_validation', 'evidence_checked_by', 'evidence_checked_at'] },
  { name: 'evidence', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'captured_by'] },
  { name: 'actions', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: STAMPS },
  // EOC
  { name: 'eoc_activations', pk: 'id', cursor: 'updated_at', write: 'none' },
  // EOC structure (1.9): plans and positions are maintained by the Head and EOC Manager; activation of a plan is an RPC.
  { name: 'contingency_plans', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: STAMPS },
  { name: 'cp_activation_items', pk: 'id', cursor: 'updated_at', write: 'none' },
  { name: 'activation_clusters', pk: 'id', cursor: 'updated_at', write: 'update',
    omit: [...STAMPS, 'activation_id', 'item_kind', 'item_code', 'changed_by', 'changed_at'] },
  { name: 'eoc_positions', pk: 'id', cursor: 'updated_at', write: 'none' },
  { name: 'eoc_designations', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'proposed_by', 'approved_by', 'approved_at'] },
  // Geo-COP (1.9)
  { name: 'geo_reference_points', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'created_by', 'verified_by', 'verified_at'] },
  { name: 'geo_layers', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'uploaded_by'] },
  // ECHO (1.16.0, ADR-030): the inventory is maintained by EOC staff; camp reports are append-only aggregates.
  { name: 'evacuation_centers', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'created_by', 'verified_by', 'verified_at', 'status', 'occupancy_persons'] },
  { name: 'camp_reports', pk: 'id', cursor: 'created_at', write: 'insert', omit: ['created_at', 'reported_by'] },
  { name: 'camp_feedback', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'created_by', 'closed_at'] },
  { name: 'logbook_entries', pk: 'id', cursor: 'created_at', write: 'insert', omit: ['created_at', 'author'] },
  { name: 'sitreps', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'seq', 'prepared_by', 'submitted_at', 'approved_by', 'approved_at'] },
  { name: 'barangay_reports', pk: 'id', cursor: 'created_at', write: 'insert', omit: ['created_at', 'reported_by'] },
  { name: 'resource_requests', pk: 'id', cursor: 'updated_at', write: 'upsert',
    omit: [...STAMPS, 'created_by', 'approved_at', 'mobilized_at', 'delivered_at', 'demobilized_at'] },
  // anticipatory action
  { name: 'pdra_sessions', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'created_by'] },
  { name: 'declarations', pk: 'id', cursor: 'updated_at', write: 'upsert',
    omit: [...STAMPS, 'created_by', 'rdrrmc_due_at', 'report_due_at'] },
  { name: 'aa_actions', pk: 'id', cursor: 'updated_at', write: 'update',
    omit: [...STAMPS, 'done_by', 'done_at', 'declaration_id', 'pdra_id', 'template_id', 'title', 'sector', 'lead_office', 'timing'] },
  { name: 'aa_fund_years', pk: 'fiscal_year', cursor: 'updated_at', write: 'upsert', omit: ['updated_at'] },
  // document vault (rows only reach vault roles; RLS returns nothing to others)
  { name: 'vault_documents', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'uploaded_by'] },
  { name: 'aa_disbursements', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'created_by', 'lead_hours', 'tranche'] },
  // RACI board (1.19.0, ADR-033): reference reads stay offline; edits are authority actions sent
  // online only by the CDRRMO Head (updateOnline/direct writes in features/raci), never queued.
  { name: 'raci_matrices', pk: 'id', cursor: 'updated_at', write: 'none' },
  { name: 'raci_activities', pk: 'id', cursor: 'updated_at', write: 'none' },
  { name: 'raci_assignments', pk: 'id', cursor: 'updated_at', write: 'none' },
  // EOC capability assessment (1.20.0, ADR-035): reads stay offline; response edits and run
  // validation are authority actions sent online only (updateOnline in features/eoc-assessment).
  { name: 'eoc_assessment_items', pk: 'id', cursor: 'updated_at', write: 'none' },
  { name: 'eoc_assessment_runs', pk: 'id', cursor: 'updated_at', write: 'none' },
  { name: 'eoc_assessment_responses', pk: 'id', cursor: 'updated_at', write: 'none',
    omit: [...STAMPS, 'provenance', 'state', 'validated_by', 'validated_at', 'updated_by'] },
];

export const TABLE = Object.fromEntries(TABLES.map((t) => [t.name, t])) as Record<string, TableConfig>;

/** Tables pushed to the UI live through Supabase Realtime. */
export const REALTIME_TABLES = ['eoc_activations', 'logbook_entries', 'sitreps', 'barangay_reports', 'resource_requests', 'declarations', 'aa_actions', 'vault_documents',
  'activation_clusters', 'eoc_designations', 'contingency_plans', 'geo_reference_points', 'geo_layers', 'form_templates',
  'evacuation_centers', 'camp_reports', 'camp_feedback'];
