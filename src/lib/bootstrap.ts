// First launch: load the bundled reference catalogue (generated from the City's
// IAT v1.1 and traceability workbooks) so the app works before its first sync.
import reference from '@/data/reference.json';
import { db, getMeta, setMeta } from './db';
import { DEFAULT_AA_PARAMS } from '@/domain/aa';

export const REFERENCE_VERSION = 'iat-1.1/2026-10-15';

type Ref = typeof reference;
const R = reference as Ref;

export async function bootstrapReference(): Promise<void> {
  const loaded = await getMeta<string | null>('referenceVersion', null);
  if (loaded === REFERENCE_VERSION && (await db.iat_indicators.count()) > 0) return;
  await db.transaction('rw', [db.iat_parts, db.iat_domains, db.iat_indicators, db.master_requirements, db.indicator_requirements,
    db.offices, db.indicator_lead_offices, db.framework_crosswalk, db.hazards, db.aa_rules, db.aa_action_templates,
    db.moo_documents, db.moo_versions, db.moo_document_indicators, db.protocol_templates, db.protocol_steps, db.meta], async () => {
    await db.iat_parts.bulkPut(R.parts as never[]);
    await db.iat_domains.bulkPut(R.domains as never[]);
    await db.iat_indicators.bulkPut(R.indicators as never[]);
    await db.master_requirements.bulkPut(R.master_requirements as never[]);
    await db.indicator_requirements.bulkPut(R.indicator_requirements as never[]);
    await db.offices.bulkPut(R.offices.map((o) => ({ ...o, version: 1 })) as never[]);
    await db.indicator_lead_offices.bulkPut(R.indicator_lead_offices as never[]);
    await db.framework_crosswalk.bulkPut(R.crosswalk as never[]);
    await db.hazards.bulkPut(R.hazards as never[]);
    await db.aa_action_templates.bulkPut(R.aa_action_templates as never[]);
    const labels: Record<string, [string, string]> = {
      aa_share_of_ldrrmf_70: ['Maximum AA share of the 70% LDRRMF', 'IRR Rule V Sec. 1(b)'],
      tranche_beyond_max: ['Maximum share for interventions beyond the lead-time threshold', 'IRR Rule V Sec. 2'],
      tranche_within_max: ['Maximum share for interventions within the lead-time threshold', 'IRR Rule V Sec. 2'],
      lead_threshold_hours: ['Lead-time threshold (3 days)', 'RA 12287 Sec. 6(b)'],
      min_declaration_lead_hours: ['Minimum lead time for a declaration', 'RA 12287 Sec. 6(b)'],
      rdrrmc_reply_hours: ['RDRRMC recommendation time', 'IRR Rule III Sec. 2'],
      report_days: ['Report to OCD after lifting', 'RA 12287 Sec. 8; IRR Rule VI Sec. 1'],
    };
    if ((await db.aa_rules.count()) === 0) {
      await db.aa_rules.bulkPut(Object.entries(DEFAULT_AA_PARAMS).map(([key, value]) => ({ key, value, label: labels[key]![0], source_ref: labels[key]![1], version: 1 })));
    }
    // Library and protocol templates: only fill if empty (never overwrite synced content).
    if ((await db.moo_documents.count()) === 0) {
      await db.moo_documents.bulkPut(R.moo_documents.map((d) => ({ ...d, version: 1 })) as never[]);
      await db.moo_versions.bulkPut(R.moo_versions.map((v) => ({ ...v, version: 1 })) as never[]);
    }
    await db.moo_document_indicators.bulkPut(R.moo_document_indicators as never[]);
    if ((await db.protocol_templates.count()) === 0) {
      await db.protocol_templates.bulkPut(R.protocol_templates.map((t) => ({ ...t, version: 1 })) as never[]);
      await db.protocol_steps.bulkPut(R.protocol_steps.map((s) => ({ ...s, version: 1 })) as never[]);
    }
    await setMeta('referenceVersion', REFERENCE_VERSION);
  });
}

/**
 * Ask the browser not to evict this app's data (unsent logbook entries live here).
 * Browsers grant it to installed PWAs; elsewhere it is a no-op.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return false; }
}
