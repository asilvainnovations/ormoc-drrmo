// EOC capability checklist roll-up (1.20.0, ADR-035). Mirrors the SQL view v_eoc_cap_domains in
// supabase/migrations/20261114003000_eoc_capability.sql; eocCapability.test.ts checks the same rules.
// An item mapped to indicators in two Part B domains counts in each; items with no IAT counterpart roll up
// under 'local'. A missing answer counts as not assessed. Pre-filled and observed answers are kept apart.
import type { EocCapItem, EocCapResponse, EocCapSite, EocCapStatus } from '@/types';

export const CAP_STATUSES: EocCapStatus[] = ['met', 'partially_met', 'largely_unmet', 'not_met', 'not_applicable', 'not_assessed'];

export const CAP_STATUS_LABEL: Record<EocCapStatus, string> = {
  met: 'Met', partially_met: 'Partially met', largely_unmet: 'Largely unmet', not_met: 'Not met',
  not_applicable: 'Not applicable', not_assessed: 'Not assessed',
};
/** Status colours always come with their text (design system: ok / warn / bad / info never alone). */
export const CAP_STATUS_TONE: Record<EocCapStatus, 'ok' | 'warn' | 'bad' | 'info' | 'neutral'> = {
  met: 'ok', partially_met: 'warn', largely_unmet: 'bad', not_met: 'bad', not_applicable: 'neutral', not_assessed: 'neutral',
};
export const CAP_SITE_LABEL: Record<EocCapSite, string> = { primary: 'Primary EOC', alternate: 'Alternate EOC' };
export const CAP_DOMAIN_LABEL: Record<string, string> = {
  B1: 'B1 Legal basis and concept of operations', B2: 'B2 Facility', B3: 'B3 Communications and ICT', B4: 'B4 Organization and staffing',
  B5: 'B5 Information management and reporting', B6: 'B6 Coordination and resources', B7: 'B7 SOPs, training, exercises and continuity',
  local: 'No IAT counterpart (assessed locally)',
};

export interface CapDomainRow {
  domain: string; items: number; met: number; partially_met: number; largely_unmet: number; not_met: number;
  not_applicable: number; not_assessed: number; observed: number; prefilled: number; validated: number;
}

/** The Part B domains an item rolls up to ('local' when it has no IAT counterpart). */
export function itemDomains(item: Pick<EocCapItem, 'iat_indicators'>): string[] {
  const ds = Array.from(new Set(item.iat_indicators.map((i) => i.split('.')[0]!)));
  return ds.length ? ds.sort() : ['local'];
}

/** Roll the answers for one cycle and site up to the Part B domains. */
export function rollUp(items: EocCapItem[], responses: EocCapResponse[], site: EocCapSite): CapDomainRow[] {
  const bySite = new Map(responses.filter((r) => r.site === site).map((r) => [r.item_id, r]));
  const rows = new Map<string, CapDomainRow>();
  for (const item of items) {
    const r = bySite.get(item.id);
    const status: EocCapStatus = r?.status ?? 'not_assessed';
    for (const d of itemDomains(item)) {
      const row = rows.get(d) ?? { domain: d, items: 0, met: 0, partially_met: 0, largely_unmet: 0, not_met: 0, not_applicable: 0,
        not_assessed: 0, observed: 0, prefilled: 0, validated: 0 };
      row.items += 1;
      row[status] += 1;
      if (r && status !== 'not_assessed') {
        if (r.provenance === 'prefilled_iat') row.prefilled += 1; else row.observed += 1;
      }
      if (r?.state === 'validated') row.validated += 1;
      rows.set(d, row);
    }
  }
  return Array.from(rows.values()).sort((a, b) => (a.domain === 'local' ? 1 : b.domain === 'local' ? -1 : a.domain.localeCompare(b.domain)));
}

/** Overall counts for one cycle and site (each item once). */
export function siteTotals(items: EocCapItem[], responses: EocCapResponse[], site: EocCapSite) {
  const bySite = new Map(responses.filter((r) => r.site === site).map((r) => [r.item_id, r]));
  const t = { items: items.length, observed: 0, prefilled: 0, validated: 0, byStatus: {} as Record<EocCapStatus, number> };
  for (const s of CAP_STATUSES) t.byStatus[s] = 0;
  for (const item of items) {
    const r = bySite.get(item.id);
    const status = r?.status ?? 'not_assessed';
    t.byStatus[status] += 1;
    if (r && status !== 'not_assessed') { if (r.provenance === 'prefilled_iat') t.prefilled += 1; else t.observed += 1; }
    if (r?.state === 'validated') t.validated += 1;
  }
  return t;
}
