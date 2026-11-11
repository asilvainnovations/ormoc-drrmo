// First launch: load the bundled reference catalogue (generated from the City's
// IAT v1.1 and traceability workbooks) so the app works before its first sync.
// 1.11: the catalogue (about 1.8 MB with the chapter texts) is loaded on demand, only when this device's copy
// is older than REFERENCE_VERSION, so public pages and later launches do not parse it.
import type reference from '@/data/reference.json';
import { db, getMeta, setMeta } from './db';
import { DEFAULT_AA_PARAMS } from '@/domain/aa';

export const REFERENCE_VERSION = 'iat-1.1/2026-11-11-ra12287-hazard-family';

type Ref = typeof reference;

export async function bootstrapReference(): Promise<void> {
  const loaded = await getMeta<string | null>('referenceVersion', null);
  if (loaded === REFERENCE_VERSION && (await db.iat_indicators.count()) > 0) return;
  const R = (await import('@/data/reference.json')).default as Ref;
  await db.transaction('rw', [db.manual_parts, db.manual_areas, db.iat_parts, db.iat_domains, db.iat_indicators, db.master_requirements, db.indicator_requirements,
    db.offices, db.indicator_lead_offices, db.framework_crosswalk, db.hazards, db.aa_rules, db.aa_action_templates,
    db.moo_documents, db.moo_versions, db.moo_document_indicators, db.protocol_templates, db.protocol_steps, db.meta], async () => {
    await db.manual_parts.bulkPut(R.manual_parts as never[]);
    await db.manual_areas.bulkPut(R.manual_areas as never[]);
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
      aa_share_of_ldrrmf_70: ['No more than 10% of the 70% LDRRMF for anticipatory action', 'IRR Rule V Sec. 1(b)'],
      tranche_beyond_max: ['At most 30% of the AA allocation beyond a lead time of three (3) days (hydromet and geological hazards)', 'IRR Rule V Sec. 2'],
      tranche_within_max: ['Up to 70% of the AA allocation within a maximum lead time of three (3) days (hydromet and geological hazards)', 'IRR Rule V Sec. 2'],
      lead_threshold_days: ['Graduated disbursement: beyond or within a lead time of three (3) days', 'IRR Rule V Sec. 2'],
      min_declaration_lead_days: ['Minimum lead time for a declaration: three (3) days', 'RA 12287 Sec. 6(b); IRR Rule II Sec. 3'],
      extended_declaration_lead_days: ['The three-day lead time may be extended to five (5) days', 'RA 12287 Sec. 6(b)'],
      rdrrmc_reply_hours: ['RDRRMC recommendation within twenty-four (24) hours', 'IRR Rule III Sec. 2'],
      report_days: ['Report to OCD within forty-five (45) days from the lifting', 'RA 12287 Sec. 8; IRR Rule VI Sec. 1'],
    };
    if ((await db.aa_rules.count()) === 0) {
      await db.aa_rules.bulkPut(Object.entries(DEFAULT_AA_PARAMS).map(([key, value]) => ({ key, value, label: labels[key]![0], source_ref: labels[key]![1], version: 1 })));
    }
    // Library and protocol templates: only fill if empty (never overwrite synced content).
    if ((await db.moo_documents.count()) === 0) {
      await db.moo_documents.bulkPut(R.moo_documents.map((d) => ({ ...d, version: 1 })) as never[]);
      await db.moo_versions.bulkPut(R.moo_versions.map((v) => ({ ...v, version: 1 })) as never[]);
    } else {
      await restructureLibrary(R);
    }
    // Links are reference data: replace them whole so links of merged sections do not linger.
    await db.moo_document_indicators.clear();
    await db.moo_document_indicators.bulkPut(R.moo_document_indicators as never[]);
    if ((await db.protocol_templates.count()) === 0) {
      await db.protocol_templates.bulkPut(R.protocol_templates.map((t) => ({ ...t, version: 1 })) as never[]);
      await db.protocol_steps.bulkPut(R.protocol_steps.map((s) => ({ ...s, version: 1 })) as never[]);
    }
    await setMeta('referenceVersion', REFERENCE_VERSION);
  });
}

/**
 * v1.6 one-manual structure for a device whose Library was filled before (demo mode or offline).
 * Adds missing documents and versions and refreshes the structural fields (code, title, area,
 * aliases, parent) of the others. Text and approval stay as synced: the next pull brings the
 * server's copy anyway. Merged sections become superseded unless already approved.
 */
async function restructureLibrary(R: Ref): Promise<void> {
  const superseded = new Set<string>(R.superseded_documents);
  for (const d of R.moo_documents) {
    const local = await db.moo_documents.get(d.id);
    if (!local) { await db.moo_documents.put({ ...d, version: 1 } as never); continue; }
    const status = superseded.has(d.id) && local.status !== 'approved' ? 'superseded' : local.status;
    await db.moo_documents.put({ ...local, code: d.code, title: d.title, kind: d.kind, parent_id: d.parent_id, area_no: d.area_no,
      chapter_no: d.chapter_no, aliases: d.aliases, also_areas: d.also_areas, sort: d.sort, status } as never);
  }
  // Chapter 2 figures live in /library/chp2/ (migration 20261102001200 does the same on the server).
  await db.moo_versions.filter((v) => v.status !== 'approved' && v.body_md.includes('/library/ch2/'))
    .modify((v) => { v.body_md = v.body_md.split('/library/ch2/').join('/library/chp2/'); });
  const have = new Set(await db.moo_versions.toCollection().primaryKeys());
  await db.moo_versions.bulkPut(R.moo_versions.filter((v) => !have.has(v.id)).map((v) => ({ ...v, version: 1 })) as never[]);
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
