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
  bucket?: 'evidence' | 'vault';     // storage bucket for uploads (evidence when absent)
  label: string;                     // human description for the Sync screen
  createdAt: string;
  attempts: number;
  lastError?: string;
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
  bucket?: 'evidence' | 'vault';
  fileName?: string;
  /** Account that queued the upload (a retry is sent only under that account). */
  userId?: string | null;
}
export interface ConflictItem {
  id?: number; table: string; pk: string; local: Record<string, unknown>; server: Record<string, unknown> | null; at: string; label: string;
  base?: Record<string, unknown> | null;
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
  // local only
  outbox!: Table<OutboxItem, number>;
  failed!: Table<FailedItem, number>;
  conflicts!: Table<ConflictItem, number>;
  files!: Table<StoredFile, string>;
  meta!: Table<Meta, string>;

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
  }
}

export const db = new DrrmDB();

export async function getMeta<V>(key: string, fallback: V): Promise<V> {
  const m = await db.meta.get(key);
  return (m?.value as V | undefined) ?? fallback;
}
export const setMeta = (key: string, value: unknown) => db.meta.put({ key, value });
