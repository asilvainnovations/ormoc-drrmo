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
    omit: [...STAMPS, 'done_by', 'done_at', 'run_id', 'step_id', 'seq', 'instruction', 'is_critical', 'requires_note', 'due_at'] },
  // assessment
  { name: 'assessment_cycles', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'created_by'] },
  { name: 'responses', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'assessed_by', 'validated_by', 'validated_at'] },
  { name: 'evidence', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'captured_by'] },
  { name: 'actions', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: STAMPS },
  // EOC
  { name: 'eoc_activations', pk: 'id', cursor: 'updated_at', write: 'none' },
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
  { name: 'aa_disbursements', pk: 'id', cursor: 'updated_at', write: 'upsert', omit: [...STAMPS, 'created_by', 'lead_hours', 'tranche'] },
];

export const TABLE = Object.fromEntries(TABLES.map((t) => [t.name, t])) as Record<string, TableConfig>;

/** Tables pushed to the UI live through Supabase Realtime. */
export const REALTIME_TABLES = ['eoc_activations', 'logbook_entries', 'sitreps', 'barangay_reports', 'resource_requests', 'declarations', 'aa_actions'];
