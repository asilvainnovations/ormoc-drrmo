// Mirrors the SQL view v_eoc_cap_domains (migration 20261114003000_eoc_capability.sql).
import { describe, expect, it } from 'vitest';
import { itemDomains, rollUp, siteTotals } from './eocCapability';
import type { EocCapItem, EocCapResponse } from '@/types';

const item = (id: string, iat: string[]): EocCapItem => ({ id, section_group: 'G', section: 'S', item_no: 1, item: 'x', iat_indicators: iat,
  assess_locally: iat.length === 0, sort: 1, source_ref: 'src', version: 1 });
const resp = (item_id: string, status: EocCapResponse['status'], provenance: 'prefilled_iat' | 'observed', site: 'primary' | 'alternate' = 'primary',
  state: 'draft' | 'validated' = 'draft'): EocCapResponse => ({ id: `r-${item_id}-${site}`, cycle_id: 'c', item_id, site, status, provenance, state,
  evidence_observed: null, gap_remarks: null, recommended_action: null, vault_document_id: null, version: 1 });

describe('EOC capability roll-up', () => {
  const items = [item('a', ['B2.1', 'B2.2']), item('b', ['B2.7', 'B7.1']), item('c', []), item('d', ['B3.1'])];

  it('maps items to their Part B domains, or local when there is no IAT counterpart', () => {
    expect(itemDomains(items[0]!)).toEqual(['B2']);
    expect(itemDomains(items[1]!)).toEqual(['B2', 'B7']);
    expect(itemDomains(items[2]!)).toEqual(['local']);
  });

  it('counts an item in each domain it maps to and a missing answer as not assessed', () => {
    const rows = rollUp(items, [resp('a', 'met', 'prefilled_iat'), resp('b', 'not_met', 'observed')], 'primary');
    const b2 = rows.find((r) => r.domain === 'B2')!;
    expect(b2).toMatchObject({ items: 2, met: 1, not_met: 1, prefilled: 1, observed: 1 });
    expect(rows.find((r) => r.domain === 'B7')).toMatchObject({ items: 1, not_met: 1, observed: 1 });
    expect(rows.find((r) => r.domain === 'B3')).toMatchObject({ items: 1, not_assessed: 1, observed: 0, prefilled: 0 });
    expect(rows.at(-1)!.domain).toBe('local');
  });

  it('keeps sites apart and counts validated answers', () => {
    const rs = [resp('a', 'met', 'observed', 'alternate', 'validated'), resp('a', 'not_met', 'prefilled_iat')];
    expect(rollUp(items, rs, 'alternate').find((r) => r.domain === 'B2')).toMatchObject({ met: 1, validated: 1, observed: 1 });
    const t = siteTotals(items, rs, 'primary');
    expect(t).toMatchObject({ items: 4, prefilled: 1, observed: 0, validated: 0 });
    expect(t.byStatus.not_met).toBe(1);
    expect(t.byStatus.not_assessed).toBe(3);
  });
});
