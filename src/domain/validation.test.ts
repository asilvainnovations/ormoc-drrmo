import { describe, expect, it } from 'vitest';
import { agreement, queue, totals, validationProgress } from './validation';
import type { Domain, Indicator, Response } from '@/types';

const dom = (code: string, part: Domain['part']): Domain => ({ code, part, name: code, scope: '', functional_area: '', platform_module: '', sort: 0 });
const ind = (id: string, domain: string): Indicator => ({ id, domain, statement: `Statement ${id}`, reference: '', type: 'M', weight: 2,
  means_of_verification: null, methods: null, moo_chapter: null, lead_office: null, tags: [], version_status: '', sort: 0 } as Indicator);
const resp = (indicator_id: string, p: Partial<Response>): Response => ({ id: indicator_id, cycle_id: 'c', indicator_id, score: 2, is_na: false,
  na_justification: null, gap_remarks: null, recommended_action: null, status: 'provisional', version: 1, ...p } as Response);

const domains = [dom('A1', 'A'), dom('B1', 'B'), dom('C1', 'C')];
const indicators = [ind('A1.1', 'A1'), ind('A1.2', 'A1'), ind('A1.3', 'A1'), ind('B1.1', 'B1'), ind('C1.1', 'C1')];
const responses = [
  resp('A1.1', { status: 'validated', validation_decision: 'confirmed', evidence_check: 'verified' }),
  resp('A1.2', { status: 'validated', validation_decision: 'revised', evidence_check: 'partially_verified' }),
  resp('B1.1', { status: 'provisional' }),
];

describe('validation workshop progress', () => {
  it('counts by domain; a missing response is a draft with pending evidence', () => {
    const rows = validationProgress(indicators, domains, responses);
    const a1 = rows.find((r) => r.domain === 'A1')!;
    expect(a1).toMatchObject({ indicators: 3, draft: 1, submitted: 0, validated: 2, confirmed: 1, revised: 1, evidenceVerified: 1, evidencePending: 1 });
    expect(rows.find((r) => r.domain === 'B1')).toMatchObject({ submitted: 1, evidencePending: 1 });
    expect(totals(rows, ['A', 'B'])).toMatchObject({ indicators: 4, validated: 2, submitted: 1, draft: 1 });
    expect(totals(rows).indicators).toBe(5);
  });
  it('agreement is the share of validations kept as submitted', () => {
    expect(agreement(1, 1)).toBe(0.5);
    expect(agreement(0, 0)).toBeNull();
  });
  it('filters the queue by part, status, evidence and text', () => {
    const f = { part: 'all' as const, status: 'all' as const, evidence: 'all' as const, text: '' };
    expect(queue(indicators, domains, responses, f)).toHaveLength(5);
    expect(queue(indicators, domains, responses, { ...f, status: 'submitted' }).map((q) => q.indicator.id)).toEqual(['B1.1']);
    expect(queue(indicators, domains, responses, { ...f, status: 'draft' }).map((q) => q.indicator.id)).toEqual(['A1.3', 'C1.1']);
    expect(queue(indicators, domains, responses, { ...f, part: 'A', evidence: 'verified' }).map((q) => q.indicator.id)).toEqual(['A1.1']);
    expect(queue(indicators, domains, responses, { ...f, text: 'statement b1' }).map((q) => q.indicator.id)).toEqual(['B1.1']);
  });
});
